# DEPLOY.md —— 上线部署说明

> 适用仓库：本仓库根目录（与 `hugo.toml` 同级）。
> 站点：Hugo + PaperMod 中文博客，带「前端门禁式」登录模块。
> 本文所有命令都以**仓库根目录**为当前目录，可直接复制执行。

---

## 0. 现状速查

> **2026-10-09 改版**：站点定位收敛为「个人主页 + 文章」，**已整体移除登录 / 注册 / 会员区
> 与前端门禁**（相关文件与 `hugo.toml` 的 `[params.auth]` 全部删除，详见 §6）。
> 同时改成 Windows 11 / WinUI 3（Fluent）观感的毛玻璃界面，新增 B 站视频短代码与
> Pages CMS 网页后台配置。

| 项目 | 值 |
| --- | --- |
| 站点 | **YunX东方夜话** |
| 站点根目录 | 仓库根（有 `hugo.toml` 的那一层） |
| baseURL | `https://yunblog.com.cn/`（线上就是这个域名） |
| 主题 | PaperMod，以 **git submodule** 挂在 `themes/PaperMod`（无 Hugo Modules） |
| Hugo 版本要求 | **≥ 0.158.0 extended**（`hugo.toml` 用了 `locale`）<br>本仓库旁边自带一份：`..\tools\hugo\hugo.exe`（v0.167.0 extended，已验证） |
| 构建命令 | 见 §1.3（`HUGO_CACHEDIR` 必须是绝对路径） |
| 产物目录 | `public/`（已在 `.gitignore` 里，不入库） |
| 主栏目 | `mainSections = ["posts"]` |
| 顶部导航 | 首页 / 文章 / 归档 / 标签 / 搜索（`hugo.toml` 的 `[[menu.main]]`） |
| 前端风格 | Windows 11 / WinUI 3（Fluent）毛玻璃 —— `assets/css/extended/fluent.css` |
| 背景图 | `assets/images/background.jpg`（1920×1045，质量 80，约 415 KB） |
| 视频 | 不自己托管，用 `{{< bilibili BV… >}}` 嵌 B 站 —— `layouts/_shortcodes/bilibili.html` |
| 网页后台 | Pages CMS —— `.pages.yml` + `CMS-SETUP.md` |
| 托管 | Cloudflare Workers 静态资源（见 §3.2b） |

本项目自己写的（覆盖主题的）文件：

```
layouts/index.html                       # 首页：作者信息卡 + 文章卡片列表
layouts/list.html                        # 栏目 / 标签列表页
layouts/single.html                      # 文章详情页（毛玻璃卡片）
layouts/_partials/header.html            # Fluent 页头 + Segmented 分段导航
layouts/_partials/fluent_card.html       # 文章卡片（首页/列表共用）
layouts/_partials/fluent_pager.html      # 分页器
layouts/_partials/extend_head.html       # 注入背景图 URL（主题预留扩展点）
layouts/_shortcodes/bilibili.html        # B 站视频短代码
assets/css/extended/fluent.css           # Fluent 样式（自动并入主题样式表）
assets/images/background.jpg             # 整页背景图
.pages.yml / CMS-SETUP.md                # 网页后台（Pages CMS）配置与说明
```

> 原则：**主题源码一律不动**。Hugo 会用项目根的 `layouts/`、`assets/` 覆盖
> `themes/PaperMod` 里的同名文件，所以升级主题不会冲突（见 §7.3）。

---

## 1. 本地开发与预览

### 1.1 最常用

```bash
# 仓库根目录
hugo server -D                # -D 连草稿一起渲染；默认 http://localhost:1313/
```

如果本机装了 Hugo 但版本不对，本仓库旁边自带了一份可执行文件（Windows）：

```powershell
..\tools\hugo\hugo.exe server -D
```

### 1.2 让同一局域网的手机 / 另一台电脑也能访问

```bash
hugo server -D --bind 0.0.0.0 --baseURL http://192.168.1.13:1313/ --disableFastRender
```

把 `192.168.1.13` 换成你自己机器的局域网 IP（`ipconfig` 查看）。然后访问
`http://192.168.1.13:1313/`。

