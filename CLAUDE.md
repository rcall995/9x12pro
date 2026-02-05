# Project Instructions for Claude

## Deployment

- Deploy command: `vercel --prod` (GitHub push does NOT auto-deploy)
- After deploying, always verify with `curl -s "https://9x12pro.com/app.html" | grep -o "v=49[0-9]" | head -1` or similar

## Version Management

- The **app version** lives in ONE place only: `config.js` → `APP_CONFIG.app.version`
- Cache-busting for script tags in `app.html` is **automatic** (uses `Date.now()` timestamp) — no manual sync needed
- When bumping the version for a deploy, update ONLY `config.js`

## Key Architecture Notes

- `app-main.js` is a large single-file app (~30k lines). Be careful with function name collisions (last definition wins in JS).
- Campaign Board (`renderCampaignBoard`) is the primary pipeline view. Legacy kanban (`renderKanban`) is a thin wrapper that delegates to it.
- Vercel serverless functions live in `/api`. Environment variables are in Vercel dashboard and `.env.local`.
