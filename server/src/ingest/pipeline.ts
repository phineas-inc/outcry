import type { Db } from "../types.ts";
import { classifyHeadlines, summarizeCluster, type AiLike } from "./classify.ts";
import { clusterByPlace, coverageOf, crowdFrom, isSignificant, pickArticles, statusOf, type ArticleRow } from "./cluster.ts";
import { geocode } from "./geo.ts";
import { FEED_GROUPS, leanOf } from "./outlets.ts";
import { fetchFeeds, fetchGdelt, isProtestHeadline, type Fetch } from "./sources.ts";

export interface Deps { fetch: Fetch; ai?: AiLike; now?: number }
export type Stage = "collect" | "collect2" | "classify" | "build";

const DAY = 86_400_000;
const AI_DAILY_CALLS = 100; // ≈ 75 neurons per call, so well inside Workers AI's free 10k neurons/day
const MAX_GEOCODES_PER_RUN = 10;
const MAX_SUMMARIES_PER_RUN = 8;

const getMeta = async (db: Db, key: string) => (await db.first<{ value: string }>("SELECT value FROM meta WHERE key = ?", key))?.value ?? null;
const setMeta = (db: Db, key: string, value: string) => db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);

/** Counts one AI call against today's budget; false when the day's budget is spent. */
async function spendAi(db: Db, now: number): Promise<boolean> {
  const day = new Date(now).toISOString().slice(0, 10);
  const [d, n] = [await getMeta(db, "ai_day"), Number((await getMeta(db, "ai_calls")) ?? 0)];
  const used = d === day ? n : 0;
  if (used >= AI_DAILY_CALLS) return false;
  await db.batch([["INSERT OR REPLACE INTO meta (key, value) VALUES ('ai_day', ?)", day], ["INSERT OR REPLACE INTO meta (key, value) VALUES ('ai_calls', ?)", String(used + 1)]]);
  return true;
}

export async function collect(db: Db, deps: Deps, group = 0) {
  const now = deps.now ?? Date.now();
  // GDELT is best-effort and queried only with the first group (it allows one request per 5 s).
  const [{ items, failed }, gdelt] = await Promise.all([fetchFeeds(deps.fetch, FEED_GROUPS[group]), group === 0 ? fetchGdelt(deps.fetch) : Promise.resolve({ items: [], status: "skipped" as number | string })]);
  const cutoff = now - 3 * DAY;
  const fresh = [...items, ...gdelt.items].filter((c) => isProtestHeadline(c.title) && Date.parse(c.publishedAt) > cutoff);
  await db.batch(fresh.map((c) => [
    "INSERT OR IGNORE INTO seen_articles (url, title, domain, lean, published_at, seen_at) VALUES (?,?,?,?,?,?)",
    c.url, c.title.slice(0, 300), c.domain, leanOf(c.domain), c.publishedAt, new Date(now).toISOString(),
  ]));
  await setMeta(db, "last_collect", new Date(now).toISOString());
  return { fetched: items.length, gdelt: gdelt.items.length, gdeltStatus: gdelt.status, candidates: fresh.length, failedFeeds: failed };
}

export async function classify(db: Db, deps: Deps) {
  const now = deps.now ?? Date.now();
  await db.run("UPDATE seen_articles SET state = 'skip' WHERE state = 'new' AND seen_at < ?", new Date(now - 2 * DAY).toISOString());
  if (!deps.ai) return { classified: 0, protests: 0, note: "no AI binding" };
  const rows = await db.all<{ url: string; title: string }>("SELECT url, title FROM seen_articles WHERE state = 'new' ORDER BY published_at DESC LIMIT 75");
  let classified = 0, protests = 0, raw: string | undefined;
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    if (!(await spendAi(db, now))) return { classified, protests, note: "daily AI budget reached" };
    let result;
    try { result = await classifyHeadlines(deps.ai, chunk.map((r) => r.title), (r) => { raw ??= JSON.stringify(r).slice(0, 400); }); } catch (e) { return { classified, protests, error: String(e).slice(0, 200) }; }
    const byIndex = new Map(result.map((r) => [r.i, r]));
    await db.batch(chunk.flatMap((row, idx): [string, ...unknown[]][] => {
      const r = byIndex.get(idx);
      if (!r) return [];
      const isP = r.protest && r.country ? 1 : 0;
      classified++; protests += isP;
      return [["UPDATE seen_articles SET state = 'done', is_protest = ?, city = ?, country = ?, topic = ? WHERE url = ?", isP, r.city ?? r.country, r.country, r.topic, row.url]];
    }));
  }
  await setMeta(db, "last_classify", new Date(now).toISOString());
  return { classified, protests, ...(raw ? { unparsed: raw } : {}) };
}