> **小知识**：`http://192.168.x.x` 属于**非安全上下文**，浏览器不提供 `crypto.subtle`。
> 登录模块检测到这一点会自动切到内置的纯 JS PBKDF2 实现，所以局域网访问也能正常登录
> （代价是校验阶段大约多花 1 秒）。用 `http://localhost:1313/` 或线上 HTTPS 时走的是
> 原生 Web Crypto，几乎瞬间完成。

### 1.3 只做构建、不启服务

```powershell
# 缓存目录必须给「绝对路径」——Hugo v0.167 起 HUGO_CACHEDIR 用相对路径会直接失败：
#   ERROR failed to create config from result: failed to decode "caches":
#   ".hugo_cache\my-blog" must resolve to an absolute directory
$env:HUGO_CACHEDIR = "D:\dsh\个人博客\my-blog\.hugo_cache"
..\tools\hugo\hugo.exe --minify --gc

# 其它常用写法
..\tools\hugo\hugo.exe --minify --gc --cleanDestinationDir   # 顺手清理 public/ 里的旧文件
..\tools\hugo\hugo.exe --minify -d dist                      # 换产物目录
..\tools\hugo\hugo.exe --minify --baseURL https://yunblog.com.cn/   # 临时覆盖 baseURL
..\tools\hugo\hugo.exe server --renderToMemory               # 不写磁盘，纯预览
```

### 1.4 本地自查清单

- [ ] 构建退出码为 0，输出里没有 `ERROR`（`WARN` 只有主题的弃用提示，可以忽略）
- [ ] 首页 = 作者信息卡 + 文章卡片列表；顶部导航是**分段式**：首页 / 文章 / 归档 / 标签 / 搜索
- [ ] **页面上任何地方都没有「登录 / 注册 / 会员区」字样**（见 §2 第 2 步的检查命令）
- [ ] 背景图整页铺满、滚动时固定不动，前景是半透明毛玻璃卡片
- [ ] 右上角可手动切换浅色 / 深色；系统切深色时也能自动跟随
- [ ] 文章详情页正文行高 1.8，代码块圆角，引用块与表格样式正常
- [ ] `/posts/bilibili-video-demo/` 里的 B 站播放器是 16:9 自适应
- [ ] 窗口 ≤ 768px 时导航横向滚动、卡片单列

---

## 2. 部署前必做

1. **确认 baseURL**（`hugo.toml` 顶部）：线上域名是 `https://yunblog.com.cn/`，结尾的斜杠不要漏。
   验证：`Get-ChildItem public -Recurse -File | Select-String 'workers.dev'`（应该没有输出）。
2. **确认没有互动模块残留**：

   ```powershell
   Get-ChildItem public -Recurse -File | Select-String -Pattern '登录|注册|会员' -List   # 应为空
   Test-Path public\login, public\register, public\private                                # 三个都应为 False
   ```

3. **本地构建**（见 §1.3），确认 `public/` 是最新的产物。
4. **提交并推送**（要用 Pages CMS 或让平台自动构建，就必须推到 GitHub）：

   ```bash
   git add -A
   git commit -m "feat: Fluent 风格改版 + B 站短代码 + Pages CMS 配置"
   git push origin main
   ```

5. **部署**：见 §3.2b（Cloudflare Workers 静态资源）。
   只想本地看效果、不部署的话，跳过第 4、5 步。

---

## 3. 四种托管方式（选一个即可）

### 3.0 先看结论

| | GitHub Pages | Cloudflare Pages | Netlify | Vercel |
| --- | --- | --- | --- | --- |
| 免费额度 | 公开仓库免费（1 GB / 100 GB 月流量） | **无限流量、无限请求** | 100 GB 月流量 | 100 GB 月流量 |
| 国内访问 | ❌ 经常打不开（DNS 污染 + 丢包） | ⚠️ 一般（走境外节点，比 GitHub 好） | ⚠️ 一般 | ⚠️ 一般 |
| 构建速度 | 中等 | 快 | 快 | 快 |
| 子模块(submodule) | 需在 workflow 里显式 `submodules: recursive` | 自动 | 自动 | 自动 |
| 自定义域名 + HTTPS | 支持（自动证书） | 支持（自动证书） | 支持（自动证书） | 支持（自动证书） |
| 适合谁 | 已有 GitHub 仓库、只求省事 | **首选**：免费额度大、部署简单 | 想要表单/身份/函数等附加能力 | 前后端一体、已用 Vercel |
| 本项目推荐度 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

