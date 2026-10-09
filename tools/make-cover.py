#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成文章封面图（可重复运行）
=============================================================================
用法：
    python tools/make-cover.py --title "本站初版完工" \
        --sub "静态博客 · Hugo + Cloudflare" \
        --tag "YunX东方夜话 · 2026-10-09" \
        --bg bg-05.jpg --out static/images/site-v1-launch-cover.jpg

做什么：
  · 从 assets/images/bg/ 里挑一张当底图（默认 bg-05.jpg：宽高比 2.06、最暗、
    细节最少，压一层暗色后放标题最清楚），等比缩放 + 居中裁切到 1200x630，
    **不拉伸变形**
  · 左侧压暗（右侧稍亮）保证文字对比度，再写上标签行 / 大标题 / 副标题
  · 输出 JPEG（默认 quality 84，一篇文章的封面通常 100 KB 出头）
  · 用系统里的微软雅黑（msyhbd 粗体 / msyh 常规），中文不会变方块

注意：这只生成图，不写 front matter；文章里按现有格式写 cover.image 指过去即可。
"""

import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_DIR = os.path.join(ROOT, "assets", "images", "bg")
W, H = 1200, 630                      # 卡片封面是 16/9 左右，1200x630 居中裁切
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
ACCENT = (96, 205, 255)               # 与深色模式的 --fc-accent 一致
INK = (255, 255, 255)
INK_DIM = (206, 218, 232)


def fit(path, size):
    """等比缩放到铺满 size，再居中裁切（不变形）"""
    im = Image.open(path).convert("RGB")
    tw, th = size
    sw, sh = im.size
    scale = max(tw / float(sw), th / float(sh))
    im = im.resize((int(sw * scale + 0.5), int(sh * scale + 0.5)), Image.LANCZOS)
    sw, sh = im.size
    left = (sw - tw) // 2
    top = (sh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--sub", default="")
    ap.add_argument("--tag", default="")
    ap.add_argument("--bg", default="bg-05.jpg")
    ap.add_argument("--out", required=True)
    ap.add_argument("--strength", type=float, default=0.55, help="压暗强度 0~1")
    ap.add_argument("--quality", type=int, default=84)
    args = ap.parse_args()

    src = os.path.join(BG_DIR, args.bg)
    if not os.path.exists(src):
        print("找不到底图：%s" % src)
        return 1

    base = fit(src, (W, H))

    # 左侧压暗多一点，右边留一点原图层次
    shade = Image.new("L", (W, H))
    d = ImageDraw.Draw(shade)
    for x in range(W):
        d.line([(x, 0), (x, H)], fill=int(255 * args.strength * (1.28 - 0.55 * x / float(W))))
    base = Image.composite(Image.new("RGB", (W, H), (10, 14, 22)), base, shade)

    draw = ImageDraw.Draw(base)
    f_tag = font(FONT_REG, 24)
    f_title = font(FONT_BOLD, 74)
    f_sub = font(FONT_REG, 30)

    x = 84
    y = 188
    if args.tag:
        draw.rounded_rectangle([x, y - 4, x + 6, y + 34], radius=3, fill=ACCENT)
        draw.text((x + 22, y), args.tag, font=f_tag, fill=INK_DIM)
    draw.text((x, y + 54), args.title, font=f_title, fill=INK)
    if args.sub:
        draw.text((x, y + 162), args.sub, font=f_sub, fill=INK_DIM)

    out = args.out if os.path.isabs(args.out) else os.path.join(ROOT, args.out)
    d_out = os.path.dirname(out)
    if d_out and not os.path.isdir(d_out):
        os.makedirs(d_out)
    base.save(out, "JPEG", quality=args.quality, optimize=True, progressive=True)

    # 自检：标题那一带确实画上了字（避免字体/编码问题悄悄出白图）
    band = base.crop((x, y + 54, x + 900, y + 150)).convert("L")
    hist = band.histogram()                      # 用直方图统计，避开 getdata 的弃用告警
    bright = sum(hist[201:]) / float(band.size[0] * band.size[1])
    print("底图: %s  (%s)" % (args.bg, Image.open(src).size))
    print("输出: %s" % os.path.relpath(out, ROOT))
    print("尺寸: %dx%d   大小: %.0f KB" % (base.size[0], base.size[1], os.path.getsize(out) / 1024.0))
    print("标题区亮像素占比: %.1f%%（应 >1%%，太低说明字没画上）" % (bright * 100))
    return 0


if __name__ == "__main__":
    sys.exit(main())
