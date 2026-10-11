# YunX东方夜话

> A Chinese personal blog built with Hugo, served from Cloudflare Workers — hand-written front end, no third-party JS frameworks.

用 Hugo 生成的纯静态博客，跑在 Cloudflare Workers 上；服务端只有一段 Worker 脚本，只做页面访问打点。
前端交互（无刷新切页、音乐播放器、背景轮换、清晰度滑块、正文图片灯箱、阅读进度条）全部是自己写的原生 JS / CSS，仓库里没有 `package.json`。

线上地址：**<https://yunblog.com.cn>**

## 这个站有什么特别的

- **切页时音乐不会断** —— 为此自己写了一套 pjax（`assets/js/pjax.js`）：拦截站内链接，只替换 `<main class="main">`，页头、页脚、播放条都在它外面，永远不被换掉。
- **全站只有一个音频对象**（`new Audio()`，不在 DOM 里）：首页播放卡、页脚迷你播放条、`/music/` 页是它的三种视图。音频放在 Cloudflare R2，仓库里只留封面与歌词。
- **前端零第三方依赖**：脚本全部手写，由 Hugo 资源管线压缩、加指纹、带 SRI。注意：线上页面确实有 **1 个**外链脚本 —— Cloudflare 在代理层自动注入的 Web Analytics beacon，仓库里找不到它（见 [`docs/技术总览.md`](docs/技术总览.md) §1.3）。
- **左下角「背景清晰度」滑块**：遮罩不透明度 = 100 − 清晰度，默认档写在 `hugo.toml` 的 `params.bgClarityDefault`。
- **正文图片点开看大图**：原生 `<dialog>` + `showModal()`（焦点陷阱、Esc 关闭、遮罩层全是浏览器给的），只在文章正文里生效 —— 封面图 / 头像 / 图标排 / 播放器封面都不受影响。
- **阅读进度条**：只在 `/posts/` 下的正文页出现，粘在粘性页头的下沿（z-index 比页头低一层，永远不会盖住导航），pjax 换页即归零。
- **`/site/` 站点数据页**：文章数 / 音乐数 / 已运行天数都是**构建时**算的，页面上不做任何实时请求；累计访问量由构建前的一步单独查一次 Cloudflare 写进数据文件（配了仓库 Secret 才显示，查不到就整张卡片不渲染）。只公开汇总量，没有任何访问者层面的数据。
- **服务端访问统计**（Worker + Analytics Engine）只数页面、**不存原始 IP**：去重指纹是 `SHA-256(IP + UA + 当天盐)` 的前 32 位，盐每天换。

## 技术栈与架构

| 层 | 用了什么 |
| --- | --- |
| 生成 | Hugo **0.167.0 extended** + PaperMod（git submodule；主题源码不改，要改就在项目根同名覆盖） |
| 样式 | 自己写的 `assets/css/extended/fluent.css`（Win11 Fluent 毛玻璃观感） |
| 托管 | Cloudflare Workers 静态资源（`[assets] directory = "./public"`） |
| 服务端 | `worker/index.mjs`，只做页面访问打点 |
| 内容管理 | Pages CMS 网页后台（`.pages.yml` 决定后台里能改什么） |

```
写文章：网页后台 ─保存─▶ GitHub commit ┐
写代码：本地改 ─git push──────────────┤
                                      ▼
                    GitHub Actions：hugo --minify --gc → ./public
                                      ▼
        Cloudflare Workers ─┬─ 静态资源 ./public（原样返回）
                            └─ worker/index.mjs（先返回页面，再打点）
                                      ▼
                             https://yunblog.com.cn
```

## 本地跑起来

仓库旁边自带一份与 CI 同版本的 Hugo（`..\tools\hugo\hugo.exe`）：

```powershell
# 缓存目录必须写「绝对路径」，Hugo 0.167 用相对路径会直接启动失败
$env:HUGO_CACHEDIR = "<仓库绝对路径>\.hugo_cache"

..\tools\hugo\hugo.exe server -D        # 预览 http://localhost:1313/（-D 连草稿一起渲染）
..\tools\hugo\hugo.exe --minify --gc    # 只构建到 ./public，不启服务
```

构建要 exit 0、输出里没有 `ERROR`。改过 `worker/` 或 `wrangler.toml` 的话，Hugo 根本不编译它们，
还要多跑一步 `node tools/test-pageview.mjs`（57 项断言）。

