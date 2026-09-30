# DEPLOY.md —— 上线部署说明

> 适用仓库：本仓库根目录（与 `hugo.toml` 同级）。
> 站点：Hugo + PaperMod 中文博客，带「前端门禁式」登录模块。
> 本文所有命令都以**仓库根目录**为当前目录，可直接复制执行。

---

## 0. 现状速查

| 项目 | 值 |
| --- | --- |
| 站点根目录 | 仓库根（有 `hugo.toml` 的那一层） |
| 主题 | PaperMod，以 **git submodule** 挂在 `themes/PaperMod`（无 Hugo Modules） |
| Hugo 版本要求 | **≥ 0.158.0 extended**（`hugo.toml` 用了 `locale`；PaperMod 本身要求 ≥ 0.146.0）<br>本地已验证版本：`v0.167.0+extended` |
| 构建命令 | `hugo --minify` |
| 产物目录 | `public/`（已在 `.gitignore` 里，不入库） |
| baseURL | `hugo.toml` 里目前是 `https://example.com/`，**上线前必须改成真实域名** |
| 登录模块新增文件 | `layouts/login.html`、`layouts/_partials/header.html`（覆盖主题）、`layouts/_partials/extend_head.html`（覆盖主题）、`assets/js/auth.js`、`assets/css/extended/auth.css`、`content/login.md`、`content/private/`、`tools/hash-password.mjs` |

登录模块的测试账号（写在 `hugo.toml` 的 `[[params.auth.users]]` 里）：

| 用户名 | 密码 | 显示名 |
| --- | --- | --- |
| `member` | `papermod123` | 会员读者 |
| `admin` | `admin@2026` | 站长 |

> ⚠️ 上线前请用 `node tools/hash-password.mjs --user member` 换成你自己的密码，见 §8.1。

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

```bash
hugo --minify                 # 产物在 public/
hugo --minify --gc --cleanDestinationDir   # 顺手清理旧文件
hugo --minify -d dist         # 换产物目录
hugo --minify --baseURL https://blog.example.com/   # 临时覆盖 baseURL
hugo server --renderToMemory  # 不写磁盘，纯预览
```

### 1.4 本地自查清单

- [ ] `hugo --minify` 退出码为 0，没有 `ERROR`
- [ ] 首页右侧出现「登录」；未登录时菜单是 文章 / 归档 / 标签 / 搜索 / 登录
- [ ] 直接访问 `/private/` → 自动跳到 `/login/?redirect=%2Fprivate%2F`
- [ ] 用 `member` / `papermod123` 登录 → 自动跳回 `/private/`，页头显示「会员读者 退出」
- [ ] 点「退出」→ 再访问 `/private/` 又会被拦
- [ ] 右上角切换浅色 / 深色，登录页样式都正常

---

## 2. 部署前必做

1. **改 baseURL**（`hugo.toml` 第 7 行左右）：

   ```toml
   baseURL = "https://blog.example.com/"   # 结尾的斜杠不要漏
   ```

   - 用户站点 / 独立域名：`https://blog.example.com/`
   - GitHub Pages 项目站点：`https://<用户名>.github.io/<仓库名>/`
   - Cloudflare Pages / Netlify / Vercel 的子域名：`https://<项目名>.pages.dev/` 等

   > 登录模块内部用的是 `site.Home.RelPermalink`（只有路径），所以即使 baseURL 忘了改，
   > 登录/跳转也能工作；但 canonical、sitemap、RSS、favicon 会指错，**还是要改**。

2. **换掉测试密码**（见 §8.1）。

3. **提交并推送**：

   ```bash
   git add -A
   git commit -m "feat: 增加前端登录模块 + 部署文档"
   git push origin main
   ```

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

**取舍**：免费版 100 GB/月流量，自带表单收集、身份认证（Identity）、Serverless Functions，
想给登录模块升级成「真鉴权」时最省事（见 §7.2）。国内速度一般。

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

## 6. 登录模块：能做什么、不能做什么

### 6.1 它做了什么

- `/login/`：用户名 + 密码 + 「记住我」，错误提示、失败冷却、深色模式适配。
- 口令**不存明文**：`hugo.toml` 里只有 `salt` + `hash`（PBKDF2-HMAC-SHA256，默认 15 万次迭代，32 字节输出）。
- 校验在**浏览器本地**完成：优先用 `crypto.subtle`（Web Crypto），不可用时自动切到内置纯 JS 实现，
  所以局域网 HTTP 访问也能登录。
