# Outcry

A live protest desk: track movements worldwide on a list or world map, see how Left / Center / Right media cover each one (with blindspots flagged), and weigh in with a daily budget of **Voice** using quadratic voting. Reading all three perspectives unlocks stronger votes and earns XP.

Website: https://tahire29-spec.github.io/outcry/

> **Data note:** this release ships with sample movements and fictional outlets. Live ingestion is not built yet.

## Layout

| Path | What |
| --- | --- |
| `web/` | React 19 + Vite + Tailwind website (landing, explore list/map, protest pages, profile, how-it-works, privacy). Responsive down to phones. |
| `server/` | Hono + SQLite API (Node 24, no native deps). Anonymous device identity, server-enforced Voice budget, read-to-unlock rule. |
| `shared/` | Game rules (`rules.ts`) and seed data used by both. |

The site talks to the API when `VITE_API_URL` is set and reachable; otherwise it runs **offline** with the same rules, storing progress in the browser.

## Develop

```bash
cd server && npm install && npm run dev      # API on :8787
cd web && npm install && npm run dev         # site on :5173, proxies /api to :8787
```

Tests: `cd server && npm test`.

## Deploy

**Website** deploys to GitHub Pages on every push to `main` (`.github/workflows/pages.yml`). To point it at your API, set a repository variable `API_URL` (Settings → Secrets and variables → Actions → Variables) and re-run the workflow.

**API** is a container (`server/Dockerfile`, build context = repo root). `render.yaml` is a Render blueprint; any Docker host works. Env: `PORT`, `DB_PATH` (default `/data/outcry.db`, mount a persistent volume), `ALLOWED_ORIGINS` (comma-separated site origins, default `*`), `RATE_LIMIT` (requests/min/IP, default 240).

## API

`GET /api/protests` · `GET /api/protests/:id` · `GET /api/me` · `POST /api/protests/:id/reads {lean}` · `POST /api/protests/:id/votes {kind, direction, strength}`. Identity is an `X-Device-Id` header (random UUID generated in the browser); this is anonymous and spoofable by design, so treat votes as non-authoritative until accounts exist.

## License

MIT
