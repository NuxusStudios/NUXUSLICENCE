import http from 'node:http';
import fs from 'node:fs';
const content = fs.readFileSync(process.argv[2], 'utf8');
// Mimic a publish skeleton: doctype, charset/viewport, light colour-scheme, safe-area padding, off-white ground.
const skeleton = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${content}</body></html>`;
http.createServer((req, res) => {
  if (req.url.startsWith('/host')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(`<!doctype html><body style="margin:0"><iframe id="app" sandbox="allow-scripts allow-forms" src="/artifact/abc123/view" style="border:0;width:100vw;height:100vh"></iframe></body>`);
  }
  // Any other path (including '/' after the app rewrites its URL) serves the page, like a static host would on reload.
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(skeleton);
}).listen(8090, () => console.log('host on 8090'));
