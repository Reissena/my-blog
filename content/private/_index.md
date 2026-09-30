---
title: "会员专区"
description: "登录后才可见的示例栏目：用来演示纯静态站点的前端门禁式登录。"
date: 2026-09-28
private: true
robotsNoIndex: true
hiddenInRss: true
searchHidden: true
sitemap:
  disable: true
cascade:
  private: true
  robotsNoIndex: true
  hiddenInRss: true
  searchHidden: true
  sitemap:
    disable: true
---

这里是**会员专区**，一个「仅登录可见」的示例栏目。

未登录时访问本页或下面任意一篇文章，都会被自动跳到
`/login/?redirect=<原地址>`；登录成功后会自动跳回原来的页面。

> ⚠️ 提醒：Hugo 是纯静态站点，这里的「门禁」由浏览器端 JavaScript 实现。
> 它能挡住普通访客，但挡不住直接查看网页源码或用 devtools 改本地存储的人。
> 真正需要保密的内容，请看仓库根目录 `DEPLOY.md` 里的「升级到真安全方案」。
