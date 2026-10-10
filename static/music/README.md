# static/music —— 这里只放封面与歌词

**MP3 已经搬到 Cloudflare R2，仓库里不再存音频。**
（`.gitignore` 也加了 `static/music/*.mp3`，避免以后手滑又提交回来。）

| 项 | 值 |
| --- | --- |
| 桶名 | `blog-music` |
| 公开地址（自定义域名，推荐） | `https://music.yunblog.com.cn/<id>.mp3` |
| 备用公共地址（r2.dev） | `https://pub-067e64c6fa304deabf7aa80ea53eb989.r2.dev/<id>.mp3` |

远端 12 个对象（`<id>` 与 `data/music.yaml` 里的 `id` 完全一致）：

```
01-kachou-fuugetsu.mp3       13,948,536 B
02-again.mp3                  9,195,145 B
03-ray-of-light.mp3           9,118,007 B
04-hakugyokurou-kaidan.mp3   13,827,185 B
05-song-for-two.mp3           9,552,079 B
06-city-escape-plan.mp3       7,297,425 B
07-beautiful-trick.mp3       12,949,302 B     ← 2026-10-10 新增
08-youre-the-shine.mp3       12,803,103 B     ← 2026-10-10 新增
09-cant-look-away.mp3        15,020,437 B     ← 2026-10-10 新增
10-one-more-time.mp3         13,481,321 B     ← 2026-10-10 新增
11-the-sun-and-moon.mp3       8,739,130 B     ← 2026-10-10 新增
12-to-you.mp3                 7,851,396 B     ← 2026-10-10 新增
合计                        133,783,066 B（约 127.6 MiB）
```

## 这里保留什么

- `covers/<id>.jpg`（PNG 源图则是 `<id>.png`）—— 封面（当年从 mp3 的 ID3 标签里提的）。
  只有几百 KB，留在仓库可以同源加载、少一层依赖，所以没搬。
  ⚠️ 同专辑的两首歌封面**字节完全相同**（07/08 都是《Rebirth Story》、09/10 都是
  《Rebirth Story II》）—— 那是正常现象，不是复制粘贴出来的占位图。
- `lyrics/<id>.lrc` —— 歌词，同上。

## 重新上传 / 换歌

```bash
# 单个文件（--content-type 一定要是 audio/mpeg，否则个别浏览器不播）
npx wrangler r2 object put blog-music/01-kachou-fuugetsu.mp3 \
  --file "C:\Users\Administrator\Desktop\1音乐\xxx.mp3" \
  --content-type audio/mpeg --remote

# 看桶与域名绑定
npx wrangler r2 bucket list
npx wrangler r2 bucket domain list blog-music
```

⚠️ **上传之前不要先 `curl` 那个 URL 去「探活」**。R2 自定义域名走 Cloudflare 边缘缓存，
响应头里的 `Cache-Control: max-age=14400`（4 小时）**连 404 一起缓存**——
上传前探一次，对象传上去了，边缘仍会拿旧 404 回你（实测 2026-10-10 就踩了：
`wrangler r2 object put` 明明成功，`https://music.yunblog.com.cn/07-beautiful-trick.mp3`
还是 `404 text/html`，而带 `?cb=<时间戳>` 的同名请求立刻 `206 audio/mpeg`）。
要确认「有没有重名」就直接看桶，别用公开 URL 探。

上传完跑一次 `python tools/prepare-music.py` 重新生成 `data/music.yaml`：
脚本里的 `R2_BASE` 就是公开基址，mp3 一律写成 `R2_BASE/<id>.mp3`，
封面与歌词仍写本地路径。重新运行不会把已有配置写坏（缺源时沿用现有值）。

## 为什么删文件不会让 .git 变小

`.git` 里仍然留着这 60 MB 的历史（提交一旦产生就删不掉）。
要让 `.git` 也瘦下来必须**改写历史 + 强推**，那会重写所有人的提交哈希，
所以没做。