- 登录态放 `localStorage`（记住我，默认 30 天）或 `sessionStorage`（默认 12 小时），页头显示用户名 + 「退出登录」。
- `private: true` 的页面由同步脚本在 `<head>` 里做门禁：未登录直接
  `location.replace("/login/?redirect=" + 当前路径)`，登录成功后跳回原页。
- 会员页面已从 **RSS / 搜索索引 / sitemap** 中排除，并带 `noindex, nofollow`。

### 6.2 它**做不到**什么（务必知道）

Hugo 是纯静态站点，构建出来的 HTML/JS 会原样发给每一个访客。因此：

1. **内容就在公开文件里**。会「查看网页源代码」或用 `curl https://blog.example.com/private/members-only/`
   的人，能拿到全文——门禁只是浏览器端的一段跳转脚本。
2. **登录态可以伪造**。`localStorage` 里的 `pmauth.session` 是明文的 JSON，改一下 `exp`
   或直接手写一条，就能「免密登录」。页头会显示你随便编的用户名。
3. **哈希是公开的**。`/login/` 页面的 HTML 里带着 `salt`/`hash`，可以离线暴力破解
   （15 万次 PBKDF2 能显著抬高成本，但挡不住弱密码）。
4. **前端限流形同虚设**。失败冷却存在 `localStorage`，清掉即可；脚本也可以无限制地试。
5. **搜索引擎/爬虫也遵守不了**：已经不指望 robots，靠的是没人知道 URL。

**一句话：这套机制挡的是「随手点进来的人」和「普通读者」，不是「攻击者」。**
适合：草稿预览、会员名单、内部资料索引这类**泄露了也不致命**的内容。

### 6.3 怎么判断你属于哪一类

| 内容性质 | 建议方案 |
| --- | --- |
| 会给朋友看的草稿、读者群专属文章 | ✅ 本模块够用 |
| 客户信息、内部文档、付费内容 | ❌ 用 §7 的方案 |
| 密码、密钥、身份证件 | ❌ 任何静态托管都不行，自建后端 + 数据库 |

---

## 7. 升级到「真安全」方案

### 7.1 Cloudflare Access（零信任，最推荐给静态站）

原理：Cloudflare 在**边缘**拦截，未授权的请求根本拿不到文件，静态站零改动。

1. 域名 NS 托管到 Cloudflare（免费版即可）。
2. 打开 **Zero Trust → Access → Applications → Add an application → Self-hosted**。
3. 配置：
   - Application domain：`blog.example.com`，path 填 `private`（即保护 `/private/*`）
   - Session Duration：24 hours
   - Identity providers：`One-time PIN`（邮箱验证码，零配置）或 GitHub / Google
   - Access policies：`Allow` → `Emails` → 填你自己的邮箱（或 `Emails ending in @yourdomain.com`）
4. 保存后访问 `https://blog.example.com/private/`，会被 302 到 Cloudflare 的登录页；
   验证邮箱后自动跳回。**curl / 源码查看者也拿不到内容。**
5. 免费版额度 50 个用户，个人博客绰绰有余。

配套调整：可以删掉本项目的门禁脚本（`extend_head.html` 里的 gate 部分），只保留页头登录入口
也无意义了——建议把 `[params.auth] enabled = false`，把鉴权完全交给 Access。

### 7.2 Netlify Identity（已在用 Netlify 时最省事）

1. Netlify 站点 → **Identity → Enable Identity**，邀请用户（`Identity → Invite users`）。
2. 在 `static/` 下放官方 `netlify-identity-widget.js` 初始化代码，用
   `netlifyIdentity.on("login", ...)` 拿 JWT。
3. 真正的保护要靠 **Edge Function**（`netlify/edge-functions/auth.ts`）：

   ```ts
   import type { Config, Context } from "@netlify/edge-functions";

   export default async function handler(req: Request, ctx: Context) {
     const user = ctx.cookies.get("nf_jwt")
       ? await ctx.identity?.getUser()   // 官方 identity 上下文
       : await fetch("https://<站点>/.netlify/identity/user", {
           headers: { Authorization: `Bearer ${ctx.cookies.get("nf_jwt") ?? ""}` },
         }).then(r => (r.ok ? r.json() : null));
     if (!user) {
       return new Response(null, { status: 302, headers: { Location: "/login/" } });
     }
     return ctx.next();
   }

   export const config: Config = { path: "/private/*" };
   ```

