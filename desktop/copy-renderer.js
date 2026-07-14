// Copies the built frontend into desktop/renderer so electron-builder can package it.
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'frontend', 'dist');
const dest = path.join(__dirname, 'renderer');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('frontend/dist not found. Run `npm run build` in frontend/ first');
  console.error('(remember to set VITE_API_BASE_URL to your deployed backend URL).');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
