const fs = require('node:fs');
const path = require('node:path');

const src = 'electron/kds/public';
const dest = 'dist-electron/kds/public';

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