4. 部署后 `/private/*` 的请求会先过 Edge Function，未登录直接 302。

**取舍**：一体化（用户管理 + JWT + 边缘鉴权），但只能用在 Netlify 上，且 Edge Function 调试略麻烦。

### 7.3 自建 Node / Express 后端（最可控）

思路：Hugo 只管渲染，`/private/*` 交给后端做真正的会话校验。

```
blog-server/
├── public/          # hugo --minify 的产物（静态资源）
├── server.js
└── package.json
```

```js
// server.js —— 最小可用示例：Express + 会话 + bcrypt
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import fs from "node:fs";

const app = express();
app.use(express.urlencoded({ extended: false }));

// 生产环境把 secret 放到环境变量里：SESSION_SECRET=...
app.use(session({
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 12 * 3600 * 1000 },
}));

// 账户存在环境变量或数据库里，绝对不能写进前端
const USERS = {
  member: { name: "会员读者", hash: bcrypt.hashSync(process.env.MEMBER_PASSWORD || "papermod123", 10) },
};

app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }));   // 登录限流

app.post("/api/login", async (req, res) => {
  const { username = "", password = "" } = req.body;
  const user = USERS[username];
  const ok = user && (await bcrypt.compare(password, user.hash));
  if (!ok) return res.status(401).json({ error: "用户名或密码不正确" });
  req.session.user = { username, name: user.name };
  res.json({ ok: true, user: req.session.user });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/me", (req, res) => res.json({ user: req.session.user ?? null }));

// 关键：服务端拦截，未登录的人拿不到 HTML
app.use("/private", (req, res, next) => {
  if (req.session.user) return next();
  res.redirect(302, `/login/?redirect=${encodeURIComponent(req.originalUrl)}`);
});

app.use(express.static("public", { extensions: ["html"] }));
app.listen(process.env.PORT || 3000);
```

```bash
npm i express express-session bcryptjs express-rate-limit
node server.js           # 或 pm2 start server.js --name blog
```

再用 Caddy / Nginx 反代 + HTTPS：

```caddyfile
blog.example.com {
    reverse_proxy 127.0.0.1:3000
    encode zstd gzip
}
```

**取舍**：真正安全（口令、会话、限流都在服务端），但多了一台服务器 / 容器要运维，
且 `/private/*` 的静态文件必须由后端来决定是否放行——原来的 `public/private/*.html` 不能再被
对象存储或 CDN 直出，否则绕过所有校验。**如果继续用 CDN，请把 CDN 回源指向后端，别直接指向桶。**

### 7.4 Caddy basic auth（最轻量的「真·密码保护」）

适合：只想给自己的小站加一把锁，不想要任何前端逻辑。

