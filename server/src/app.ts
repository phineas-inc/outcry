import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "hono/adapter";
import {
  LEANS, MAX_VOICE, XP_PER_BRIDGE, badgesFor, dayKey, isBlindspot, levelOf, maxStrength, nextStreak, voteCost,
  type Lean, type VoteKind,
} from "../../shared/rules.ts";
import { d1Db, type D1Like } from "./d1.ts";
import type { Db } from "./types.ts";

const nodeEnv: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
const DEVICE_RE = /^[A-Za-z0-9-]{16,64}$/;

const PROTEST_SQL = `
  SELECT p.*, p.cause_base + COALESCE((SELECT SUM(cause) FROM votes WHERE protest = p.id), 0) AS cause_score,
         p.action_base + COALESCE((SELECT SUM(action) FROM votes WHERE protest = p.id), 0) AS action_score
  FROM protests p`;

function shape(r: any) {
  return {
    id: r.id, title: r.title, summary: r.summary, city: r.city, country: r.country, continent: r.continent,
    lat: r.lat, lng: r.lng, startDate: r.start_date, crowdEstimate: r.crowd, topic: r.topic, status: r.status,
    coverage: { left: r.cov_left, center: r.cov_center, right: r.cov_right, sourceCount: r.source_count },
    causeScore: r.cause_score, actionScore: r.action_score, articles: JSON.parse(r.articles),
  };
}

async function protestRow(db: Db, id: string) {
  const r = await db.first(`${PROTEST_SQL} WHERE p.id = ?`, id);
  return r ? shape(r) : null;
}

async function me(db: Db, device: string) {
  const today = dayKey();
  await db.run("INSERT OR IGNORE INTO devices (id, created_at) VALUES (?, ?)", device, new Date().toISOString());
  const [d, voteRows, readRows, metaRows] = await Promise.all([
    db.first("SELECT * FROM devices WHERE id = ?", device),
    db.all("SELECT * FROM votes WHERE device = ?", device),
    db.all("SELECT protest, lean FROM reads WHERE device = ?", device),
    db.all("SELECT id, continent, cov_left, cov_right FROM protests"),
  ]);
  const spent = d.spent_day === today ? d.spent : 0;
  const votes: Record<string, { cause: number; action: number }> = {};
  for (const v of voteRows) votes[v.protest] = { cause: v.cause, action: v.action };
  const reads: Record<string, Lean[]> = {};
  for (const r of readRows) (reads[r.protest] ||= []).push(r.lean);
  const meta = new Map(metaRows.map((p: any) => [p.id, p]));
  const fullyRead = Object.entries(reads)
    .filter(([, l]) => l.length === 3)
    .map(([id]) => meta.get(id)).filter(Boolean)
    .map((p: any) => ({ continent: p.continent, blindspot: isBlindspot({ left: p.cov_left, right: p.cov_right }) }));
  return { credits: MAX_VOICE - spent, xp: d.xp, level: levelOf(d.xp), streak: d.streak, votes, reads, badges: badgesFor(fullyRead, d.streak) };
}

type Bindings = { DB?: D1Like; ALLOWED_ORIGINS?: string; RATE_LIMIT?: string };
type Vars = { db: Db };

