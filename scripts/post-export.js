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

console.log(
  `post-export: wrote dist/404.html, verified _redirects/_headers/.well-known, manifest + sw.js + ${iconPaths.length} icons`,
);