```bash
# 1) 生成密码哈希（交互输入密码）
caddy hash-password --plaintext '你的密码'
# 输出类似：$2a$14$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```caddyfile
# 2) Caddyfile
blog.example.com {
    root * /srv/blog/public
    encode zstd gzip

    # 保护会员目录：浏览器会弹原生账号密码框
    @members path /private/*
    basic_auth @members {
        member $2a$14$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    }

    file_server
}
```

```bash
caddy run --config Caddyfile      # 自动申请并续期 HTTPS 证书
```

**取舍**：5 分钟搞定、由服务器拦截（源码也看不到）、支持多人多密码；缺点是浏览器原生弹窗
（不能用自定义登录页）、没有「记住我 / 退出」之类的体验，密码要共享。

**想保留自定义登录页**：让 Caddy 反代 §7.3 的 Node 服务即可，两者可以叠加
（外网先过 basic auth，内部再走会话）。

### 7.5 方案对比

| 方案 | 内容真的藏住了吗 | 需要什么 | 登录体验 |
| --- | --- | --- | --- |
| 本项目（前端门禁） | ❌ 否 | 无 | 自定义登录页，好 |
| Cloudflare Access | ✅ 是 | 域名接入 Cloudflare | 邮箱验证码，好 |
| Netlify Identity + Edge Function | ✅ 是 | Netlify | 中等 |
| 自建 Node/Express | ✅ 是 | 一台服务器 | 自定义，最好 |
| Caddy basic auth | ✅ 是 | 一台服务器 + Caddy | 浏览器原生弹窗，够用 |

---

## 8. 日常维护

### 8.1 换密码 / 加账号

```bash
# 生成新哈希（交互式输入，不回显）
node tools/hash-password.mjs --user member --display-name "会员读者"

# 校验现网口令是否正确（读 hugo.toml 里的 salt/hash 重新算一遍）
node tools/hash-password.mjs --check member papermod123
node tools/hash-password.mjs --check          # 只列出现有账号

# 自检：确认 assets/js/auth.js 的纯 JS 实现与 Node crypto 结果一致
node tools/hash-password.mjs --selftest
```

把输出的 `salt` / `hash` / `iterations` 三行替换掉 `hugo.toml` 里对应账号的三行，
提交推送即可。**已在线的访客不会立刻掉线**（登录态有有效期），必要时让他在页头点「退出登录」。

### 8.2 新增一篇会员文章

```bash
hugo new content private/我的新文章.md    # 或直接新建文件
```

因为 `content/private/_index.md` 里配了 `cascade`，这个栏目下的页面会自动带上
`private / robotsNoIndex / hiddenInRss / searchHidden / sitemap.disable`，**不用重复写**。

给 `content/posts/` 下的普通文章加门禁？只要在它的 front matter 里加一行：

```yaml
private: true
```

### 8.3 关掉登录模块

```toml
# hugo.toml
[params.auth]
  enabled = false
```

页头入口、门禁跳转、config 注入都会消失（`/login/` 页面本身还在，可以顺手把 `content/login.md` 删掉）。

### 8.4 升级 PaperMod（重要）

主题是 submodule，且本项目**覆盖了主题的两个 partial**：

```bash
git submodule update --remote themes/PaperMod
git diff --stat themes/PaperMod
git diff themes/PaperMod/layouts/_partials/header.html   # 我们这个文件是它的完整副本
```

- `layouts/_partials/header.html`：本项目的副本。主题更新后如果这个文件变了，
  请把变化同步过来（自定义部分用 `AUTH-MODULE START/END` 注释框标出）。
- `layouts/_partials/extend_head.html`：主题里是空的扩展点，直接被我方覆盖，**不需要同步**。
- `assets/css/extended/auth.css`、`assets/js/auth.js`：走 Hugo 的资源管线，与主题不冲突。

提交 submodule 指针：

```bash
git add themes/PaperMod .gitmodules
git commit -m "chore: 升级 PaperMod"
```

---

## 9. 本地验证（交给你的三步）

```bash
# 1) 起服务（局域网可访问，手机也能测）
hugo server -D --bind 0.0.0.0 --baseURL http://192.168.1.13:1313/

# 2) 构建验证（应该 exit 0，无 ERROR）
hugo --minify --gc
```

3) 浏览器里走一遍：

| 步骤 | 操作 | 预期 |
| --- | --- | --- |
| ① | 打开 <http://192.168.1.13:1313/private/> | 自动跳到 `/login/?redirect=%2Fprivate%2F` |
| ② | 输入 `member` / `papermod123`（勾「记住我」） | 跳回 `/private/`，看到会员文章 |
| ③ | 看页头右侧 | 显示「👤 会员读者 退出」，菜单多出「会员专区」 |
| ④ | 点「退出」 | 回到首页，菜单恢复 文章 / 归档 / 标签 / 搜索 / 登录 |
| ⑤ | 再访问 `/private/` | 又被拦到登录页 |
| ⑥ | 切深色模式 | 登录页、输入框、按钮样式正常 |

其它账号：`admin` / `admin@2026`。
命令行验证口令：`node tools/hash-password.mjs --check member papermod123`。

---

## 10. 上线后最推荐的三步

1. `hugo.toml` 改 `baseURL` 为真实域名 + `node tools/hash-password.mjs --user member` 换成自己的密码，提交推送。
2. 用 **Cloudflare Pages** 接仓库（build command `git submodule update --init --recursive && hugo --minify`，
   output `public`，环境变量 `HUGO_VERSION=0.167.0`），然后在 `Settings → Domains` 绑自定义域名。
3. 如果 `/private/` 里的东西**不能泄露**，再花 10 分钟在 Cloudflare 上开 **Zero Trust → Access**，
   把 `/private/*` 用邮箱验证码保护起来（见 §7.1）——这时候前端的登录模块就只当装饰了。
