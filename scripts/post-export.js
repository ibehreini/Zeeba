// Runs after `expo export -p web`. See the "build:web" script in package.json.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');

// Expo names its catch-all route file "+not-found.html", but Cloudflare looks
// for a literal "404.html" at the deploy root to serve for unmatched paths.
// Without this copy, a typo'd URL gets Cloudflare's generic branded error page
// instead of the app's own not-found screen. Copied rather than renamed so the
// Expo Router route itself keeps working.
const notFound = path.join(dist, '+not-found.html');
if (!fs.existsSync(notFound)) {
  console.error('post-export: dist/+not-found.html is missing - did the export succeed?');
  process.exit(1);
}
fs.copyFileSync(notFound, path.join(dist, '404.html'));

// The static export only makes sense on Cloudflare if the routing and header
// rules shipped with it, and both arrive purely by virtue of living in public/.
// A silent omission here 404s every /item/<uuid> link in production, so fail
// the build instead of letting it deploy half-configured. manifest.json and
// sw.js are on the same footing: without either one the site quietly demotes
// itself from an installable app to a bookmark, with nothing in the build log.
for (const required of [
  '_redirects',
  '_headers',
  'manifest.json',
  'sw.js',
  path.join('.well-known', 'apple-app-site-association'),
]) {
  if (!fs.existsSync(path.join(dist, required))) {
    console.error(`post-export: dist/${required} is missing - is it still in public/?`);
    process.exit(1);
  }
}

// Chrome's install criteria are checked against the manifest at runtime, so a
// typo'd or unregenerated icon path shows up only as a missing install button
// on a real device. Resolve the icons the manifest actually claims, plus the
// apple-touch-icon the iOS path depends on, and fail here instead.
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
const iconPaths = [...manifest.icons.map((icon) => icon.src), '/icons/apple-touch-icon.png'];
for (const iconPath of iconPaths) {
  if (!fs.existsSync(path.join(dist, iconPath.replace(/^\//, '')))) {
    console.error(
      `post-export: dist${iconPath} is missing - run \`node scripts/generate-pwa-icons.js\`.`,
    );
    process.exit(1);
  }
}

// Cloudflare's uploader silently skips every path segment named
// "node_modules", at any depth - and Expo emits library assets (the Ionicons
// icon font, react-navigation's header icons) under paths like
// dist/assets/node_modules/expo/node_modules/@expo/vector-icons/. Deployed
// as-is, those URLs fall through to the SPA fallback and serve index.html:
// the icon font "loads" with a 200, fails to parse, and every Ionicons glyph
// renders invisibly. Rename every such segment to "vendor" and rewrite the
// asset URLs inside the exported bundles to match.
function renameNodeModulesDirs(dir) {
  let renamed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let child = path.join(dir, entry.name);
    if (entry.name === 'node_modules') {
      const target = path.join(dir, 'vendor');
      if (fs.existsSync(target)) {
        console.error(`post-export: can't rename ${child} - ${target} already exists.`);
        process.exit(1);
      }
      fs.renameSync(child, target);
      child = target;
      renamed++;
    }
    renamed += renameNodeModulesDirs(child);
  }
  return renamed;
}

const assetsDir = path.join(dist, 'assets');
const renamedDirs = fs.existsSync(assetsDir) ? renameNodeModulesDirs(assetsDir) : 0;
let rewrittenBundles = 0;
if (renamedDirs > 0) {
  const jsDir = path.join(dist, '_expo', 'static', 'js', 'web');
  for (const file of fs.readdirSync(jsDir)) {
    if (!file.endsWith('.js')) continue;
    const filePath = path.join(jsDir, file);
    const source = fs.readFileSync(filePath, 'utf8');
    // Only rewrite node_modules inside asset URLs (strings starting with
    // "assets/"), never elsewhere in the bundle.
    const rewritten = source.replace(/assets\/[^"'`\\)\s]*/g, match =>
      match.split('node_modules').join('vendor'),
    );
    if (rewritten !== source) {
      fs.writeFileSync(filePath, rewritten);
      rewrittenBundles++;
    }
  }
  if (rewrittenBundles === 0) {
    console.error(
      `post-export: renamed ${renamedDirs} node_modules dir(s) under dist/assets but no bundle referenced them - asset URLs may be broken.`,
    );
    process.exit(1);
  }
}

console.log(
  `post-export: wrote dist/404.html, verified _redirects/_headers/.well-known, manifest + sw.js + ${iconPaths.length} icons, renamed ${renamedDirs} node_modules dir(s) + rewrote ${rewrittenBundles} bundle(s)`,
);
