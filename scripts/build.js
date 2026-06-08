const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const required = ['index.html', 'admin.html', '404.html', 'site-data.js', 'robots.txt', 'sitemap.xml'];
const missing = required.filter((file) => !fs.existsSync(path.join(publicDir, file)));

if (missing.length) {
  console.error(`Missing public files: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Static build ready: deploy the public/ directory.');
