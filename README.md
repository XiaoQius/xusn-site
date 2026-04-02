<p align="center">
  <img src="logo.svg" alt="XUSN" width="120">
</p>

<h1 align="center">XUSN 个人网站</h1>

<p align="center">绪深的个人主页 + 后台管理系统</p>

## 功能

### 前台
- 个人信息展示（头像、简介、技能、项目）
- GitHub 数据实时同步（repo数、stars、followers）
- 访客统计 + Web Vitals 监控
- 3 套主题：温暖风 / 粗野风 / 手绘风
- SEO 优化（robots.txt、sitemap.xml、JSON-LD 结构化数据）
- 404 自定义页面
- 懒加载 + 首屏加载动画
- 响应式设计（手机/平板/电脑）

### 后台 (`/admin.html`)
- 登录认证（JWT + 密码加密）
- 配置管理（名字、头像、邮箱、GitHub、主题风格等）
- 技能管理（增删改、分类、熟练度）
- 项目管理（增删改、技术标签、缩略图、排序）
- 访客统计面板（趋势图、浏览器分布、Web Vitals、访客地图）
- 实时访客流（SSE 推送）
- 访客地图（IP 定位）
- 修改账号密码
- 主题实时切换预览

## 技术栈

- **前端：** 纯 HTML/CSS/JS（无框架）
- **后端：** Node.js + Express
- **数据库：** SQLite（better-sqlite3）
- **认证：** JWT（jsonwebtoken）+ bcrypt 密码加密
- **实时：** Server-Sent Events（SSE）
- **进程管理：** PM2

## 安装

### 前置要求
- Node.js >= 18
- npm

### 步骤

```bash
# 1. 进入项目目录
cd xusn-site

# 2. 安装依赖
npm install

# 3. 启动（首次运行会自动创建数据库和默认管理员）
node server.js
```

启动后：
- 前台访问：`http://localhost:52994`
- 后台访问：`http://localhost:52994/admin.html`
- 默认账号：`admin` / `admin123`

### 使用 PM2（推荐生产环境）

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start server.js --name xusn-site

# 设置开机自启
pm2 save
pm2 startup
```

## 配置

### 修改端口

```bash
# 方式一：环境变量
PORT=8080 node server.js

# 方式二：修改 server.js 第 8 行
const PORT = process.env.PORT || 52994;
```

### 宝塔面板部署

1. 创建 Node 项目，上传文件
2. 安装依赖：`npm install`
3. 设置 PM2 启动
4. 配置反向代理（Nginx）将域名指向端口
5. 开启 HTTPS

### 安全建议

- 首次登录后立即修改密码（后台 → 修改账号）
- JWT SECRET 自动生成并存储在数据库中（重启不丢失）
- 登录有频率限制（10 次 / 10 分钟）
- 配置更新有白名单，防止任意字段注入

## 文件结构

```
xusn-site/
├── server.js              # 后端主文件
├── package.json           # 依赖配置
├── data.db                # SQLite 数据库（自动生成）
└── public/                # 静态文件
    ├── index.html         # 前台页面
    ├── admin.html         # 后台管理
    ├── 404.html           # 404 页面
    ├── robots.txt         # SEO 爬虫规则
    └── sitemap.xml        # 站点地图
```

## API 接口

### 公开接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/site | 获取网站配置+数据 |
| GET | /api/github | 获取 GitHub 数据（缓存） |
| POST | /api/visit | 访客记录 |
| POST | /api/geolocation | 浏览器定位提交 |
| POST | /api/vitals | Web Vitals 上报 |

### 管理接口（需 Bearer Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 登录 |
| GET/PUT | /api/admin/config | 读取/更新配置 |
| PUT | /api/admin/password | 修改账号密码 |
| CRUD | /api/admin/skills | 技能管理 |
| CRUD | /api/admin/projects | 项目管理 |
| GET | /api/admin/stats | 访客统计 |
| GET | /api/admin/visitors/map | 访客地图 |
| GET | /api/admin/visitors/stream | 实时访客 SSE |

## 主题

三套主题可切换：
- 🧁 **温暖风**（warm）— 默认，磨砂玻璃 + 圆角 + 暖色系
- ⬛ **粗野风**（brutal）— 方块 + 黑边 + 等宽字体 + 硬阴影
- ✏️ **手绘风**（sketch）— 手写字体 + 虚线边框 + 不规则圆角 + 纸质背景

后台「网站配置 → 主题风格」切换，实时预览。

## License

MIT