> 国内读者为主的话，四家都只是「能打开」级别，正式方案看 §5。

---

### 3.1 GitHub Pages

#### 方式 A：用 Actions 部署（推荐，本仓库已带 workflow）

仓库里已经放了 `.github/workflows/hugo.yml`（全文如下，删了也能照抄回来）：

```yaml
name: Deploy Hugo site to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

defaults:
  run:
    shell: bash

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      HUGO_VERSION: 0.167.0
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 0

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: ${{ env.HUGO_VERSION }}
          extended: true

      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v5

      - name: Build
        run: hugo --minify --gc --baseURL "${{ steps.pages.outputs.base_url }}/"

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

开启步骤：

1. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
2. 推送到 `main`，等 Actions 跑完，页面地址会打印在 workflow 的 `deploy` 步骤里。
3. 访问 `https://<用户名>.github.io/<仓库名>/`（项目站点）或 `https://<用户名>.github.io/`（用户站点）。

> 说明：`--baseURL "${{ steps.pages.outputs.base_url }}/"` 会自动适配「用户站点 / 项目站点」两种路径，
> 所以即使 `hugo.toml` 里的 baseURL 没改，线上的链接也是对的。
> 如果仓库默认分支是 `master`，把 `branches: [main]` 改掉。

#### 方式 B：本地构建 + 推到 gh-pages 分支

不想用 Actions 的话：

```bash
hugo --minify --baseURL "https://<用户名>.github.io/<仓库名>/"
cd public
git init && git add -A && git commit -m "deploy"
git branch -M gh-pages
git remote add origin git@github.com:<用户名>/<仓库名>.git
git push -f origin gh-pages
```

然后在 **Settings → Pages → Source** 选 **Deploy from a branch → gh-pages / (root)**。

**取舍**：方式 A 每次推送自动重建、日志可查，推荐；方式 B 不消耗 Actions 额度，但要手动跑，
且 `public/` 被 `.gitignore` 忽略，容易搞混。

---

### 3.2 Cloudflare Pages（最省事的推荐）

1. 代码推到 GitHub / GitLab。
2. 打开 <https://dash.cloudflare.com/> → **Workers & Pages → Create → Pages → Connect to Git**，
   授权并选中这个仓库。
3. 构建设置：

   | 字段 | 值 |
   | --- | --- |
   | Framework preset | `Hugo` |
   | Build command | `git submodule update --init --recursive && hugo --minify` |
   | Build output directory | `public` |
   | Root directory | 仓库根（留空） |
   | 环境变量 | `HUGO_VERSION` = `0.167.0`（必须 ≥ 0.158.0） |

   > `git submodule update --init --recursive` 是为了拿到 `themes/PaperMod`。
   > 直接用 `hugo --minify` 一般也能成功（Cloudflare 会带上子模块），加上更保险。

4. **Save and Deploy**，几十秒后会给你 `https://<项目名>.pages.dev`。
5. 以后每次 `git push` 自动重新构建；PR 还会生成预览地址。

**取舍**：免费版**不限流量、不限请求数**，带宽也够用；构建快、预览方便；国内速度比 GitHub Pages 好、
但仍走境外节点。注意 Cloudflare Pages 的 `_headers` / `_redirects` 需要放在 `static/` 目录里才会随构建输出。

---

### 3.2b Cloudflare Workers 静态资源（**当前站点就是这么部署的**，地址 `*.workers.dev`）

Workers 现在也支持直接托管静态资源（Static Assets），比 Pages 更灵活，而且自带 `wrangler` 一键发布。
当前线上地址是 `https://my-blog.3307590541.workers.dev/`，就是这个路子。

1. 装 wrangler 并登录：

   ```bash
   npm i -D wrangler
   npx wrangler login
   ```

