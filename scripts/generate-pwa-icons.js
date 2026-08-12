// Generates the PWA icon set into public/icons/ from the same source art the
// native app uses, so the home-screen icon can never drift from the app icon.
//
// Run manually after changing assets/images/icon.png or the adaptive icon:
//   node scripts/generate-pwa-icons.js
// The output is committed, and `expo export -p web` copies public/ verbatim
// into dist/ - so the build itself stays fast and offline, and a broken image
// pipeline can never take down a deploy.
//
// Uses @expo/image-utils (already a transitive Expo dependency). It prefers
// sharp and falls back to the bundled jimp-compact, so this needs no install.
const fs = require('fs');
const path = require('path');
const {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
} = require('@expo/image-utils');

const projectRoot = path.join(__dirname, '..');
const images = path.join(projectRoot, 'assets', 'images');
const outDir = path.join(projectRoot, 'public', 'icons');

// Matches android.adaptiveIcon.backgroundColor in app.config.ts.
const ADAPTIVE_BACKGROUND = '#E6F4FE';

async function resize({ src, width, height, backgroundColor, removeTransparency }) {
  const { source } = await generateImageAsync(
    { projectRoot, cacheType: 'pwa-icons' },
    {
      src,
      width,
      height,
      resizeMode: 'contain',
      backgroundColor,
      removeTransparency,
    },
  );
  return source;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const icon = path.join(images, 'icon.png');
  const written = [];

  const write = (name, buffer) => {
    fs.writeFileSync(path.join(outDir, name), buffer);
    written.push(`${name} (${(buffer.length / 1024).toFixed(1)}KB)`);
  };

  // purpose:"any" - Chrome requires a 192 and a 512 at these exact declared
  // sizes for the install prompt. Transparency is kept: the browser draws
  // these on its own surface and rounds them itself.
  write('icon-192.png', await resize({ src: icon, width: 192, height: 192 }));
  write('icon-512.png', await resize({ src: icon, width: 512, height: 512 }));

  // purpose:"maskable" - Android crops the icon to whatever shape the launcher
  // uses (circle, squircle, teardrop), so a plain icon gets its edges shaved.
  // The adaptive foreground is already drawn with that safe-zone padding, so
  // laying it over the adaptive background colour reproduces exactly what the
  // native launcher icon looks like.
  const background = await generateImageBackgroundAsync({
    width: 512,
    height: 512,
    backgroundColor: ADAPTIVE_BACKGROUND,
    resizeMode: 'cover',
  });
  const foreground = await resize({
    src: path.join(images, 'android-icon-foreground.png'),
    width: 512,
    height: 512,
  });
  write('icon-maskable-512.png', await compositeImagesAsync({ foreground, background }));

  // iOS ignores the manifest's icons for Add to Home Screen and reads
  // <link rel="apple-touch-icon"> instead. It also composites nothing behind a
  // transparent PNG - alpha comes out black - hence the flattened background.
  write(
    'apple-touch-icon.png',
    await resize({
      src: icon,
      width: 180,
      height: 180,
      backgroundColor: '#ffffff',
      removeTransparency: true,
    }),
  );

  console.log(`generate-pwa-icons: wrote ${written.length} icons to public/icons/`);
  for (const line of written) console.log(`  - ${line}`);
}

main().catch((error) => {
  console.error('generate-pwa-icons failed:', error);
  process.exit(1);
});
