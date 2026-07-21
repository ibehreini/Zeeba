const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (target !== 'docker' && target !== 'remote') {
  console.error('Usage: node scripts/use-env.js <docker|remote>');
  process.exit(1);
}

const src = path.join(__dirname, '..', `.env.${target}.local`);
const dest = path.join(__dirname, '..', '.env.local');
fs.copyFileSync(src, dest);
console.log(`.env.local now points at ${target}. Restart "npx expo start" (with -c) for it to take effect.`);
