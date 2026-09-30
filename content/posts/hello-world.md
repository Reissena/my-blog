---
title: "你好，世界"
date: 2026-09-30
draft: false
tags: ["Hugo", "PaperMod", "开始"]
categories: ["随笔"]
summary: "博客的第一篇文章：记录这个站点是怎么搭起来的。"
---

欢迎来到我的个人博客！这是第一篇文章，用来验证 Hugo + PaperMod 的构建和渲染是否正常。

## 这个站点是怎么搭起来的

1. 用 **Hugo** 生成静态站点，主题是 **PaperMod**
2. 主题以 git submodule 的方式挂在 `themes/PaperMod`
3. 推送到 GitHub 后由 **Cloudflare Pages** 自动构建、全球加速
4. 最后绑定自己的域名

## 代码高亮测试

```go
package main

import "fmt"

func main() {
	fmt.Println("Hello, Hugo + PaperMod!")
}
```

## 接下来

- [x] 初始化站点
- [x] 配置中文界面
- [ ] 写第二篇文章
- [ ] 绑定自定义域名

> 提示：编辑 `content/posts/` 下的 Markdown 文件即可发布新文章，推送后 Cloudflare Pages 会自动重新部署。
