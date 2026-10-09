#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成站点 favicon（可重复运行）
=============================================================================
用法：
    python tools/make-favicon.py             # 生成（默认圆角裁切 + 不透明底色）
    python tools/make-favicon.py --plain     # 不裁形状，直接方形缩放（对比用）
    python tools/make-favicon.py --analyze   # 只做 16px 可读性分析，不写文件

做什么：
  · 源图 assets/images/logo.jpg（627x626，与左上角小圆标同源）
  · 居中裁成正方形再缩放（不拉伸变形）
  · 输出 static/favicon-16x16.png、favicon-32x32.png、apple-touch-icon.png（180x180）
    以及多尺寸 static/favicon.ico（16/32/48）
  · apple-touch-icon 必须不透明（iOS 会把透明填黑），所以统一压在底色上
  · static/safari-pinned-tab.svg 是单色蒙版：按 16x16 的明暗阈值生成方块蒙版
  · 顺带打印 16x16 的 ASCII 灰度图与可读性指标（唯一色数、主色占比、主体对比度、
    与 128px 参考图的结构相关性），方便判断"缩到 16px 还看不看得出是什么"

为什么带版本号：favicon 被浏览器缓存得极死，所以同目录下另存一份
favicon-16x16.v2.png 之类没有必要——改的是文件内容 + head 里的 ?v=2（见 hugo.toml
的 params.assets.*）。本脚本只负责产出文件内容。
"""

import argparse
import math
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images", "logo.jpg")
STATIC = os.path.join(ROOT, "static")

# 圆角裁切：与左上角 .fc-brand-mark 的观感一致（28px 时圆角 6px，约 21%）
CORNER_RATIO = 0.22
ICO_SIZES = [(16, 16), (32, 32), (48, 48)]


def load_square(path):
    """打开图片并居中裁成正方形（不拉伸）"""
    img = Image.open(path)
    img = img.convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def dominant_bg(img):
    """取四条边像素的中位色当底色：圆角/不透明底都用它，避免引入新色系"""
    px = img.load()
    w, h = img.size
    samples = []
    for x in range(0, w, max(1, w // 40)):
        samples.append(px[x, 0])
        samples.append(px[x, h - 1])
    for y in range(0, h, max(1, h // 40)):
        samples.append(px[0, y])
        samples.append(px[w - 1, y])
    samples.sort(key=lambda c: c[0] + c[1] + c[2])
    return samples[len(samples) // 2]


def rounded_mask(side, size, ratio=CORNER_RATIO, ss=4):
    """圆角矩形蒙版（先放大 ss 倍再缩，边缘更干净）"""
    m = Image.new("L", (side * ss, side * ss), 0)
    d = ImageDraw.Draw(m)
    r = int(side * ss * ratio)
    d.rounded_rectangle([0, 0, side * ss - 1, side * ss - 1], radius=r, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def make_icon(square, size, bg, rounded=True):
    """缩放到 size 并可选圆角裁切；底色用于被裁掉的角落（透明 PNG 用）"""
    img = square.resize((size, size), Image.LANCZOS).convert("RGBA")
    if not rounded:
        return img
    mask = rounded_mask(size, size)
    out = Image.new("RGBA", (size, size), bg + (255,))
    out.paste(img, (0, 0), mask)
    return out


def luminance_grid(img, n):
    """把图缩成 n x n 的灰度网格，返回 0-255 的二维列表"""
    g = img.convert("L").resize((n, n), Image.LANCZOS)
    px = g.load()
    return [[px[x, y] for x in range(n)] for y in range(n)]


def pearson(a, b):
    flat_a = [v for row in a for v in row]
    flat_b = [v for row in b for v in row]
    n = len(flat_a)
    ma = sum(flat_a) / n
    mb = sum(flat_b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(flat_a, flat_b))
    da = math.sqrt(sum((x - ma) ** 2 for x in flat_a))
    db = math.sqrt(sum((y - mb) ** 2 for y in flat_b))
    return num / (da * db) if da and db else 0.0


def ascii_art(grid, chars=" .:-=+*#%@"):
    """深色用密字符，浅色用疏字符"""
    out = []
    for row in grid:
        line = ""
        for v in row:
            line += chars[min(len(chars) - 1, (255 - v) * len(chars) // 256)]
        out.append(line)
    return out


def analyze(square, bg, rounded):
    img16 = make_icon(square, 16, bg, rounded)
    grid = luminance_grid(img16, 16)
    ref = luminance_grid(make_icon(square, 128, bg, rounded), 16)
    flat = [v for row in grid for v in row]

    colors = img16.convert("RGB").getcolors(maxcolors=1 << 20) or []
    colors.sort(reverse=True)
    uniq = len(colors)
    top_share = colors[0][0] / 256.0 if colors else 0

    bg_lum = sum(bg) / 3
    lums = [v for v in flat]
    lo, hi = min(lums), max(lums)
    subject = [v for v in lums if abs(v - bg_lum) > 24]
    contrast = (max(abs(v - bg_lum) for v in subject) if subject else 0)

    print("  16x16 灰度图（深色=密字符，浅色=空格）：")
    for line in ascii_art(grid):
        print("    |" + line + "|")

    print("  可读性指标：")
    print("    - 16px 下的唯一颜色数      : %d" % uniq)
    print("    - 最多的那种颜色占比       : %.0f%%" % (top_share * 100))
    print("    - 与底色明显不同的像素占比 : %.0f%%（主体占的面积）" % (len(subject) / 256.0 * 100))
    print("    - 主体与底色的最大亮度差   : %d/255" % contrast)
    print("    - 与 128px 参考图的结构相关性: %.3f（越接近 1 越说明缩到 16px 没散架）"
          % pearson(grid, ref))
    print("    - 灰度动态范围             : %d ~ %d" % (lo, hi))
    verdict = "能看出轮廓" if (contrast >= 40 and pearson(grid, ref) > 0.55) else "比较糊，主要是一个色块"
    print("    → 结论：%s" % verdict)
    return grid


def mask_svg(square, bg, size=16):
    """单色蒙版：按 16x16 明暗阈值生成方块（Safari pinned tab 用）"""
    grid = luminance_grid(make_icon(square, size, bg, True), size)
    bg_lum = sum(bg) / 3
    rects = []
    for y, row in enumerate(grid):
        for x, v in enumerate(row):
            # 与底色差异大的算"主体"（亮于底色的部分），蒙版里画成实心
            if abs(v - bg_lum) > 24 and v >= bg_lum:
                rects.append('<rect x="%d" y="%d" width="1" height="1"/>' % (x, y))
    body = "".join(rects) or '<rect x="2" y="2" width="12" height="12"/>'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" '
        'width="16" height="16" fill="#000">%s</svg>\n' % body
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plain", action="store_true", help="不裁形状（方形），用于对比")
    ap.add_argument("--analyze", action="store_true", help="只分析，不写文件")
    args = ap.parse_args()

    if not os.path.exists(SRC):
        print("找不到源图：%s" % SRC)
        return 1

    square = load_square(SRC)
    bg = dominant_bg(square)
    rounded = not args.plain

    print("源图      : %s" % os.path.relpath(SRC, ROOT))
    print("原尺寸    : %s" % (Image.open(SRC).size,))
    print("居中裁切后: %dx%d（正方形，未拉伸）" % square.size)
    print("底色      : rgb%s（取四边像素中位色）" % (bg,))
    print("形状      : %s" % ("圆角矩形裁切" if rounded else "方形（未裁）"))
    print("")

    analyze(square, bg, rounded)
    if args.analyze:
        return 0

    if not os.path.isdir(STATIC):
        os.makedirs(STATIC)

    written = []
    for size in (16, 32):
        name = "favicon-%dx%d.png" % (size, size)
        icon = make_icon(square, size, bg, rounded)
        icon.save(os.path.join(STATIC, name), "PNG", optimize=True)
        written.append((name, os.path.getsize(os.path.join(STATIC, name)), icon.size))

    apple = make_icon(square, 180, bg, rounded)
    # apple-touch-icon 不能有透明：压一层不透明底
    flat_bg = Image.new("RGB", apple.size, bg)
    flat_bg.paste(apple, (0, 0), apple)
    flat_bg.save(os.path.join(STATIC, "apple-touch-icon.png"), "PNG", optimize=True)
    written.append(("apple-touch-icon.png", os.path.getsize(os.path.join(STATIC, "apple-touch-icon.png")), flat_bg.size))

    ico = make_icon(square, 48, bg, rounded).convert("RGBA")
    ico.save(os.path.join(STATIC, "favicon.ico"), format="ICO", sizes=ICO_SIZES)
    written.append(("favicon.ico", os.path.getsize(os.path.join(STATIC, "favicon.ico")), (48, 48)))

    with open(os.path.join(STATIC, "safari-pinned-tab.svg"), "w", encoding="utf-8") as f:
        f.write(mask_svg(square, bg))
    written.append(("safari-pinned-tab.svg", os.path.getsize(os.path.join(STATIC, "safari-pinned-tab.svg")), (16, 16)))

    print("")
    print("已写入 static/：")
    for name, size, dim in written:
        print("  %-26s %6d B   %dx%d" % (name, size, dim[0], dim[1]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
