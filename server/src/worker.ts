// Cloudflare Workers entry. Bindings (DB, AI, ALLOWED_ORIGINS) and cron triggers come from wrangler.toml.
import { createApp } from "./app.ts";
import { d1Db } from "./d1.ts";
import { runStage, type Stage } from "./ingest/pipeline.ts";

const app = createApp();
// One cron expression per stage keeps each invocation inside the free plan's CPU limit.
const STAGE_BY_CRON: Record<string, Stage> = { "5 * * * *": "collect", "12 * * * *": "collect2", "20,50 * * * *": "classify", "35 * * * *": "build" };

export default {
  fetch: app.fetch,
  async scheduled(event: { cron: string }, env: any, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const stage = STAGE_BY_CRON[event.cron];
    if (!stage) return;
    ctx.waitUntil(runStage(stage, d1Db(env.DB), { fetch: (u, i) => fetch(u, i), ai: env.AI }).then((r) => console.log(stage, JSON.stringify(r))));
  },
};
