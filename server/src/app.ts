import { Hono } from "hono";
import { cors } from "hono/cors";
import type { DatabaseSync } from "node:sqlite";
import {
  LEANS, MAX_VOICE, XP_PER_BRIDGE, badgesFor, dayKey, isBlindspot, levelOf, maxStrength, nextStreak, voteCost,
  type Lean, type VoteKind,
} from "../../shared/rules.ts";

const DEVICE_RE = /^[A-Za-z0-9-]{16,64}$/;

function protestRow(db: DatabaseSync, id: string) {
  const r = db.prepare(`
    SELECT p.*, p.cause_base + COALESCE((SELECT SUM(cause) FROM votes WHERE protest = p.id), 0) AS cause_score,
           p.action_base + COALESCE((SELECT SUM(action) FROM votes WHERE protest = p.id), 0) AS action_score
    FROM protests p WHERE p.id = ?`).get(id) as any;
  return r ? shape(r) : null;
}

function shape(r: any) {
  return {
    id: r.id, title: r.title, summary: r.summary, city: r.city, country: r.country, continent: r.continent,
    lat: r.lat, lng: r.lng, startDate: r.start_date, crowdEstimate: r.crowd, topic: r.topic, status: r.status,
    coverage: { left: r.cov_left, center: r.cov_center, right: r.cov_right, sourceCount: r.source_count },
    causeScore: r.cause_score, actionScore: r.action_score, articles: JSON.parse(r.articles),
  };
}

function me(db: DatabaseSync, device: string) {
  const today = dayKey();
  db.prepare("INSERT OR IGNORE INTO devices (id, created_at) VALUES (?, ?)").run(device, new Date().toISOString());
  const d = db.prepare("SELECT * FROM devices WHERE id = ?").get(device) as any;
  const spent = d.spent_day === today ? d.spent : 0;
  const votes: Record<string, { cause: number; action: number }> = {};
  for (const v of db.prepare("SELECT * FROM votes WHERE device = ?").all(device) as any[]) votes[v.protest] = { cause: v.cause, action: v.action };
  const reads: Record<string, Lean[]> = {};
  for (const r of db.prepare("SELECT protest, lean FROM reads WHERE device = ?").all(device) as any[]) (reads[r.protest] ||= []).push(r.lean);
  const meta = new Map((db.prepare("SELECT id, continent, cov_left, cov_right FROM protests").all() as any[]).map((p) => [p.id, p]));
  const fullyRead = Object.entries(reads)
    .filter(([, l]) => l.length === 3)
    .map(([id]) => meta.get(id)).filter(Boolean)
    .map((p: any) => ({ continent: p.continent, blindspot: isBlindspot({ left: p.cov_left, right: p.cov_right }) }));
  return {
    credits: MAX_VOICE - spent, xp: d.xp, level: levelOf(d.xp), streak: d.streak, votes, reads,
    badges: badgesFor(fullyRead, d.streak),
  };
}

export function createApp(db: DatabaseSync) {
  const app = new Hono();
  const origins = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());
  app.use("/api/*", cors({ origin: origins.includes("*") ? "*" : origins, allowHeaders: ["Content-Type", "X-Device-Id"] }));

  // Tiny fixed-window rate limit per client IP (state is per-process).
  const hits = new Map<string, { n: number; reset: number }>();
  app.use("/api/*", async (c, next) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + 60_000 });
    else if (++h.n > Number(process.env.RATE_LIMIT ?? 240)) return c.json({ error: "Too many requests" }, 429);
    if (hits.size > 10_000) hits.clear();
    await next();
  });

  const deviceOf = (c: any): string | null => {
    const id = c.req.header("x-device-id");
    return id && DEVICE_RE.test(id) ? id : null;
  };

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/protests", (c) => {
    const rows = db.prepare(`
      SELECT p.*, p.cause_base + COALESCE((SELECT SUM(cause) FROM votes WHERE protest = p.id), 0) AS cause_score,
             p.action_base + COALESCE((SELECT SUM(action) FROM votes WHERE protest = p.id), 0) AS action_score
      FROM protests p`).all() as any[];
    return c.json(rows.map(shape));
  });

  app.get("/api/protests/:id", (c) => {
    const p = protestRow(db, c.req.param("id"));
    return p ? c.json(p) : c.json({ error: "Not found" }, 404);
  });

  app.get("/api/me", (c) => {
    const device = deviceOf(c);
    return device ? c.json(me(db, device)) : c.json({ error: "Missing or invalid X-Device-Id" }, 400);
  });

  app.post("/api/protests/:id/reads", async (c) => {
    const device = deviceOf(c);
    if (!device) return c.json({ error: "Missing or invalid X-Device-Id" }, 400);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if (!protestRow(db, id)) return c.json({ error: "Not found" }, 404);
    if (!LEANS.includes(body.lean)) return c.json({ error: "Invalid lean" }, 400);
    me(db, device);
    const before = (db.prepare("SELECT COUNT(*) AS n FROM reads WHERE device = ? AND protest = ?").get(device, id) as any).n;
    db.prepare("INSERT OR IGNORE INTO reads VALUES (?,?,?)").run(device, id, body.lean);
    const after = (db.prepare("SELECT COUNT(*) AS n FROM reads WHERE device = ? AND protest = ?").get(device, id) as any).n;
    if (before < 3 && after === 3) {
      const today = dayKey();
      const d = db.prepare("SELECT streak, last_bridge FROM devices WHERE id = ?").get(device) as any;
      db.prepare("UPDATE devices SET xp = xp + ?, streak = ?, last_bridge = ? WHERE id = ?")
        .run(XP_PER_BRIDGE, nextStreak(d.streak, d.last_bridge, today), today, device);
    }
    return c.json(me(db, device));
  });

  app.post("/api/protests/:id/votes", async (c) => {
    const device = deviceOf(c);
    if (!device) return c.json({ error: "Missing or invalid X-Device-Id" }, 400);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const kind = body.kind as VoteKind;
    if (!protestRow(db, id)) return c.json({ error: "Not found" }, 404);
    if (kind !== "cause" && kind !== "action") return c.json({ error: "Invalid kind" }, 400);
    if (body.direction !== 1 && body.direction !== -1) return c.json({ error: "Invalid direction" }, 400);
    if (![1, 2, 3].includes(body.strength)) return c.json({ error: "Invalid strength" }, 400);

    const state = me(db, device);
    if (body.strength > maxStrength(state.reads[id] ?? [])) return c.json({ error: "Read all perspectives to unlock stronger votes" }, 403);
    const cost = voteCost(body.strength);
    if (cost > state.credits) return c.json({ error: "Not enough Voice left today" }, 402);

    const today = dayKey();
    db.prepare("UPDATE devices SET spent_day = ?, spent = ? WHERE id = ?").run(today, MAX_VOICE - state.credits + cost, device);
    db.prepare("INSERT OR IGNORE INTO votes (device, protest) VALUES (?, ?)").run(device, id);
    db.prepare(`UPDATE votes SET ${kind} = ${kind} + ? WHERE device = ? AND protest = ?`).run(body.direction * body.strength, device, id);
    return c.json({ me: me(db, device), protest: protestRow(db, id) });
  });

  return app;
}
