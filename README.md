# Outcry

A live protest desk: track movements worldwide on a list or world map, see how Left / Center / Right media cover each one (with blindspots flagged), and weigh in with a daily budget of **Voice** using quadratic voting. Reading all three perspectives unlocks stronger votes and earns XP.

Website: https://phineas-inc.github.io/outcry/

> **Data:** movements are built from real, current news. A bot reads public RSS feeds from ~40 outlets every hour, an AI model (Cloudflare Workers AI, free tier) picks out real protests and writes neutral titles/summaries **from the headlines only**, and stories reported by 2+ outlets become movements. Summaries can be wrong, so every movement links to its source articles. Left/Center/Right labels are approximate (`server/src/ingest/outlets.ts`, editable). Offline mode (no API) shows sample data instead.

## How the live data works

`server/src/ingest/` runs as four staged Cloudflare cron triggers (staged to fit the free plan's CPU limit):

| Cron (UTC) | Stage | What |
| --- | --- | --- |
| `:05`, `:12` | `collect`, `collect2` | Fetch RSS feeds, keep headlines that look like protest coverage, store new ones. (GDELT is attempted but usually rate-limits; it's optional.) |
| `:20`, `:50` | `classify` | AI labels each new headline: real protest or not, city, country, topic. Capped at 100 AI calls/day. |
| `:35` | `build` | Geocode places (Open-Meteo, cached), cluster by location, compute coverage split and status, write neutral AI summaries, upsert movements, hide ones with no news for 7 days. |

Nothing is scraped from article pages; only headlines and links from feeds published for syndication. Crowd sizes appear only when a headline states an explicit number.

## Layout

| Path | What |
| --- | --- |
| `web/` | React 19 + Vite + Tailwind website. The home page is the world map; `/feed` is the list; `/p/:id` and `/feed/p/:id` are shareable protest links; `/about` explains Outcry and how it works; `/me`, `/privacy`, `/accessibility`. English and German, light and dark, responsive down to 320 px. |
| `server/` | Hono API for Cloudflare Workers + D1, or Node 24 + SQLite. Anonymous device identity, server-enforced Voice budget, read-to-unlock rule. |
| `shared/` | Game rules (`rules.ts`) and seed data used by both. |

The site talks to the API when `VITE_API_URL` is set and reachable; otherwise it runs **offline** with the same rules, storing progress in the browser.

## Develop

```bash
cd server && npm install && npm run dev      # API on :8787
cd web && npm install && npm run dev         # site on :5173, proxies /api to :8787
```

Tests: `cd server && npm test`.

## Deploy (free)

**Website** deploys to GitHub Pages on every push to `main` (`.github/workflows/pages.yml`). To point it at your API, set a repository variable `API_URL` (Settings → Secrets and variables → Actions → Variables) and re-run the workflow.

**API** runs on Cloudflare Workers + D1 (free plan, no card, always on):

```bash
cd server && npm install
npx wrangler login
npx wrangler d1 create outcry          # copy the database_id into wrangler.toml
npm run migrate:live                   # creates the schema
openssl rand -hex 24 | npx wrangler secret put INGEST_TOKEN   # protects the manual trigger
npm run deploy                         # prints https://outcry-api.<you>.workers.dev; cron triggers start hourly
```

Then set the repo variable `API_URL` to that URL. To fill the dashboard immediately instead of waiting for the crons: `curl -X POST -H "Authorization: Bearer $INGEST_TOKEN" "$API/api/admin/ingest?stage=collect"` (then `collect2`, `classify`, `build`). Local Workers dev: `npm run dev:worker` (local D1, port 8788). `ALLOWED_ORIGINS` in `wrangler.toml` limits which sites may call the API.

The same code also runs on plain Node + SQLite (`npm run dev`, or `server/Dockerfile` with build context = repo root) for self-hosting.

## API

`GET /api/protests` · `GET /api/protests/:id` · `GET /api/status` · `GET /api/me` · `POST /api/protests/:id/reads {lean}` · `POST /api/protests/:id/votes {kind, direction, strength}`. Identity is an `X-Device-Id` header (random UUID generated in the browser); this is anonymous and spoofable by design, so treat votes as non-authoritative until accounts exist.

## License

MIT