export async function build(db: Db, deps: Deps) {
  const now = deps.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const rows = await db.all<ArticleRow>(
    "SELECT url, title, domain, lean, published_at, city, country, topic FROM seen_articles WHERE state = 'done' AND is_protest = 1 AND published_at > ? AND city IS NOT NULL AND country IS NOT NULL",
    new Date(now - 10 * DAY).toISOString());
  for (const r of rows) if (/^(unspecified|unknown|n\/a|none|nationwide|national|various|multiple)$/i.test(r.city.trim())) r.city = r.country;

  // Geocode each distinct place, cache-first (Open-Meteo, free). Unresolved places are retried on later runs.
  const cache = new Map((await db.all<{ key: string; ok: number; lat: number; lng: number; continent: string }>("SELECT * FROM geocache")).map((g) => [g.key, g]));
  const placeKey = (r: { city: string; country: string }) => `${r.city}|${r.country}`.toLowerCase();
  let lookups = 0;
  for (const r of rows) {
    const key = placeKey(r);
    if (cache.has(key) || lookups >= MAX_GEOCODES_PER_RUN) continue;
    lookups++;
    try {
      const p = await geocode(deps.fetch, r.city, r.country);
      const row = { key, ok: p ? 1 : 0, lat: p?.lat ?? 0, lng: p?.lng ?? 0, continent: p?.continent ?? "" };
      cache.set(key, row);
      await db.run("INSERT OR REPLACE INTO geocache VALUES (?,?,?,?,?)", row.key, row.ok, row.lat, row.lng, row.continent);
    } catch { /* transient; retry next run */ }
  }
  const clusters = clusterByPlace(rows, (r) => { const g = cache.get(placeKey(r)); return g?.ok ? { lat: g.lat, lng: g.lng, continent: g.continent } : null; }).filter(isSignificant);

  const existing = new Map((await db.all<any>("SELECT id, title, summary, summary_ai, summarized_count, first_seen FROM protests")).map((p) => [p.id, p]));
  const writes: [string, ...unknown[]][] = [];
  let summaries = 0, written = 0;
  for (const c of clusters) {
    const geo = c.geo;
    const prev = existing.get(c.id);
    const newest = [...c.articles].sort((a, b) => b.published_at.localeCompare(a.published_at));
    let { title, summary, summary_ai: ai, summarized_count: summarized } = prev ?? { title: "", summary: "", summary_ai: 0, summarized_count: 0 };
    if (deps.ai && summaries < MAX_SUMMARIES_PER_RUN && (!prev || c.articles.length - summarized >= 3) && (await spendAi(db, now))) {
      summaries++;
      try {
        const s = await summarizeCluster(deps.ai, `${c.city}, ${c.country}`, newest.slice(0, 8).map((a) => a.title));
        if (s) { title = s.title; summary = s.summary; ai = 1; summarized = c.articles.length; }
      } catch { /* keep previous copy */ }
    }
    if (!title) { title = newest[0].title.slice(0, 90); summary = ""; ai = 0; }
    const cov = coverageOf(c.articles);
    const articles = pickArticles(c.articles);
    writes.push([
      `INSERT INTO protests (id,title,summary,summary_ai,city,country,continent,lat,lng,start_date,crowd,topic,status,cov_left,cov_center,cov_right,rated,source_count,articles,article_count,summarized_count,first_seen,last_seen,hidden)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, summary=excluded.summary, summary_ai=excluded.summary_ai, continent=excluded.continent, lat=excluded.lat, lng=excluded.lng,
         start_date=excluded.start_date, crowd=excluded.crowd, status=excluded.status, cov_left=excluded.cov_left, cov_center=excluded.cov_center, cov_right=excluded.cov_right,
         rated=excluded.rated, source_count=excluded.source_count, articles=excluded.articles, article_count=excluded.article_count, summarized_count=excluded.summarized_count,
         last_seen=excluded.last_seen, hidden=0`,
      c.id, title, summary, ai, c.city, c.country, geo.continent, geo.lat, geo.lng,
      newest[newest.length - 1].published_at, crowdFrom(c.articles.map((a) => a.title)), c.topic, statusOf(c.articles, now),
      cov.left, cov.center, cov.right, cov.rated, cov.sourceCount, JSON.stringify(articles), c.articles.length, summarized,
      prev?.first_seen ?? nowIso, newest[0].published_at,
    ]);
    written++;
  }
  // Anything not rebuilt this run (merged into another movement, or no longer significant) leaves the dashboard; it returns if rebuilt later.
  const keep = clusters.filter((c) => c.geo).map((c) => c.id);
  writes.push([`UPDATE protests SET hidden = 1 WHERE last_seen < ? OR id NOT IN (${keep.map(() => "?").join(",") || "''"})`, new Date(now - 7 * DAY).toISOString(), ...keep]);
  writes.push(["DELETE FROM seen_articles WHERE published_at < ?", new Date(now - 10 * DAY).toISOString()]);
  await db.batch(writes);
  await setMeta(db, "last_build", nowIso);
  return { clusters: clusters.length, written, geocoded: lookups, summaries };
}

export async function runStage(stage: Stage | "all", db: Db, deps: Deps) {
  const out: Record<string, unknown> = {};
  if (stage === "all" || stage === "collect") out.collect = await collect(db, deps, 0);
  if (stage === "all" || stage === "collect2") out.collect2 = await collect(db, deps, 1);
  if (stage === "all" || stage === "classify") out.classify = await classify(db, deps);
  if (stage === "all" || stage === "build") out.build = await build(db, deps);
  return out;
}
