#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/prepare-music.py —— 把本地音乐素材搬进仓库（可重复运行）

做四件事：
  1. 把 6 个 MP3 复制到 static/music/，文件名改成 ASCII（id.mp3）
  2. 自己解析 ID3v2 标签，把内嵌封面（APIC 帧里的 JPEG/PNG）提取到
     static/music/covers/<id>.jpg —— 本机没有 ffmpeg / mutagen，所以手写解析
  3. 把 3 个 LRC 复制到 static/music/lyrics/<id>.lrc，并解析出：
       · 制作信息（网易云 LRC 开头那些 JSON 行里的 作词 / 作曲 / 编曲）
       · 是否纯音乐（「纯音乐，请欣赏」占位行）
  4. 生成 data/music.yaml（Hugo 的 data 文件，前端直接 site.Data.music 取用）

用法：
    <python> tools/prepare-music.py

注意：
  · 音频不压缩、不转码，原样复制（共约 60 MB）
  · 脚本只读源目录、只写 static/music/** 与 data/music.yaml
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


def main():
    for d in (OUT_MUSIC, OUT_COVERS, OUT_LYRICS, os.path.dirname(OUT_DATA)):
        os.makedirs(d, exist_ok=True)

    rows, problems = [], []
    for t in TRACKS:
        src = os.path.join(SRC_MUSIC, t["mp3"])
        if not os.path.exists(src):
            problems.append("缺少音频源文件: " + src)
            continue

        # 1) 复制音频（原样，不转码）
        dst_mp3 = os.path.join(OUT_MUSIC, t["id"] + ".mp3")
        shutil.copy2(src, dst_mp3)

        # 2) 提取封面 + 读 ID3 里的标题/歌手
        cover_url = ""
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

        # 3) 复制 + 解析歌词
        lyrics_url, credits, n_lines, n_pairs, instrumental = "", [], 0, 0, False
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
            else:
                problems.append("缺少歌词源文件: " + t["lrc"])

        rows.append(dict(
            id=t["id"], title=title, artist=artist,
            file="/music/%s.mp3" % t["id"], cover=cover_url, lyrics=lyrics_url,
            instrumental=instrumental, credits=credits,
            size=os.path.getsize(dst_mp3), cover_note=cover_note, n_lines=n_lines,
            n_pairs=n_pairs,
        ))

    # 4) 写 data/music.yaml
    out = [
        "# 播放列表 —— 由 tools/prepare-music.py 自动生成，请勿手改。",
        "# 素材：6 首 MP3（static/music/）+ 封面（static/music/covers/）+ LRC（static/music/lyrics/）",
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
        print("%-24s %-34s %-18s mp3 %5.1f MB | %s | 歌词 %d 行（双语成对 %d）%s" % (
            r["id"], r["title"][:32], r["artist"][:16],
            r["size"] / 1048576.0, r["cover_note"], r["n_lines"], r["n_pairs"],
            " | 纯音乐" if r["instrumental"] else ""))
        if r["credits"]:
            print("%-24s   credits: %s" % ("", " / ".join("%s %s" % c for c in r["credits"])))
    print("-" * 78)
    print("音频合计 %.1f MB；data/music.yaml 已写入" % (
        sum(r["size"] for r in rows) / 1048576.0))
    if problems:
        print("\n⚠️  需要注意：")
        for p in problems:
            print("   - " + p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
