const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 52994;
const publicDir = path.join(__dirname, 'public');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function sendFile(res, filePath, status = 200) {
  fs.readFile(filePath, (err, body) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': types[ext] || 'application/octet-stream' };
    headers['Cache-Control'] = ext === '.html' ? 'no-cache' : 'public, max-age=604800';
    res.writeHead(status, headers);
    res.end(body);
  });
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(publicDir, requested));

  if (!filePath.startsWith(publicDir)) {
    sendFile(res, path.join(publicDir, '404.html'), 404);
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) sendFile(res, filePath);
    else sendFile(res, path.join(publicDir, '404.html'), 404);
  });
}).listen(PORT, () => {
  console.log(`🚀 Static site: http://localhost:${PORT}`);
  console.log('📦 Deploy public/ to Cloudflare Pages or Vercel.');
});