2. 仓库根加一个 `wrangler.toml`（**注意别提交 `public/`**）。
   如果你是在 Cloudflare 控制台里「连 Git 仓库」构建的（仓库里没有 `wrangler.toml`），
   跳过这一步，直接在控制台填构建命令与输出目录即可：

   ```toml
   name = "my-blog"
   compatibility_date = "2026-01-01"

   [assets]
   directory = "./public"
   # 目录里没有的路径不要回落到 index.html，保持 Hugo 的 404
   not_found_handling = "404-page"
   ```

3. 构建 + 发布：

   ```bash
   $env:HUGO_CACHEDIR = "D:\dsh\个人博客\my-blog\.hugo_cache"   # 必须绝对路径，见 §1.3
   ..\tools\hugo\hugo.exe --minify --cleanDestinationDir
   npx wrangler deploy
   ```

   输出里会给出 `https://my-blog.<账号>.workers.dev`。

4. 之后每一次内容更新都是「构建 + deploy」两条命令；想改成推送自动发布，
   可以在 Cloudflare 控制台给这个 Worker 绑定 Git 仓库（Workers Builds），
   构建命令填 `hugo --minify`，环境变量 `HUGO_VERSION=0.167.0`（缓存目录用绝对路径，见 §1.3）。

5. **绑定自定义域名**（做 Cloudflare Access 的前置条件）：
   控制台 → `Workers & Pages` → 选中该 Worker → `Settings → Domains & Routes → Add → Custom domain`。
   顺手可以把 `*.workers.dev` 这个默认域名**禁用**，避免别人绕过 Access 直连源站。

---

### 3.3 Netlify

1. <https://app.netlify.com/> → **Add new site → Import an existing project** → 选仓库。
2. 构建设置同上：build command `git submodule update --init --recursive && hugo --minify`，
   publish directory `public`，环境变量 `HUGO_VERSION=0.167.0`。
3. 也可以在仓库根放 `netlify.toml`，省得在网页上点：

   ```toml
   [build]
     command = "git submodule update --init --recursive && hugo --minify"
     publish = "public"

   [build.environment]
     HUGO_VERSION = "0.167.0"

   [[headers]]
     for = "/js/*"
     [headers.values]
       Cache-Control = "public, max-age=31536000, immutable"
   ```

4. 部署完拿到 `https://<站点名>.netlify.app`。

**取舍**：免费版 100 GB/月流量，自带表单收集、身份认证（Identity）、Serverless Functions。国内速度一般。


---

### 3.4 Vercel

1. 仓库里放一个 `vercel.json`：

   ```json
   {
     "buildCommand": "git submodule update --init --recursive && hugo --minify",
     "outputDirectory": "public",
     "framework": null,
     "build": {
       "env": {
         "HUGO_VERSION": "0.167.0"
       }
     }
   }
   ```

   > Vercel 的 Hugo 支持是社区维护的；如果构建镜像里没有 Hugo，把 `HUGO_VERSION` 换成
   > 官方文档当前支持的版本，或改用 Vercel 的 **Build & Output Settings** 自定义构建镜像。

2. <https://vercel.com/new> → Import Git Repository → 选仓库 → Deploy。
3. 得到 `https://<项目名>.vercel.app`。

**取舍**：DX 最好、Preview 部署最舒服，但国内访问同样一般；Hugo 不是 Vercel 的一等公民，
版本钉死比较重要。个人博客用 Cloudflare Pages 通常更划算。

---

## 4. 自定义域名 + HTTPS

四家的套路基本一致：**加域名 → 配 DNS → 等证书**。

### 4.1 通用步骤

1. 在托管平台里添加自定义域名（Cloudflare Pages / Netlify / Vercel：`Settings → Domains`；
   GitHub Pages：`Settings → Pages → Custom domain`）。
2. 到域名注册商（阿里云 / 腾讯云 / Cloudflare / Namecheap…）改 DNS：

   | 场景 | 记录类型 | 主机记录 | 记录值 |
   | --- | --- | --- | --- |
   | 根域名 `blog.example.com` 给 Cloudflare Pages | CNAME | `blog` | `<项目名>.pages.dev` |
   | 根域名给 Netlify | CNAME | `blog` | `<站点名>.netlify.app` |
   | 根域名给 GitHub Pages（项目站点） | CNAME | `blog` | `<用户名>.github.io` |
   | 裸域 `example.com` 给 GitHub Pages | A | `@` | `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153` |
   | 裸域给 Cloudflare | — | `@` | 把域名 NS 托管到 Cloudflare 后用它给的 CNAME Flattening |

   > `blog.example.com` 这类**子域名**用 CNAME 最简单；**裸域**（`example.com`）用 CNAME 会违反
   > DNS 规范，Cloudflare 的 CNAME Flattening 或 GitHub 的 A 记录是常见解法。