## 怎么部署

**推到 `main` 就自动上线，约 1 分钟。** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
会拉代码（含 submodule）、装 Hugo、跑 `hugo --minify --gc`，再用 wrangler 把 `./public` 与
`worker/index.mjs` 一起发布到 Cloudflare Workers。`main` 就是生产环境，没有预览、没有灰度；
手动发布是本地构建后执行 `npx wrangler@4 deploy`。

远端走 SSH，**永远不强推** —— 站主随时可能在网页后台编辑文章，推送被拒时用
`git fetch origin` + `git rebase origin/main` 叠上去再推。

## 项目结构

```
hugo.toml          站点总配置
wrangler.toml      Worker 配置（脚本入口 + 资源目录 + 统计绑定）
worker/index.mjs   唯一的服务端逻辑：页面访问打点
.pages.yml         网页后台能改什么
content/           页面与文章（site.md = /site/ 站点数据页）
data/              清单：music.yaml、skills.yaml
layouts/           模板（覆盖主题同名文件）
assets/            fluent.css、全部 JS、走资源管线的图
static/            原样复制到 public/
tools/             一次性脚本 + worker 自测 / 查询
docs/              技术文档（见下）
themes/PaperMod    主题（submodule，不改）
```

## 文档导航

仓库的文档比代码多，按「你要干什么」挑一份看：

| 你想干什么 | 看哪份 | 写给谁 |
| --- | --- | --- |
| 写文章 / 换图 / 改公告 | [`后台使用说明.md`](后台使用说明.md) | 不写代码的站主 |
| 改代码、弄清某个模块为什么长这样 | [`docs/技术总览.md`](docs/技术总览.md) | 接手的人 / 开发 agent |
| 给 AI 派活 | [`AGENTS.md`](AGENTS.md) | 开发 agent（动手前必读） |
| 搭一套同款网页后台 | [`CMS-SETUP.md`](CMS-SETUP.md) | 搭建者 |
| 部署、域名、国内访问 | [`DEPLOY.md`](DEPLOY.md) | 搭建者 |
| 访问统计的口径 / 怎么看 / **`/site/` 上那个访问量怎么来的** | [`docs/访问统计.md`](docs/访问统计.md)（§7.5） | 站主 + 改统计的人 |

## 几个值得说的实现细节

- **Speculation Rules 只用 `prefetch`，绝不用 `prerender`**：prerender 会在后台真正渲染目标页并整个替换文档，音频会立刻断，pjax 的前提也没了。
- **背景图每 30 秒换一张**，两层交叉淡入；轮换池 = 默认背景图 + `assets/images/bg/` 下的图（当前共 8 张），加图只要丢进目录。
- **`run_worker_first = true` 不能删**：Workers 默认「静态资源优先」，命中文件的请求根本不会执行 Worker 脚本，打点会一次都不触发、而且不报错。
- **打点与页面响应彻底解耦**：先取响应，再异步记一笔，最后原样返回那个响应对象 —— 统计坏了只会少一行数据，不会让访客看到白屏。
- **默认清晰度只有 `hugo.toml` 一处**：模板注入 `--fc-clarity`，滑块的 `<input value>` 也读它；滑块故意不写 `localStorage`。
- **灯箱的对话框建一次、用一辈子**：它挂在 `<body>` 上（在 pjax 的替换范围之外），所以连着切多少页都只有那一个 `dialog` —— 「不会重复弹出」是结构决定的，不是靠计数器。
- **进度条的位置是量出来的**：页头高度实测在 1280px 下是 63px、1024px 是 99px、≤880px 折行后是 113px，写死任何一个值都会错两档。
- **`/site/` 的「已运行天数」与页脚那句「本站已稳定运行」共用同一个 partial**（`_partials/site_uptime.html`）：起算日改 `hugo.toml` 一处，两边一起变。
- **构建时唯一会碰网络的那一步是独立的**：`tools/fetch-site-stats.mjs` 查一次累计访问量、写 `data/site_stats.yaml`（不进仓库），Hugo 随后只读文件。查询失败 = 不写文件 = `/site/` 少一张卡片，**永远不会变成构建失败**；令牌走 `env:` 传入，日志里不打印。
- 36 条已经踩过的坑记在 [`docs/技术总览.md`](docs/技术总览.md) §5.3，动手前扫一眼能省一半返工。
