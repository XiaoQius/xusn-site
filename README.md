# XUSN Site

一个已经改造成纯静态部署的个人主页。现在不依赖 Node 后端、SQLite 或服务器常驻进程，可以直接部署到 **Cloudflare Pages** 或 **Vercel**。

> 说明：下面的按钮默认指向 `https://github.com/XiaoQius/XUSN-PAGE`。如果你 fork 或改名了仓库，请把按钮链接里的仓库地址替换成你自己的 GitHub 仓库地址。

## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FXiaoQius%2FXUSN-PAGE)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FXiaoQius%2FXUSN-PAGE)

### Vercel

1. 把仓库导入 Vercel。
2. Vercel 会读取 `vercel.json`：
   - Build Command: `npm run build`
   - Output Directory: `public`
3. 点击 Deploy 即可。

也可以使用命令行：

```bash
npm install
npm run deploy:vercel
```

### Cloudflare Pages

1. 把仓库连接到 Cloudflare Pages。
2. Cloudflare 会读取 `wrangler.toml`，输出目录为 `public`。
3. 构建命令填写：`npm run build`。
4. 点击 Deploy 即可。

也可以使用命令行：

```bash
npm install
npm run deploy:cloudflare
```

## 本地预览

```bash
npm install
npm run dev
```

打开：<http://localhost:52994>

后台：<http://localhost:52994/admin.html>

默认账号：`admin`

默认密码：`admin123`

## 静态版说明

- 站点数据、后台修改、访客统计和密码会保存在浏览器 `localStorage` 中。
- 这种方式适合一键静态部署，不需要数据库，也不会遇到 Vercel/Cloudflare Pages 无法直接写 SQLite 文件的问题。
- 如果需要多设备同步、真实全站统计或安全后台认证，后续可以接入 Cloudflare D1/KV、Vercel KV、Supabase 或其它托管数据库。

## 主要文件

- `public/index.html`：前台页面
- `public/admin.html`：管理后台
- `public/site-data.js`：静态数据层与浏览器端 API 兼容适配
- `vercel.json`：Vercel 部署配置
- `wrangler.toml`：Cloudflare Pages 部署配置
