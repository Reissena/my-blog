# static/music —— 这里只放封面与歌词

**MP3 已经搬到 Cloudflare R2，仓库里不再存音频。**
（`.gitignore` 也加了 `static/music/*.mp3`，避免以后手滑又提交回来。）

| 项 | 值 |
| --- | --- |
| 桶名 | `blog-music` |
| 公开地址（自定义域名，推荐） | `https://music.yunblog.com.cn/<id>.mp3` |
| 备用公共地址（r2.dev） | `https://pub-067e64c6fa304deabf7aa80ea53eb989.r2.dev/<id>.mp3` |

远端 6 个对象（`<id>` 与 `data/music.yaml` 里的 `id` 完全一致）：

```
01-kachou-fuugetsu.mp3      13,948,536 B
02-again.mp3                 9,195,145 B
03-ray-of-light.mp3          9,118,007 B
04-hakugyokurou-kaidan.mp3  13,827,185 B
05-song-for-two.mp3          9,552,079 B
06-city-escape-plan.mp3      7,297,425 B
合计                        62,938,377 B（约 60.0 MiB）
```

## 这里保留什么

- `covers/<id>.jpg` —— 封面（当年从 mp3 的 ID3 标签里提的）。只有几百 KB，
  留在仓库可以同源加载、少一层依赖，所以没搬。
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

上传完跑一次 `python tools/prepare-music.py` 重新生成 `data/music.yaml`：
脚本里的 `R2_BASE` 就是公开基址，mp3 一律写成 `R2_BASE/<id>.mp3`，
封面与歌词仍写本地路径。重新运行不会把已有配置写坏（缺源时沿用现有值）。

## 为什么删文件不会让 .git 变小

`.git` 里仍然留着这 60 MB 的历史（提交一旦产生就删不掉）。
要让 `.git` 也瘦下来必须**改写历史 + 强推**，那会重写所有人的提交哈希，
所以没做。