3. **等证书**：三家（Cloudflare / Netlify / Vercel）会在 DNS 生效后自动签发 Let's Encrypt 证书，
   通常 1～15 分钟；GitHub Pages 需要在 **Settings → Pages → Enforce HTTPS** 打勾。
4. **HTTPS 强制跳转**：
   - Cloudflare：`SSL/TLS → Edge Certificates → Always Use HTTPS = On`，加密模式选 **Full (strict)**
   - Netlify：`Domain management → HTTPS → Force HTTPS`
   - Vercel：`Settings → Domains` 打开 `Redirect to HTTPS`（默认开）
   - GitHub Pages：勾 Enforce HTTPS
5. 改 `hugo.toml` 的 `baseURL` 为新域名（结尾带 `/`），推送。

### 4.2 关键提醒

- **DNS 生效前别急着点「验证」**，`dig blog.example.com` / `nslookup` 能查到再去平台点重试。
- 换域名后**旧链接会 404**：可以在平台配 301 跳转（Cloudflare 的 Redirect Rules、
  Netlify 的 `_redirects`、Vercel 的 `redirects`），或者在 `hugo.toml` 里配 `aliases`。
- 域名要开 **自动续费**，否则证书也会跟着一起过期。
- 一旦要用**中国大陆节点**（CDN 回源到国内），域名必须完成 **ICP 备案**，见 §5.3。

---

## 5. 国内访问方案

### 5.1 现实情况

| 方案 | 国内体验 | 需要备案 |
| --- | --- | --- |
| GitHub Pages | 差，经常 DNS 污染 / 连不上 | 否 |
| Cloudflare / Netlify / Vercel 免费版 | 一般，能开但慢（200～800 ms 首字节起） | 否 |
| 对象存储（香港/新加坡）+ 全球加速 | 较好 | 否 |
| **对象存储 + 国内 CDN** | **最好** | **是** |

### 5.2 对象存储 + CDN（不备案可先用海外区域）

以阿里云 OSS / 腾讯云 COS 为例（思路通用，七牛、又拍云、B2 类似）：

```bash
# 1) 本地构建
hugo --minify --gc --cleanDestinationDir

# 2a) 阿里云：安装 ossutil 后
ossutil cp -r public/ oss://my-blog-bucket/ --update --delete

# 2b) 腾讯云：安装 coscmd 后
coscmd upload -r public/ / --ignore "*.DS_Store"

# 2c) 通用：rclone（先 rclone config 配好 remote）
rclone sync public/ myremote:my-blog-bucket --progress

# 3) 回源刷新 CDN 缓存（阿里云）
#    CDN 控制台 → 刷新预热 → 刷新目录 https://blog.example.com/
#    ossutil 也支持：ossutil refresh-cdn --object 'https://blog.example.com/'
```

要点：

- 存储桶**权限设为公共读**（或私有 + CDN 回源授权），否则出现 403。
- **开启静态网站托管**，把默认首页设为 `index.html`，404 页设为 `404.html`（Hugo 已生成）。
  但注意：静态托管模式下 `/private/` 这类「目录 + index.html」的访问由 CDN 处理，
  Hugo 的 `pretty URLs` 依赖服务端把 `/private/` 映射到 `/private/index.html`——大多数对象存储
  和 CDN 都支持「默认首页 + 目录索引」，如不支持请开启。
- CDN 缓存规则建议：`/js/*`、`/assets/*`、`/css/*` 缓存 1 年（Hugo 带指纹，可放心）；
  `/*.html` 缓存 5～10 分钟；**每次发布后刷新 HTML 缓存**。
- 给 CDN 配好 HTTPS 证书（阿里云/腾讯云可申请免费 DV 证书，或用 Let's Encrypt 自动续期）。
- 也可以直接上 **Cloudflare Pages + 自定义域名**：虽然走境外节点，但零运维、免备案，
  对「能打开就行」的需求足够。

