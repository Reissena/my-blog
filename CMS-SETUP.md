# CMS-SETUP.md —— 用网页后台写文章（Pages CMS）

> **只是想在后台写文章、插图、发布？** 请直接看 [`后台使用说明.md`](后台使用说明.md)——
> 那是给日常写作写的操作说明（点哪里、出现什么，一步一步）。
> **本文件是当初搭站时的一次性安装记录**（后台怎么装、字段怎么配），装好之后平时用不到。

> 目标：不用装 Hugo、不用本地编辑器，在浏览器里写文章、传图片，保存后自动同步到
> GitHub 仓库，构建平台（Cloudflare）随后自动重新发布站点。
>
> 本项目已经在仓库根放好了配置文件 `.pages.yml`，**下面这些步骤只需要做一次**。

---

## 1. 这个后台是什么

[Pages CMS](https://pagescms.org) 是一个开源的「Git 型 CMS」：

- 它**不存你的内容**，只是在你的 GitHub 仓库上做增删改并提交 commit；
- 你写文章 = 往 `content/posts/` 提交一个 `.md` 文件，图片 = 提交到 `static/images/`；
- 因此**页面仍然是纯静态的**（没有数据库、没有后端渲染、没有额外费用）——
  后台改的永远只是源文件，Hugo 构建出来还是一堆静态文件。
  （⚠️ 站点的 Worker 里另有一小段服务端脚本，只做访问打点，与这个后台无关，见 `docs/访问统计.md`。）

配置文件 `.pages.yml` 决定了后台里能编辑什么（文章字段、图片目录）。

---

## 2. 前置条件：仓库要在 GitHub 上

Pages CMS 只认 GitHub（GitLab 等暂不支持），所以：

1. 如果这个项目还没推到 GitHub，先在 GitHub 上新建一个仓库（**建议私有**，
   仓库里是你的文章源文件），然后：

   ```bash
   git remote add origin git@github.com:<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

2. 确认 `main` 分支里有：`hugo.toml`、`content/`、`layouts/`、`.pages.yml`。
   注意 `public/` 在 `.gitignore` 里，**不需要**提交。

> 不想连 GitHub 也行：那就继续用本地 `hugo new content/posts/xxx.md` 写作（见 `DEPLOY.md` §8.1）。

---

## 3. 安装 Pages CMS 的 GitHub App

1. 打开 <https://app.pagescms.org>，用 GitHub 账号登录。
2. 按提示安装 **Pages CMS GitHub App**：
   - 选 `Only select repositories`，**只勾这一个博客仓库**（最小权限，别给 All repositories）；
   - 权限只需要读取/写入仓库内容与提交。
3. 回到 <https://app.pagescms.org>，在仓库列表里选中你的博客仓库。
4. 进去后应该能看到左侧出现「文章」集合，里面是 `content/posts/` 下的所有文章；
   右上角是保存按钮（保存 = 一次 commit）。

> 换电脑 / 换手机：任何浏览器登录同一个 GitHub 账号即可接着写。

---

## 4. 后台里怎么用

| 操作 | 说明 |
| --- | --- |
| 新建文章 | 「文章 → 新建」，填标题、日期、标签、摘要，正文用富文本编辑器写 |
| 存草稿 | 打开「草稿」开关（`draft: true`）。草稿**不会**出现在线上文章列表里 |
| 插入图片 | 在正文里上传图片，或给文章加「封面图」；文件会存到 `static/images/`，正文里写成 `/images/xxx.jpg` |
| 保存 | 点保存 = 往仓库提交一次 commit；构建平台（如 Cloudflare）会据此重新构建发布 |
| 记住密码？ | 不涉及。登录用的是你的 GitHub 账号 |

字段与 `hugo.toml` / PaperMod 的对应关系：

| 后台字段 | front matter | 说明 |
| --- | --- | --- |
| 标题 | `title` | 文章标题 |
| 日期 | `date` | 排序与归档用 |
| 草稿 | `draft` | `true` 不发布 |
| 标签 | `tags` | 可加多个，会生成 `/tags/xxx/` 页面 |
| 摘要 | `summary` | 首页/列表卡片上的那两行字 |
| 封面图 | `cover.image` / `cover.alt` / `cover.caption` | PaperMod 的封面写法（嵌套字段） |
| 正文 | front matter 下面的 Markdown | 支持 `{{< bilibili BV… >}}` 短代码 |

---

## 5. 给文章加封面图

首页和 `/posts/` 的文章卡片会在顶部通栏显示封面图（统一 16:9、自动裁切、
上两角跟随卡片圆角），文章详情页顶部也会显示同一张图。

**两种放图方式，任选一种：**

1. **后台上传（推荐）**：在文章编辑页点「封面图 → 图片 → 上传」，
   文件会存进仓库的 `static/images/`，front matter 自动写成：

   ```yaml
   cover:
     image: /images/2026-10-09-xxx.jpg
     alt: 图片描述
   ```

2. **手动放文件**：图片丢进 `static/images/posts/`（或 `assets/images/posts/`），
   再自己写 front matter：

   ```yaml
   cover:
     image: /images/posts/xxx.jpg
     alt: 一句话描述（读屏软件和 SEO 会用到）
     caption: 图注（可选，显示在图片下方）
   ```

**几个注意点：**

- `cover` 是**嵌套字段**（`cover.image`），不是一行字符串。后台里它对应「封面图」
  那个分组，里面是「图片 / 图片描述 / 图注」三个小字段。
- 建议用 16:9 的图（例如 1200×675）。其它比例也不会变形（`object-fit: cover`），
  只是上下或左右会被裁掉一点。
- 体积控制在 200 KB 以内比较好（1600px 宽、质量 80 左右），别直接传手机原图。
- **不写 `cover` 也完全没问题**：卡片会显示「渐变底 + 标题首字」的占位方块，
  绝不会出现破图，网格高度也照样整齐。
- 也兼容 `images: ["/images/x.jpg"]` 这种数组写法（取第一张），但建议统一用 `cover`。

---

## 6. 常见问题

- **中文文件名**：新文件默认按 `2026-10-09-标题.md` 命名。用中文标题也可以（Hugo 会
  正确生成 URL，只是地址里会出现百分号编码），介意的话把标题改成英文，
  或把 `.pages.yml` 里的 `filename` 改成 `"{year}-{month}-{day}.md"` 这种纯日期格式。
- **`_index.md` 别乱动**：`content/posts/_index.md` 是「文章」栏目页的配置文件，
  不是一篇文章。后台会把它一起列出来，点开编辑时只改 `title` / `description` 就好。
- **标签想要下拉框**（避免 `Hugo` / `hugo` 混用）：把 `.pages.yml` 里 tags 字段的
  `type: string` 改成 `type: select`，再补上 `options: { values: [Hugo, 随笔, 折腾] }`。
- **保存后线上没变**：构建平台要几十秒；如果一直没变，去 Cloudflare 控制台看最近的
  构建日志（或者确认仓库的默认分支就是 `main`）。
- **不想用了**：删掉 `.pages.yml` 即可，站点不受任何影响；也可以在 GitHub 设置里
  卸载 Pages CMS App，撤销它的仓库权限。
