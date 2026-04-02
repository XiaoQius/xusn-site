const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 52994;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}));

// 定时清理：每 24 小时删除 90 天前的访客记录
setInterval(() => {
  try { db.prepare("DELETE FROM visitors WHERE created_at < strftime('%s','now','-90 days')").run(); } catch {}
  try { db.prepare("DELETE FROM web_vitals WHERE created_at < strftime('%s','now','-30 days')").run(); } catch {}
}, 86400000);

// === 数据库初始化 ===
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

// 兼容旧数据库：添加 thumbnail 列
try { db.exec('ALTER TABLE projects ADD COLUMN thumbnail TEXT DEFAULT ""'); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS skills (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT, level INTEGER DEFAULT 70);
  CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, color TEXT, icon TEXT, tags TEXT, link TEXT, thumbnail TEXT DEFAULT '', sort INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT);
  CREATE TABLE IF NOT EXISTS visitors (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, ua TEXT, page TEXT, created_at INTEGER DEFAULT (strftime('%s','now')));
  CREATE TABLE IF NOT EXISTS web_vitals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, value REAL, page TEXT, ua TEXT, created_at INTEGER DEFAULT (strftime('%s','now')));
`);

// 默认数据
const defaults = {
  name: '绪深', title: '高一学生', subtitle: '热爱编程 · 开源爱好者 · 终身学习者',
  desc: '我是绪深，目前是一名高一学生。虽然课业繁忙，但我总能挤出时间沉浸在代码的世界里。',
  avatar: 'https://q1.qlogo.cn/g?b=qq&nk=2687821674&s=640',
  email: 'un@xusn.dev', github: 'https://github.com/XiaoQius', website: 'https://xusn.cn',
  footer: '用温柔的方式改变世界 💛', location: '中国', education: '高一', theme: 'warm'
};
const ins = db.prepare('INSERT OR IGNORE INTO config (key,value) VALUES (?,?)');
Object.entries(defaults).forEach(([k,v]) => ins.run(k,v));

// 默认管理员
if (!db.prepare('SELECT id FROM admin WHERE username=?').get('admin')) {
  db.prepare('INSERT INTO admin (username,password) VALUES (?,?)').run('admin', bcrypt.hashSync('admin123',10));
}

// JWT SECRET：从数据库读取或生成新的持久化
let jwtRow = db.prepare('SELECT value FROM config WHERE key=?').get('_jwt_secret');
const JWT_SECRET = jwtRow ? jwtRow.value : (() => {
  const s = require('crypto').randomBytes(32).toString('hex');
  db.prepare('INSERT OR REPLACE INTO config (key,value) VALUES (?,?)').run('_jwt_secret', s);
  return s;
})();

// 默认技能
if (!db.prepare('SELECT COUNT(*) as c FROM skills').get().c) {
  const si = db.prepare('INSERT INTO skills (name,category,level) VALUES (?,?,?)');
  [['Python','语言',85],['JavaScript','语言',75],['HTML/CSS','语言',90],
   ['React','前端',70],['Vue.js','前端',65],['Tailwind','前端',80],
   ['Git','工具',75],['VS Code','工具',95],['Docker','工具',40]].forEach(r => si.run(...r));
}

// 默认项目
if (!db.prepare('SELECT COUNT(*) as c FROM projects').get().c) {
  const pi = db.prepare('INSERT INTO projects (title,desc,color,icon,tags,link,sort) VALUES (?,?,?,?,?,?,?)');
  pi.run('个人主页系统','响应式个人网站，采用现代 CSS 技术','#FF6B6B','fas fa-globe','["Web","设计"]','https://github.com/XiaoQius/XUSN-PAGE',1);
  pi.run('学习助手 Bot','管理学习计划的 Telegram Bot，支持任务追踪','#4ECDC4','fas fa-robot','["Python","自动化"]','#',2);
  pi.run('专注时钟','基于番茄工作法的专注工具，带白噪音和统计','#FFE66D','fas fa-mobile-alt','["App","PWA"]','#',3);
}

// === API ===

// 公开：获取所有数据
app.get('/api/site', (req, res) => {
  const config = {};
  db.prepare('SELECT key,value FROM config').all().forEach(r => config[r.key] = r.value);
  const skills = db.prepare('SELECT * FROM skills ORDER BY category,id').all();
  const projects = db.prepare('SELECT * FROM projects ORDER BY sort,id').all();
  projects.forEach(p => { try { p.tags = JSON.parse(p.tags); } catch { p.tags = []; } });
  res.json({ config, skills, projects });
});

// 登录
const loginAttempts = {};
app.post('/api/login', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const now = Date.now();
  // 清理过期记录
  if (loginAttempts[ip] && now - loginAttempts[ip].ts > 600000) delete loginAttempts[ip];
  // 检查频率：10 分钟内最多 10 次
  if (loginAttempts[ip] && loginAttempts[ip].count >= 10) {
    return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
  }
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  const user = db.prepare('SELECT * FROM admin WHERE username=?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    loginAttempts[ip] = { count: (loginAttempts[ip]?.count || 0) + 1, ts: now };
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  // 登录成功，清除计数
  delete loginAttempts[ip];
  res.json({ token: jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '24h' }) });
});

// 认证中间件
function auth(req, res, next) {
  const t = req.headers.authorization?.split(' ')[1];
  if (!t) return res.status(401).json({ error: '未登录' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { res.status(403).json({ error: '令牌无效' }); }
}

// 管理：更新配置
const ALLOWED_CONFIG = new Set(['name','title','subtitle','desc','avatar','email','github','website','footer','location','education','theme']);
app.put('/api/admin/config', auth, (req, res) => {
  const u = db.prepare('UPDATE config SET value=? WHERE key=?');
  Object.entries(req.body).forEach(([k,v]) => { if (ALLOWED_CONFIG.has(k)) u.run(v, k); });
  res.json({ ok: true });
});

// 管理：修改账号（用户名+密码）
app.put('/api/admin/password', auth, (req, res) => {
  const { oldPassword, newPassword, username } = req.body || {};
  if (!oldPassword) return res.status(400).json({ error: '请填写当前密码' });
  const user = db.prepare('SELECT * FROM admin WHERE id=?').get(req.user.uid);
  if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(401).json({ error: '当前密码错误' });
  }
  // 至少改一项
  if (!username && !newPassword) return res.status(400).json({ error: '至少填写一项' });
  if (username) {
    const exist = db.prepare('SELECT id FROM admin WHERE username=? AND id!=?').get(username, user.id);
    if (exist) return res.status(409).json({ error: '用户名已存在' });
    db.prepare('UPDATE admin SET username=? WHERE id=?').run(username, user.id);
  }
  if (newPassword) {
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' });
    db.prepare('UPDATE admin SET password=? WHERE id=?').run(bcrypt.hashSync(newPassword, 10), user.id);
  }
  res.json({ ok: true });
});

// 管理：技能 CRUD
app.get('/api/admin/skills', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM skills ORDER BY category,id').all());
});
app.post('/api/admin/skills', auth, (req, res) => {
  const { name, category, level } = req.body;
  res.json({ id: db.prepare('INSERT INTO skills (name,category,level) VALUES (?,?,?)').run(name, category, level).lastInsertRowid });
});
app.put('/api/admin/skills/:id', auth, (req, res) => {
  db.prepare('UPDATE skills SET name=?,category=?,level=? WHERE id=?').run(req.body.name, req.body.category, req.body.level, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/skills/:id', auth, (req, res) => {
  db.prepare('DELETE FROM skills WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// 管理：项目 CRUD
app.get('/api/admin/projects', auth, (req, res) => {
  const ps = db.prepare('SELECT * FROM projects ORDER BY sort,id').all();
  ps.forEach(p => { try { p.tags = JSON.parse(p.tags); } catch { p.tags = []; } });
  res.json(ps);
});
app.post('/api/admin/projects', auth, (req, res) => {
  const { title, desc, color, icon, tags, link, thumbnail, sort } = req.body;
  res.json({ id: db.prepare('INSERT INTO projects (title,desc,color,icon,tags,link,thumbnail,sort) VALUES (?,?,?,?,?,?,?,?)').run(title, desc, color, icon, JSON.stringify(tags||[]), link, thumbnail||'', sort||0).lastInsertRowid });
});
app.put('/api/admin/projects/:id', auth, (req, res) => {
  const { title, desc, color, icon, tags, link, thumbnail, sort } = req.body;
  db.prepare('UPDATE projects SET title=?,desc=?,color=?,icon=?,tags=?,link=?,thumbnail=?,sort=? WHERE id=?').run(title, desc, color, icon, JSON.stringify(tags||[]), link, thumbnail||'', sort, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/projects/:id', auth, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// === IP 地理位置 ===
const https = require('https');
const http = require('http');
const ipCache = {};
function getIpLocation(ip) {
  return new Promise(resolve => {
    if (ipCache[ip] !== undefined) return resolve(ipCache[ip]);
    const cleanIp = ip.replace('::ffff:', '');
    if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.')) {
      return resolve(null);
    }
    // 优先 ip-api.com（国内 IP 更准）
    const req1 = http.get(`http://ip-api.com/json/${cleanIp}?fields=status,country,city,lat,lon`, { headers: { 'User-Agent': 'xusn-site' }, timeout: 3000 }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.status === 'success' && j.lat) {
            const loc = { city: j.city || '?', country: j.country || '?', lat: j.lat, lon: j.lon };
            ipCache[ip] = loc;
            return resolve(loc);
          }
        } catch {}
        fallbackIpinfo(cleanIp, ip, resolve);
      });
    });
    req1.on('error', () => fallbackIpinfo(cleanIp, ip, resolve));
    req1.setTimeout(4000, () => { req1.destroy(); fallbackIpinfo(cleanIp, ip, resolve); });
  });
}
function fallbackIpinfo(cleanIp, rawIp, resolve) {
  const req = https.get(`https://ipinfo.io/${cleanIp}/json`, { headers: { 'User-Agent': 'xusn-site' }, timeout: 4000 }, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
      try {
        const j = JSON.parse(d);
        if (j.loc) {
          const [lat, lon] = j.loc.split(',').map(Number);
          const loc = { city: j.city || '?', country: j.country || '?', lat, lon };
          ipCache[rawIp] = loc;
          return resolve(loc);
        }
      } catch {}
      resolve(null);
    });
  });
  req.on('error', () => resolve(null));
  req.setTimeout(5000, () => { req.destroy(); resolve(null); });
}

