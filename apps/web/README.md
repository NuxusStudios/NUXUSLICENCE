# CivicPass marketing website

A standalone, framework-free consumer site for CivicPass — where residents learn
about the app and get it. No build step: it's static HTML + one stylesheet block +
image assets, so it deploys anywhere.

## Structure

- `index.html` — the whole page (inline CSS, self-contained).
- `assets/` — app screenshots used as the phone previews.

## Run locally

Any static server, e.g.:

```bash
cd apps/web && python3 -m http.server 8090
# open http://localhost:8090
```

## Deploy

Point any static host at this folder (`apps/web`):

- **Netlify / Vercel / Cloudflare Pages** — set the project/publish directory to `apps/web`, no build command.
- **GitHub Pages** — publish the folder, or copy its contents to the Pages branch.
- Custom domain (e.g. `civicpass.ca`) — add it in the host's domain settings.

## Notes

- The App Store / Google Play buttons are marked **Soon** — the apps aren't
  published yet. The primary live CTA links to the interactive demo.
- The footer carries the prototype disclaimer (not affiliated with the
  Government of Ontario; screens use demo data). Keep it until the product ships.
- Content is English; add a French version before a public Ontario launch (the app
  itself is already bilingual).
