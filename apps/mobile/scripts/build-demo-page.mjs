// Packs the demo-mode web export into ONE self-contained HTML file (all JS,
// the icon font and images inlined) so it can be hosted anywhere, including
// sandboxed previews that block external files.
//
//   EXPO_PUBLIC_DEMO_MODE=true npx expo export --platform web --output-dir dist-demo
//   node scripts/build-demo-page.mjs            # → dist-demo/civicpass-demo.html
//
// The page body is written without <html>/<head>/<body> so hosts that wrap
// content in their own document skeleton can use it as-is; browsers render it
// fine standalone too.

import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist-demo');
const jsDir = path.join(dist, '_expo/static/js/web');
const entry = fs.readdirSync(jsDir).find((f) => f.startsWith('entry-') && f.endsWith('.js'));
if (!entry) throw new Error(`No entry bundle in ${jsDir}. Run the expo export first.`);
let js = fs.readFileSync(path.join(jsDir, entry), 'utf8');

const MIME = { '.png': 'image/png', '.ttf': 'font/ttf' };
// Inline the assets the app really uses. Other icon fonts bundled by
// @expo/vector-icons are never loaded, so they're left as (unused) paths.
const KEEP = [/\/Fonts\/Ionicons\.[a-f0-9]+\.ttf$/, /\/expo-router\/assets\/.*\.png$/];
let inlined = 0;
let bytes = 0;
js = js.replace(/"(\/assets\/[^"]+)"/g, (whole, url) => {
  if (!KEEP.some((re) => re.test(url))) return whole;
  const file = path.join(dist, url);
  if (!fs.existsSync(file)) return whole;
  const data = fs.readFileSync(file);
  inlined++;
  bytes += data.length;
  return `"data:${MIME[path.extname(file)]};base64,${data.toString('base64')}"`;
});

// Keep the bundle from closing or confusing the inline <script> element.
js = js.replaceAll('</script', '<\\/script').replaceAll('<script', '\\x3Cscript').replaceAll('<!--', '\\x3C!--');

const page = `<title>CivicPass</title>
<meta name="description" content="Prototype digital government wallet: licences, vehicle permits, camera tickets and services in one app. Demo data only.">
<style>
  /* Full-height app shell for react-native-web; colours follow the app's own theme tokens. */
  :root { --bg: #F4F6F9; --fg: #13202E; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0C131B; --fg: #E8EEF4; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #0C131B; --fg: #E8EEF4; color-scheme: dark; }
  html { height: 100%; box-sizing: border-box; }
  body { height: 100%; margin: 0; overflow: hidden; background: var(--bg); color: var(--fg); }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<noscript>CivicPass needs JavaScript to run.</noscript>
<div id="root"></div>
<script>
  // The app's router reads the URL path. Hosted copies live at arbitrary paths,
  // so start the app at its home route.
  try { if (location.pathname !== '/') history.replaceState(null, '', '/'); } catch (e) {}
</script>
<script>${js}</script>
`;

const out = path.join(dist, 'civicpass-demo.html');
fs.writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024 / 1024).toFixed(2)} MB, ${inlined} assets inlined, ${(bytes / 1024).toFixed(0)} KB)`);