// === 实时访客推送 (SSE) ===
const sseClients = new Set();
// 定时清理断开的 SSE 客户端
setInterval(() => {
  sseClients.forEach(c => { if (c.destroyed) sseClients.delete(c); });
}, 60000);
app.get('/api/admin/visitors/stream', (req, res) => {
  const token = req.query.token;
  try { jwt.verify(token, JWT_SECRET); } catch { return res.status(403).end(); }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});
function broadcastVisit(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => { try { c.write(msg); } catch {} });
}

// === 访客追踪 ===
const insVisit = db.prepare('INSERT INTO visitors (ip,ua,page) VALUES (?,?,?)');
const visitDedup = {}; // ip -> last visit timestamp
app.post('/api/visit', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  const page = req.body?.page || '/';
  const now = Date.now();
  // 同 IP 5 分钟内不重复记录
  if (!visitDedup[ip] || now - visitDedup[ip] > 300000) {
    visitDedup[ip] = now;
    insVisit.run(ip, ua, page);
    broadcastVisit({ type: 'visit', ip: ip.split(':').pop() || ip, page, ua: ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Other', time: now });
  }
  const total = db.prepare('SELECT COUNT(*) as c FROM visitors').get().c;
  res.json({ total });
});

// === 浏览器定位提交 ===
app.post('/api/geolocation', (req, res) => {
  const { lat, lon } = req.body || {};
  if (typeof lat === 'number' && typeof lon === 'number') {
    // 存储精确位置（关联最近一条访客记录）
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    ipCache[ip] = { city: '精确', country: 'GPS', lat, lon };
  }
  res.json({ ok: true });
});

// === 管理：访客地图 ===
app.get('/api/admin/visitors/map', auth, async (req, res) => {
  try {
    const ips = db.prepare("SELECT DISTINCT ip FROM visitors WHERE ip NOT LIKE '127%' AND ip NOT LIKE '::1%' AND ip NOT LIKE '192.168%' AND ip NOT LIKE '10.%' AND ip NOT LIKE '::ffff:192%' AND ip NOT LIKE '::ffff:10%'").all();
    const locations = [];
    // 并发 5 个
    const batch = ips.slice(0, 30);
    for (let i = 0; i < batch.length; i += 5) {
      const results = await Promise.all(batch.slice(i, i + 5).map(({ ip }) => getIpLocation(ip)));
      results.forEach(loc => { if (loc && loc.lat && loc.lon) locations.push(loc); });
    }
    res.json({ locations, total: ips.length });
  } catch (e) {
    console.error('visitors/map error:', e.message);
    res.json({ locations: [], total: 0 });
  }
});

// === Web Vitals ===
const insVital = db.prepare('INSERT INTO web_vitals (name,value,page,ua) VALUES (?,?,?,?)');
app.post('/api/vitals', (req, res) => {
  const { name, value, page, ua } = req.body || {};
  if (name && typeof value === 'number') insVital.run(name, value, page || '', ua || '');
  res.json({ ok: true });
});

// === 管理：访问统计 ===
app.get('/api/admin/stats', auth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM visitors').get().c;
  const today = db.prepare("SELECT COUNT(*) as c FROM visitors WHERE created_at > strftime('%s','now','start of day')").get().c;
  const recent = db.prepare('SELECT ip, ua, page, created_at FROM visitors ORDER BY id DESC LIMIT 20').all();
  // 统计浏览器
  const browsers = db.prepare(`SELECT
    CASE WHEN ua LIKE '%Chrome%' THEN 'Chrome'
         WHEN ua LIKE '%Firefox%' THEN 'Firefox'
         WHEN ua LIKE '%Safari%' THEN 'Safari'
         WHEN ua LIKE '%Edge%' THEN 'Edge'
         ELSE 'Other' END as browser,
    COUNT(*) as c FROM visitors GROUP BY browser ORDER BY c DESC LIMIT 5`).all();
  // 统计页面
  const pages = db.prepare('SELECT page, COUNT(*) as c FROM visitors GROUP BY page ORDER BY c DESC LIMIT 10').all();
  // 最近7天趋势
  const trend = db.prepare(`SELECT date(created_at,'unixepoch','localtime') as day, COUNT(*) as c FROM visitors GROUP BY day ORDER BY day DESC LIMIT 7`).all();
  // Web Vitals
  const vitals = db.prepare(`SELECT name, ROUND(AVG(value),1) as avg, COUNT(*) as c FROM web_vitals GROUP BY name ORDER BY name`).all();
  res.json({ total, today, recent, browsers, pages, trend: trend.reverse(), vitals });
});
let ghCache = { data: { username: '', public_repos: 0, followers: 0, total_stars: 0 }, ts: 0 };
// 后台异步刷新 GitHub 数据，不阻塞请求
function refreshGithub() {
  const githubUrl = db.prepare('SELECT value FROM config WHERE key=?').get('github')?.value || '';
  const username = githubUrl.replace(/https?:\/\/github\.com\//, '').split('/')[0].split('?')[0];
  if (!username) return;
  const headers = { 'User-Agent': 'xusn-site', 'Accept': 'application/vnd.github.v3+json' };
  const req = https.get(`https://api.github.com/users/${username}`, { headers, timeout: 5000 }, r1 => {
    let d1 = '';
    r1.on('data', c => d1 += c);
    r1.on('end', () => {
      try {
        const user = JSON.parse(d1);
        const req2 = https.get(`https://api.github.com/users/${username}/repos?per_page=100&sort=stars`, { headers, timeout: 5000 }, r2 => {
          let d2 = '';
          r2.on('data', c => d2 += c);
          r2.on('end', () => {
            try {
              const repos = JSON.parse(d2);
              const total_stars = Array.isArray(repos) ? repos.reduce((s, r) => s + (r.stargazers_count || 0), 0) : 0;
              ghCache = { data: { username, public_repos: user.public_repos || 0, followers: user.followers || 0, total_stars, avatar: user.avatar_url || '' }, ts: Date.now() };
            } catch {}
          });
        });
        req2.on('error', () => {});
        req2.setTimeout(6000, () => req2.destroy());
      } catch {}
    });
  });
  req.on('error', () => {});
  req.setTimeout(6000, () => req.destroy());
}
// 启动时刷新一次，之后每 10 分钟
refreshGithub();
setInterval(refreshGithub, 600000);
app.get('/api/github', (req, res) => { res.json(ghCache.data); });

// === SEO: robots.txt ===
app.get('/robots.txt', (req, res) => {
  const site = db.prepare('SELECT value FROM config WHERE key=?').get('website')?.value || 'https://xusn.cn';
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /api/

Sitemap: ${site.replace(/\/$/,'')}/sitemap.xml`);
});

// === SEO: sitemap.xml ===
app.get('/sitemap.xml', (req, res) => {
  const site = db.prepare('SELECT value FROM config WHERE key=?').get('website')?.value || 'https://xusn.cn';
  const base = site.replace(/\/$/,'');
  const now = new Date().toISOString().split('T')[0];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>`);
});

// === 404 ===
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// 启动
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT} | 后台 /admin.html | admin/admin123`));

// 全局错误处理
process.on('uncaughtException', (err) => { console.error('❌ uncaughtException:', err.message); });
process.on('unhandledRejection', (err) => { console.error('❌ unhandledRejection:', err?.message || err); });