### 5.3 备案提醒（重要）

- 只要域名**解析到中国大陆境内**的服务器 / CDN / 对象存储，就必须完成 **ICP 备案**（工信部要求）。
  未备案的域名用国内 CDN 会被直接拦掉。
- 个人可以备案：需要身份证、域名已完成实名认证（通常要等 3 天）、以及一台国内云服务器
  （多数云厂商要求买 3 个月以上的实例才能申请备案服务码）。
- 流程：云厂商备案系统提交 → 厂商初审（1～2 天）→ 管局审核（约 3～20 个工作日）。
- 备案期间可以把站点先放在 Cloudflare Pages 的 `*.pages.dev` 上，备案通过后再切 DNS。
- 备案号下来后建议在页脚展示（`hugo.toml` 的 `[params.footer]` 或 `layouts/_partials/footer.html` 覆盖）。

---

## 6. 已移除的功能（2026-10-09）

早期版本带一套「前端门禁式」登录 / 注册 / 会员区：`content/private/`、`content/login.md`、
`content/register.md`、`layouts/login.html`、`layouts/register.html`、`layouts/private/`、
`assets/js/auth.js`、`assets/css/extended/auth.css`，以及 `hugo.toml` 里的 `[params.auth]`
与 `[[params.auth.users]]` 账号表。

按站点新定位（**个人主页 + 文章，不要任何互动功能**），以上文件与配置**已全部删除**，
现在构建产物里没有任何登录 / 注册 / 会员页面，也没有任何门禁脚本。

需要查旧实现时看 git 历史：

```bash
git log --oneline
git show 6e3ff5b --stat            # 引入登录模块的那次提交
git show 6e3ff5b:layouts/login.html
```

> **以后真的需要「只有特定人能看到的内容」怎么办？**
> 不要再走前端门禁那条路 —— 纯静态站的前端门禁挡不住 `curl`，内容本来就在公开文件里。
> 正确做法是在**边缘**拦截：Cloudflare Zero Trust → Access → Applications →
> Add an application → Self-hosted → 填域名 + path → 策略 `Allow` + `Emails`，
> 然后用 `curl -sI https://你的域名/私有路径/` 确认返回 302（而不是 200）。
> 或者更省事：这类内容干脆别放进这个站点。
---

## 7. 日常维护

### 7.1 写一篇新文章

本地新建（推荐，标题想叫什么就叫什么）：

```powershell
..\tools\hugo\hugo.exe new content/posts/我的新文章.md
```

或者直接建文件，front matter 照抄 `content/posts/hello-world.md`：

```yaml
---
title: "标题"
date: 2026-10-09
draft: false
tags: ["Hugo", "折腾"]
categories: ["随笔"]
summary: "列表卡片上显示的一两句话摘要。"
---
```

- `draft: true` 的文章默认不发布（本地 `hugo server -D` 仍能看到）。
- **嵌 B 站视频**：正文里写 `{{< bilibili BV1xx411c7mD >}}`，详见 `content/posts/bilibili-video-demo.md`。
- **封面图**：图片放进 `static/images/`，front matter 里写 `cover: { image: "/images/xxx.jpg", alt: "描述" }`。
- 旧的 `private: true`（登录门禁）那套已经不存在了，不要再加。

### 7.2 用网页后台写文章（Pages CMS）

见 `CMS-SETUP.md`：把仓库推到 GitHub → 在 pagescms.org 安装 GitHub App 并只勾这个仓库 →
打开网页后台就能写文章、传图片，保存即提交到仓库。仓库根的 `.pages.yml` 已经配好字段
（title / date / draft / tags / summary / cover / 正文），图片默认传到 `static/images/`。

### 7.3 升级 PaperMod（重要）

主题是 git submodule。本项目的做法是：**主题源码一个字都不改**，需要改的地方一律在项目根
用同名文件覆盖（Hugo 的项目级 `layouts/`、`assets/` 优先于 `themes/`）。

```bash
git submodule update --remote themes/PaperMod
git diff --stat themes/PaperMod
```

我们覆盖 / 新增的文件（主题升级后重点核对这几处）：