/** Pass `db` for Node; on Cloudflare Workers omit it and bind a D1 database as `DB`. */
export function createApp(opts: { db?: Db } = {}) {
  const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

  app.use("/api/*", cors({
    origin: (origin, c) => {
      const allowed = (env(c).ALLOWED_ORIGINS ?? nodeEnv.ALLOWED_ORIGINS ?? "*").split(",").map((s: string) => s.trim());
      return allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : "";
    },
    allowHeaders: ["Content-Type", "X-Device-Id"],
  }));

  app.use("/api/*", async (c, next) => {
    const bound = c.env?.DB;
    if (opts.db) c.set("db", opts.db);
    else if (bound) c.set("db", d1Db(bound));
    else return c.json({ error: "No database configured" }, 500);
    await next();
  });

  // Fixed-window rate limit per client IP. State is per-process/isolate, so it's a best-effort guard only.
  const hits = new Map<string, { n: number; reset: number }>();
  app.use("/api/*", async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    const now = Date.now();
    const limit = Number(env(c).RATE_LIMIT ?? nodeEnv.RATE_LIMIT ?? 240);
    const h = hits.get(ip);
    if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + 60_000 });
    else if (++h.n > limit) return c.json({ error: "Too many requests" }, 429);
    if (hits.size > 10_000) hits.clear();
    await next();
  });

  const deviceOf = (c: any): string | null => {
    const id = c.req.header("x-device-id");
    return id && DEVICE_RE.test(id) ? id : null;
  };
  const noDevice = (c: any) => c.json({ error: "Missing or invalid X-Device-Id" }, 400);

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/protests", async (c) => c.json((await c.var.db.all(PROTEST_SQL)).map(shape)));

  app.get("/api/protests/:id", async (c) => {
    const p = await protestRow(c.var.db, c.req.param("id"));
    return p ? c.json(p) : c.json({ error: "Not found" }, 404);
  });

  app.get("/api/me", async (c) => {
    const device = deviceOf(c);
    return device ? c.json(await me(c.var.db, device)) : noDevice(c);
  });

  app.post("/api/protests/:id/reads", async (c) => {
    const db = c.var.db;
    const device = deviceOf(c);
    if (!device) return noDevice(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (!(await protestRow(db, id))) return c.json({ error: "Not found" }, 404);
    if (!LEANS.includes(body.lean)) return c.json({ error: "Invalid lean" }, 400);
    await me(db, device);
    const count = async () => (await db.first("SELECT COUNT(*) AS n FROM reads WHERE device = ? AND protest = ?", device, id)).n as number;
    const before = await count();
    await db.run("INSERT OR IGNORE INTO reads VALUES (?,?,?)", device, id, body.lean);
    if (before < 3 && (await count()) === 3) {
      const today = dayKey();
      const d = await db.first("SELECT streak, last_bridge FROM devices WHERE id = ?", device);
      await db.run("UPDATE devices SET xp = xp + ?, streak = ?, last_bridge = ? WHERE id = ?", XP_PER_BRIDGE, nextStreak(d.streak, d.last_bridge, today), today, device);
    }
    return c.json(await me(db, device));
  });

  app.post("/api/protests/:id/votes", async (c) => {
    const db = c.var.db;
    const device = deviceOf(c);
    if (!device) return noDevice(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const kind = body.kind as VoteKind;
    if (!(await protestRow(db, id))) return c.json({ error: "Not found" }, 404);
    if (kind !== "cause" && kind !== "action") return c.json({ error: "Invalid kind" }, 400);
    if (body.direction !== 1 && body.direction !== -1) return c.json({ error: "Invalid direction" }, 400);
    if (![1, 2, 3].includes(body.strength)) return c.json({ error: "Invalid strength" }, 400);

    const state = await me(db, device);
    if (body.strength > maxStrength(state.reads[id] ?? [])) return c.json({ error: "Read all perspectives to unlock stronger votes" }, 403);
    const cost = voteCost(body.strength);

    // Atomic spend: only succeeds if today's remaining Voice covers the cost, even under concurrent requests.
    const today = dayKey();
    const spend = await db.run(
      `UPDATE devices SET spent = (CASE WHEN spent_day = ?1 THEN spent ELSE 0 END) + ?2, spent_day = ?1
       WHERE id = ?3 AND (CASE WHEN spent_day = ?1 THEN spent ELSE 0 END) + ?2 <= ?4`,
      today, cost, device, MAX_VOICE);
    if (spend.changes !== 1) return c.json({ error: "Not enough Voice left today" }, 402);

    await db.run("INSERT OR IGNORE INTO votes (device, protest) VALUES (?, ?)", device, id);
    await db.run(`UPDATE votes SET ${kind} = ${kind} + ? WHERE device = ? AND protest = ?`, body.direction * body.strength, device, id);
    return c.json({ me: await me(db, device), protest: await protestRow(db, id) });
  });

  return app;
}
