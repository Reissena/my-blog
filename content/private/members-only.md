---
title: "会员专享：站点上线后的日常维护清单"
date: 2026-09-29
tags: ["会员", "Hugo", "运维"]
summary: "登录后才可见的示例文章：上线之后每周/每月该做什么，以及这个登录模块怎么换密码。"
---

这篇是**登录后才可见**的示例文章，用来验证前端门禁是否生效。

如果你能看到这段正文，说明你已经登录成功（或者你正在看网页源码 —— 那说明你已经理解了这套方案的边界 🙂）。

## 每周

- 写 1～2 篇文章，`content/posts/` 下新建 Markdown 即可，推送到远端后托管平台会自动重建。
- 看一眼托管平台的构建日志，确认没有报错。

## 每月

- 更新主题子模块，检查我覆盖过的 `layouts/_partials/header.html` 有没有跟着变：
  ```bash
  git submodule update --remote themes/PaperMod
  git diff --stat themes/PaperMod
  ```
- 备份 `content/` 与 `hugo.toml`（其它文件都能重建）。

## 换登录密码

```bash
node tools/hash-password.mjs --user member
```

把输出的 `salt` / `hash` / `iterations` 三行，替换掉 `hugo.toml` 里
`[[params.auth.users]]` 对应账号的那三行，然后重新构建、推送即可。

## 让某个页面也变成「仅登录可见」

在它的 front matter 里加一行：

```yaml
private: true
```

（`content/private/` 整个栏目已经通过 `cascade` 自动加上了这个参数。）

## 想真正保密？

静态托管做不到。请按 `DEPLOY.md` 里的「升级到真安全方案」操作：
Cloudflare Access、自建后端鉴权、或 Caddy `basic_auth`。