- `layouts/_partials/header.html`：**完全重写**（Fluent 页头 + Segmented 分段导航），
  不是主题文件的副本，所以升级主题**不需要**同步内容；但要留意主题是否给导航加了新特性。
- `layouts/index.html`、`layouts/list.html`、`layouts/single.html`：重写的三个主模板。
  主题若在这几个文件里加了新 partial / 新行为，需要手动评估是否跟进。
- `layouts/_partials/extend_head.html`：主题里本来就是空的扩展点，我方只用来注入背景图
  URL，**不需要同步**。
- `layouts/_partials/fluent_card.html`、`layouts/_partials/fluent_pager.html`：纯自定义部分。
- `assets/css/extended/fluent.css`：走 Hugo 资源管线自动并入主题样式表，不会与主题冲突；
  但它覆盖了主题的不少选择器，主题改类名时可能出现「样式回退」，升级后照 §1.4 过一遍即可。
- `layouts/_shortcodes/bilibili.html`：与主题无关。

升级后务必重新构建（§1.3）并过一遍 §1.4 的自查清单。提交 submodule 指针：

```bash
git add themes/PaperMod .gitmodules
git commit -m "chore: 升级 PaperMod"
```

---

## 9. 本地验证（交给你的三步）

```powershell
# 1) 起服务（局域网可访问，手机也能测）
$env:HUGO_CACHEDIR = "D:\dsh\个人博客\my-blog\.hugo_cache"
..\tools\hugo\hugo.exe server -D --bind 0.0.0.0 --baseURL http://192.168.1.13:1313/

# 2) 构建验证（应该 exit 0，输出里没有 ERROR）
$env:HUGO_CACHEDIR = "D:\dsh\个人博客\my-blog\.hugo_cache"
..\tools\hugo\hugo.exe --minify --gc

# 2b) 产物自检
Get-ChildItem public\* -Pattern 'workers.dev' -Recurse | Select-String 'workers.dev'  # 不该有输出
Test-Path public\login, public\register, public\private                                # 三个都应为 False
Select-String -Path public\index.html -Pattern 'var\(--bg-image|/images/background'    # 应能看到背景图引用
```

3) 浏览器里走一遍（把 `192.168.1.13` 换成你自己的局域网 IP）：

| 步骤 | 操作 | 预期 |
| --- | --- | --- |
| ① | 打开首页 | 背景图整页固定不滚动；作者信息卡 + 文章卡片；顶部是分段式导航 |
| ② | 点导航「文章 / 归档 / 标签 / 搜索」 | 选中项有圆角高亮底，页面正常 |
| ③ | 打开任意文章 | 正文在毛玻璃卡片里，行高 1.8，代码块是圆角 |
| ④ | 打开 `/posts/bilibili-video-demo/` | B 站播放器 16:9 自适应，能正常播放 |
| ⑤ | 点右上角切换 | 浅色 / 深色切换正常，卡片与导航样式都对 |
| ⑥ | 窗口拖窄到 768px 以下（或手机访问） | 导航整行横向滚动、卡片单列 |
| ⑦ | 打开 `/search/` 搜个词 | 能搜到文章（搜索索引由 Hugo 生成，不需要后端） |

---

## 10. 上线后最推荐的三步

1. **把站点重新部署一次**，让线上与本次改版一致（当前线上还是改版前的旧版）：
   先构建（见 §1.3），再按 §3.2b 用 `npx wrangler deploy` 把 `public/` 整个提交上去
   （需要先补 `wrangler.toml` 与 Cloudflare 凭据）。⚠️ **必须整棵 `public/` 上传**：
   只传根级文件的话，`/assets`、`/js`、`/posts` 都会 404。
2. **接上 Pages CMS**（见 `CMS-SETUP.md`）：仓库推到 GitHub → 安装 Pages CMS 的 GitHub App
   并只勾这一个仓库 → 以后在网页后台写文章、传图，保存即提交，构建平台自动重新发布。
3. **补内容与细节**：换成自己的背景图（`assets/images/background.jpg`，建议 1920px 宽、
   质量 80 左右重新压一遍）、把 `hugo.toml` 里的社交图标换成自己的、需要时在页脚加备案号
   （见 §5.3）。
