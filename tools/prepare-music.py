#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/prepare-music.py —— 生成/更新音乐素材与播放列表（可重复运行）

素材现在分两处：
  · MP3：**已经搬到 Cloudflare R2**（桶 blog-music，公开地址见下面 R2_BASE），
    仓库里不再存 mp3；要重新上传用
        npx wrangler r2 object put blog-music/<id>.mp3 --file <本地mp3> --content-type audio/mpeg --remote
  · 封面、歌词：仍在仓库里（static/music/covers、static/music/lyrics），
    体积小、同源加载快，所以不搬到 R2。

做四件事：
  1. 需要时（--copy-mp3）才把源 MP3 复制进 static/music/；默认不复制
     —— 仓库里不该再有 mp3（.gitignore 也已加上 static/music/*.mp3）
  2. 从源 MP3 的 ID3v2 标签里提取内嵌封面到 static/music/covers/<id>.jpg
     （本机没有 ffmpeg / mutagen，所以手写解析）
  3. 把 LRC 复制到 static/music/lyrics/<id>.lrc，并解析出：
       · 制作信息（网易云 LRC 开头那些 JSON 行里的 作词 / 作曲 / 编曲）
       · 是否纯音乐（「纯音乐，请欣赏」占位行）
  4. 生成 data/music.yaml：mp3 用 R2_BASE + 文件名，封面/歌词仍用本地路径

用法：
    <python> tools/prepare-music.py              # 常规：只更新封面/歌词/yaml
    <python> tools/prepare-music.py --copy-mp3   # 额外把源 mp3 复制进仓库（一般不需要）

安全性（重要）：
  · 源 MP3 或 LRC 不在了也**不会**把 data/music.yaml 写坏：缺什么就沿用现有
    yaml 里那一项的值（read_existing_yaml 兜底），file 永远指向 R2。
  · 脚本只读源目录，只写 static/music/covers、static/music/lyrics 与 data/music.yaml。
"""

import json
import os
import re
import shutil
import struct
import sys

try:
    from PIL import Image  # 仅用于校验提取出来的封面是不是有效图片
except Exception:  # pragma: no cover
    Image = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_MUSIC = r"C:\Users\Administrator\Desktop\1音乐"
# 歌词可能来自网易云目录，也可能直接躺在桌面音乐目录里（后加的两首就在那儿）
LRC_DIRS = [r"D:\CloudMusic\VipSongsDownload", r"D:\CloudMusic", SRC_MUSIC]

# MP3 的公开基址：Cloudflare R2 桶 blog-music 绑定的自定义域名。
# 以后换域名/加前缀只改这一行；yaml 里的 file 都是它 + "<id>.mp3"。
R2_BASE = "https://music.yunblog.com.cn"

COPY_MP3 = "--copy-mp3" in sys.argv  # 默认不把 mp3 复制进仓库

OUT_MUSIC = os.path.join(ROOT, "static", "music")
OUT_COVERS = os.path.join(OUT_MUSIC, "covers")
OUT_LYRICS = os.path.join(OUT_MUSIC, "lyrics")
OUT_DATA = os.path.join(ROOT, "data", "music.yaml")

# id（ASCII 文件名） / 源 MP3 文件名 / 源 LRC 文件名（None = 没有歌词文件）
TRACKS = [
    dict(
        id="01-kachou-fuugetsu",
        mp3="Senya - 華鳥風月 (幻想万華鏡 花の異変の章 OP主題歌).mp3",
        lrc="Senya - 華鳥風月 (幻想万華鏡 花の異変の章 OP主題歌).lrc",
    ),
    dict(id="02-again", mp3="Vivienne - Again.mp3", lrc="again.lrc"),
    dict(id="03-ray-of-light", mp3="Vivienne - The Ray of Light.mp3", lrc="The Ray of Light.lrc"),
    dict(id="04-hakugyokurou-kaidan", mp3="東京アクティブNEETs - 白玉楼階段の幻闘.mp3",
         lrc="東京アクティブNEETs - 白玉楼階段の幻闘.lrc"),
    dict(id="05-song-for-two", mp3="平井 大 - SONG FOR TWO.mp3", lrc=None),
    dict(id="06-city-escape-plan", mp3="异环10AM - 城市逃离计划30%.mp3",
         lrc="异环10AM - 城市逃离计划30%.lrc"),
]


# --------------------------------------------------------------------------- ID3
def _syncsafe(b):
    """ID3v2.4 的 4 字节 syncsafe 整数（每字节只用低 7 位）"""
    return (b[0] << 21) | (b[1] << 14) | (b[2] << 7) | b[3]


def _decode_text(b):
    """按 ID3 编码字节解码文本帧"""
    if not b:
        return ""
    enc, raw = b[0], b[1:]
    try:
        if enc == 0:
            return raw.split(b"\x00")[0].decode("latin1", "replace").strip()
        if enc == 1:
            return raw.decode("utf-16", "replace").split("\x00")[0].strip()
        if enc == 2:
            return raw.decode("utf-16-be", "replace").split("\x00")[0].strip()
        return raw.split(b"\x00")[0].decode("utf-8", "replace").strip()
    except Exception:
        return ""


def _parse_apic(b):
    """APIC 帧：编码(1) + MIME(0 结尾) + 图片类型(1) + 描述(按编码结尾) + 图片数据"""
    if len(b) < 4:
        return None
    enc, rest = b[0], b[1:]
    mime, _, rest = rest.partition(b"\x00")
    if not rest:
        return None
    pic_type, rest = rest[0], rest[1:]
    if enc in (1, 2):  # UTF-16 描述：以双字节 0 结尾
        i = 0
        while i + 1 < len(rest):
            if rest[i] == 0 and rest[i + 1] == 0:
                break
            i += 2
        data = rest[i + 2:]
    else:
        _, _, data = rest.partition(b"\x00")
    if not data:
        return None
    return mime.decode("latin1", "replace"), pic_type, data


def read_id3(path):
    """返回 (version, {帧ID: [帧内容, ...]})；没有 ID3v2 头就返回 (None, {})"""
    with open(path, "rb") as f:
        head = f.read(10)
        if len(head) < 10 or head[:3] != b"ID3":
            return None, {}
        major, _minor, _flags = head[3], head[4], head[5]
        size = _syncsafe(head[6:10])
        body = f.read(size)

    frames = {}
    i = 0
    while i + 10 <= len(body):
        fid = body[i:i + 4]
        if not re.match(rb"^[A-Z0-9]{4}$", fid):
            break  # 到填充区了
        if major == 4:
            fsize = _syncsafe(body[i + 4:i + 8])
        else:
            fsize = struct.unpack(">I", body[i + 4:i + 8])[0]
        if fsize <= 0 or i + 10 + fsize > len(body):
            break
        frames.setdefault(fid.decode("latin1"), []).append(body[i + 10:i + 10 + fsize])
        i += 10 + fsize
    return major, frames


def extract_cover(path, dest):
    """提取第一张（优先 3=front cover）封面图，成功返回 (宽, 高, 字节数, 扩展名)"""
    major, frames = read_id3(path)
    apics = frames.get("APIC") or frames.get("PIC") or []
    if not apics:
        return None
    picked = None
    for raw in apics:
        parsed = _parse_apic(raw)
        if parsed and parsed[1] == 3:
            picked = parsed
            break
    if picked is None:
        for raw in apics:
            parsed = _parse_apic(raw)
            if parsed:
                picked = parsed
                break
    if picked is None:
        return None

    mime, _ptype, data = picked
    ext = ".png" if data[:4] == b"\x89PNG" else ".jpg"
    out = dest + ext
    with open(out, "wb") as f:
        f.write(data)
    w = h = 0
    if Image is not None:
        with Image.open(out) as im:
            w, h = im.size
    return w, h, len(data), ext, major


# --------------------------------------------------------------------------- LRC
# 常见制作信息角色（两种格式都会用到：网易云是 JSON 行，另一种是带时间轴的 [mm:ss] 行）
CREDIT_ROLES = [
    "作词", "作曲", "编曲", "制作人", "监制", "出品", "混音", "母带", "录音", "和声",
    "吉他", "贝斯", "鼓", "键盘", "弦乐", "原曲", "演唱", "调教", "曲绘", "PV", "动画",
    "lyrics", "lyricist", "music", "compose", "composer", "arrange", "arranger",
    "producer", "mixing", "mix", "mastering", "master", "vocal", "vocals", "guitar",
]


def match_credit(text):
    """把「角色 : 名字」这种制作信息行认出来（中英文冒号、冒号前后可能有空格）。
       只认角色名单里的标签，避免把带冒号的正常歌词误伤成制作信息。"""
    m = re.match(r"^\s*([A-Za-z\u4e00-\u9fff]{1,8})\s*[:：]\s*(\S.*?)\s*$", text)
    if not m:
        return None
    role, name = m.group(1).strip(), m.group(2).strip()
    if role.lower() in CREDIT_ROLES or role in CREDIT_ROLES:
        return (role, name)
    return None


def parse_lrc(path):
    """同时兼容两种 LRC：
       ① 网易云格式：开头若干行是 JSON 元数据（制作信息），后面是 [mm:ss.xx] 歌词
       ② 常见格式：制作信息本身就写成带时间轴的 [mm:ss.xx] 角色 : 名字
       返回 (credits, lyrics, instrumental, stats)
         credits    : [(角色, 名字)]
         lyrics     : [(秒, 主行, 译文)]，同一时间戳连续两行视为「原文 + 翻译」
         stats      : dict(lines=主行数, pairs=双语对数, skipped=被当制作信息/占位跳过的行数)
    """
    credits, instrumental = [], False
    entries = []  # [(秒, 文本)]
    with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            if s.startswith("{"):  # 网易云的 JSON 元数据行
                try:
                    obj = json.loads(s)
                except Exception:
                    continue
                text = "".join(str(c.get("tx", "")) for c in obj.get("c", [])).strip()
                if text:
                    m = re.match(r"^([^:：]{1,8})[:：]\s*(.+)$", text)
                    if m and (m.group(1).strip(), m.group(2).strip()) not in credits:
                        credits.append((m.group(1).strip(), m.group(2).strip()))
                continue
            m = re.match(r"^\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]\s*(.*)$", s)
            if not m:
                continue
            sec = int(m.group(1)) * 60 + float(m.group(2).replace(":", "."))
            entries.append((sec, m.group(3).strip()))

    # 先摘出制作信息与占位行，剩下的才是歌词
    kept, skipped = [], 0
    for sec, text in entries:
        if not text:
            continue  # 只有时间戳的空行
        if "纯音乐" in text and len(text) <= 12:
            instrumental = True
            skipped += 1
            continue
        credit = match_credit(text)
        if credit:
            if credit not in credits:
                credits.append(credit)
            skipped += 1
            continue
        kept.append((sec, text))

    # 同一时间戳连续两行 = 原文 + 翻译，配对成「主行 + 译文」
    lyrics, pairs, i = [], 0, 0
    while i < len(kept):
        sec, text = kept[i]
        sub = ""
        if i + 1 < len(kept) and abs(kept[i + 1][0] - sec) < 0.01:
            sub = kept[i + 1][1]
            pairs += 1
            i += 1
        lyrics.append((sec, text, sub))
        i += 1
    return credits, lyrics, instrumental, {"lines": len(lyrics), "pairs": pairs, "skipped": skipped}


# --------------------------------------------------------------------------- YAML
# 展示顺序：作词 → 作曲 → 编曲 → 制作人 → 其它
ROLE_ORDER = ["作词", "作曲", "编曲", "制作人"]


def sort_credits(credits):
    def key(c):
        try:
            return (0, ROLE_ORDER.index(c[0]))
        except ValueError:
            return (1, 0)
    return sorted(credits, key=key)


def yq(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def read_existing_yaml(path):
    """读现有 data/music.yaml 里每个 id 的字段，作为重新生成时的兜底。

    为什么需要：mp3 已经搬到 R2，本机源目录哪天不在了，脚本也不能把已经正确的
    配置写坏（例如把 lyrics 写成空、把 credits 丢掉）。缺什么就沿用这里的旧值。
    """
    keep = {}
    if not os.path.exists(path):
        return keep
    cur = None
    in_credits = False
    with open(path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r'^- id:\s*"?([^"\n]+?)"?\s*$', line)
            if m:
                cur = m.group(1)
                keep[cur] = {"credits": []}
                in_credits = False
                continue
            if cur is None:
                continue
            if re.match(r"^\s+credits:\s*$", line):
                in_credits = True
                continue
            if in_credits:
                if re.match(r"^\s+- ", line):
                    keep[cur]["credits"].append(line.rstrip("\n"))
                    continue
                if re.match(r"^\s+credits:\s*\[\]\s*$", line):
                    in_credits = False
                    continue
                in_credits = False
            m = re.match(r"^\s+(title|artist|file|cover|lyrics|instrumental):\s*(.*)$", line)
            if m:
                keep[cur][m.group(1)] = m.group(2).strip().strip('"')
    return keep


def main():
    for d in (OUT_MUSIC, OUT_COVERS, OUT_LYRICS, os.path.dirname(OUT_DATA)):
        os.makedirs(d, exist_ok=True)

    old = read_existing_yaml(OUT_DATA)
    rows, problems = [], []
    for t in TRACKS:
        prev = old.get(t["id"], {})
        src = os.path.join(SRC_MUSIC, t["mp3"])
        have_src = os.path.exists(src)
        if not have_src:
            problems.append("源 MP3 不在了（封面/标题/时长沿用现有配置，file 仍指向 R2）: " + src)

        # 1) 音频：已经在 R2 上，默认不再往仓库里复制（--copy-mp3 才复制）
        dst_mp3 = os.path.join(OUT_MUSIC, t["id"] + ".mp3")
        if have_src and COPY_MP3:
            shutil.copy2(src, dst_mp3)
        size = os.path.getsize(dst_mp3) if os.path.exists(dst_mp3) else 0

        # 2) 封面 + 标题/歌手：源在就从 ID3 里读，源不在了沿用现有 yaml
        cover_url, cover_note = "", "沿用现有封面"
        title = artist = ""
        if have_src:
            info = extract_cover(src, os.path.join(OUT_COVERS, t["id"]))
            if info:
                w, h, nbytes, ext, major = info
                cover_url = "/music/covers/%s%s" % (t["id"], ext)
                cover_note = "%dx%d %s %d KB (ID3v2.%s)" % (w, h, ext, nbytes // 1024, major)
            else:
                cover_note = "无内嵌封面"
                problems.append("没有找到内嵌封面: " + t["mp3"])

            _major, frames = read_id3(src)
            tag_title = _decode_text((frames.get("TIT2") or [b""])[0])
            tag_artist = _decode_text((frames.get("TPE1") or [b""])[0])
            base = os.path.splitext(t["mp3"])[0]
            if " - " in base:
                file_artist, file_title = base.split(" - ", 1)
            else:
                file_artist, file_title = "", base
            title = tag_title or file_title
            artist = tag_artist or file_artist

        if not title:
            title = prev.get("title") or t["id"]
        if not artist:
            artist = prev.get("artist") or ""
        if not cover_url:
            cover_url = prev.get("cover") or "/music/covers/%s.jpg" % t["id"]

        # 3) 复制 + 解析歌词；缺源就沿用现有歌词路径与 credits（不写坏配置）
        lyrics_url, credits, n_lines, n_pairs, instrumental = "", [], 0, 0, False
        got_lyrics = False
        if t["lrc"]:
            lrc_src = None
            for d in LRC_DIRS:
                cand = os.path.join(d, t["lrc"])
                if os.path.exists(cand):
                    lrc_src = cand
                    break
            if lrc_src:
                shutil.copy2(lrc_src, os.path.join(OUT_LYRICS, t["id"] + ".lrc"))
                lyrics_url = "/music/lyrics/%s.lrc" % t["id"]
                credits, lines, instrumental, lstats = parse_lrc(lrc_src)
                credits = sort_credits(credits)
                n_lines, n_pairs = lstats["lines"], lstats["pairs"]
                got_lyrics = True
            else:
                problems.append("缺少歌词源文件（沿用现有歌词配置）: " + t["lrc"])

        if not got_lyrics:
            lyrics_url = prev.get("lyrics", "")
            # credits 块整段沿用旧 yaml 的原文（不做二次解析，避免写坏）
            credits_lines = prev.get("credits") or None
            instrumental = prev.get("instrumental") == "true"
        else:
            credits_lines = None

        rows.append(dict(
            id=t["id"], title=title, artist=artist,
            file="%s/%s.mp3" % (R2_BASE, t["id"]), cover=cover_url, lyrics=lyrics_url,
            instrumental=instrumental, credits=credits, credits_lines=credits_lines,
            size=size, cover_note=cover_note, n_lines=n_lines,
            n_pairs=n_pairs,
        ))

    # 4) 写 data/music.yaml
    out = [
        "# 播放列表 —— 由 tools/prepare-music.py 自动生成，请勿手改。",
        "# MP3 在 Cloudflare R2（桶 blog-music，公开基址见脚本里的 R2_BASE）；",
        "# 封面 / 歌词仍在仓库里：static/music/covers/、static/music/lyrics/。",
        "# 字段：id / title / artist / file / cover / lyrics / instrumental / credits",
        "",
    ]
    for r in rows:
        out.append("- id: %s" % yq(r["id"]))
        out.append("  title: %s" % yq(r["title"]))
        out.append("  artist: %s" % yq(r["artist"]))
        out.append("  file: %s" % yq(r["file"]))
        out.append("  cover: %s" % yq(r["cover"]))
        out.append("  lyrics: %s" % yq(r["lyrics"]))
        out.append("  instrumental: %s" % ("true" if r["instrumental"] else "false"))
        if r["credits"]:
            out.append("  credits:")
            for role, name in r["credits"]:
                out.append("    - role: %s" % yq(role))
                out.append("      name: %s" % yq(name))
        elif r.get("credits_lines"):
            out.append("  credits:")
            out.extend(r["credits_lines"])
        else:
            out.append("  credits: []")
        out.append("")
    with open(OUT_DATA, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out))

    # 5) 汇总
    print("=" * 78)
    print("%-24s %-34s %-18s %s" % ("id", "title", "artist", "素材"))
    print("-" * 78)
    for r in rows:
        print("%-24s %-34s %-18s mp3 %s | %s | 歌词 %d 行（双语成对 %d）%s" % (
            r["id"], r["title"][:32], r["artist"][:16],
            ("%.1f MB（本地）" % (r["size"] / 1048576.0)) if r["size"] else "→ R2",
            r["cover_note"], r["n_lines"], r["n_pairs"],
            " | 纯音乐" if r["instrumental"] else ""))
        if r["credits"]:
            print("%-24s   credits: %s" % ("", " / ".join("%s %s" % c for c in r["credits"])))
        elif r.get("credits_lines"):
            print("%-24s   credits（沿用现有）: %s" % ("", " ".join(
                ln.strip().lstrip("- ").replace("role:", "").replace("name:", "").split()
                for ln in r["credits_lines"])))
    print("-" * 78)
    print("MP3 公开基址：%s" % R2_BASE)
    print("仓库内 mp3：%s" % ("已按 --copy-mp3 复制" if COPY_MP3 else "不复制（mp3 已迁移到 R2）"))
    print("data/music.yaml 已写入：%s" % OUT_DATA)
    if problems:
        print("\n⚠️  需要注意：")
        for p in problems:
            print("   - " + p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
