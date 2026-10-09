---
title: 在文章里嵌 B 站视频（bilibili 短代码）
date: 2026-10-09
draft: false
tags:
  - Hugo
  - B站
  - 短代码
summary: 视频不自己托管：一行短代码把 B 站播放器嵌进文章，16:9 自适应，还带圆角容器。
cover:
  image: /images/2d7b4dae6365635c125a766b18ee0caa.jpg
  alt: 紫粉渐变底 + 播放按钮图形的封面图
---
这篇文章演示怎么在文章里嵌 B 站视频。视频托管在 B 站，本站只负责放一个 16:9 的播放器，  
所以不占服务器流量、不用自己转码，手机上也能正常看，提醒自己用。

## 最简写法

在 Markdown 正文里写一行：

```text
{{</* bilibili BV1xx411c7mD */>}}
```

渲染出来就是下面这样（示例用的是 B 站官方的测试视频，换成你自己的 BV 号即可）：

{{< bilibili bvid="BV1xx411c7mD" caption="示例：bilibili 官方测试视频（字幕君交流场所）" >}}

## 换成自己的视频

BV 号在 B 站视频页的地址栏里，形如 `https://www.bilibili.com/video/BV1xx411c7mD/`，
`BV` 开头那一串字母数字就是。

## 可选参数


| 参数 | 说明 | 默认值 |
| ------------------ | --------------- | ----------- |
| `bvid`（或第 1 个位置参数） | 视频的 BV 号，**必填** | — |
| `p` | 第几个分 P | 站方默认（第 1 P） |
| `autoplay` | `1` 打开自动播放 | `0` |
| `danmaku` | `0` 关闭弹幕 | 站方默认 |
| `caption` | 播放器下方的图注 | 无 |


带参数的写法（注意：**位置参数和命名参数不能混用**，要么全用命名参数，要么只用第一个位置参数）：

```text
{{</* bilibili bvid="BV1xx411c7mD" p="1" autoplay="0" caption="第一期：开箱" */>}}
```

> 小提示：想同时展示短代码本身和渲染结果时，用 `{{</* … */>}}` 把短代码包起来，
> 这样它会被当成普通文本显示，而不是被执行（本文上半部分就是这么写的）。

## 实现说明

- 短代码文件：`layouts/_shortcodes/bilibili.html`
- 播放器地址：`https://player.bilibili.com/player.html?bvid=…&autoplay=0&high_quality=1`
- 外层容器 `.fc-video` 用 CSS 的 `aspect-ratio: 16 / 9` 做自适应，样式在
`assets/css/extended/fluent.css`
- `iframe` 带 `loading="lazy"`，首屏不会因为视频变慢

## 一点取舍

- 优点：不用自己托管视频，B 站自带多码率与 CDN，国内外都能看；
- 缺点：播放器是 B 站的域名，页面会加载 `player.bilibili.com` 的脚本与样式；
非常在意隐私或加载速度时，可以考虑先把视频传到 B 站、只在文章里放一个**链接 + 封面图**。

