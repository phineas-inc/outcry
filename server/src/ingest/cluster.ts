import type { Lean } from "../../../shared/rules.ts";

export interface ArticleRow { url: string; title: string; domain: string; lean: Lean | null; published_at: string; city: string; country: string; topic: string }
export interface Geo { lat: number; lng: number; continent: string }
export interface Cluster { id: string; city: string; country: string; topic: string; geo: Geo; articles: ArticleRow[] }

export const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const HOUR = 3_600_000;
const top = (xs: string[]) => { const n = new Map<string, number>(); for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1); return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
const cellId = (country: string, lat: number, lng: number) => `${slug(country)}-${cell(lat)}-${cell(lng)}`;
const cell = (v: number) => { const n = Math.round(v * 2); return n < 0 ? `n${-n}` : String(n); };

/**
 * Groups protest articles into movements by geocoded location (~50 km cells, per country), so "Delhi", "New Delhi"
 * and nationwide-in-India articles land together. Nationwide articles (city == country) join the country's biggest
 * located cluster when one exists. Topic is the majority topic.
 */
export function clusterByPlace(rows: ArticleRow[], geoOf: (r: ArticleRow) => Geo | null): Cluster[] {
  const groups = new Map<string, { country: string; geo: Geo; rows: ArticleRow[]; national: boolean }>();
  for (const r of rows) {
    const geo = geoOf(r);
    if (!geo) continue;
    const national = slug(r.city) === slug(r.country);
    const key = national ? `${slug(r.country)}|national` : cellId(r.country, geo.lat, geo.lng);
    (groups.get(key) ?? groups.set(key, { country: r.country, geo, rows: [], national }).get(key)!).rows.push(r);
  }
  for (const [key, g] of [...groups]) {
    if (!g.national) continue;
    const biggest = [...groups.values()].filter((o) => !o.national && slug(o.country) === slug(g.country)).sort((a, b) => b.rows.length - a.rows.length)[0];
    if (biggest) { biggest.rows.push(...g.rows); groups.delete(key); }
  }
  return [...groups.entries()].map(([key, g]) => {
    const located = g.rows.filter((r) => slug(r.city) !== slug(r.country));
    return {
      id: g.national ? `${slug(g.country)}-national` : key,
      city: top((located.length ? located : g.rows).map((r) => r.city)), country: g.country, topic: top(g.rows.map((r) => r.topic)), geo: g.geo, articles: g.rows,
    };
  });
}

export const distinct = <T,>(xs: T[]) => [...new Set(xs)];

/** A cluster is shown once at least two outlets, or three articles, report it. */
export const isSignificant = (c: Cluster) => distinct(c.articles.map((a) => a.domain)).length >= 2 || c.articles.length >= 3;

export function coverageOf(articles: ArticleRow[]) {
  const domains = distinct(articles.map((a) => a.domain));
  const leanOfDomain = new Map<string, Lean>();
  for (const a of articles) if (a.lean) leanOfDomain.set(a.domain, a.lean);
  const rated = leanOfDomain.size;
  const n = (l: Lean) => [...leanOfDomain.values()].filter((x) => x === l).length;
  const pct = (l: Lean) => (rated ? Math.round((100 * n(l)) / rated) : 0);
  return { left: pct("Left"), center: pct("Center"), right: pct("Right"), rated, sourceCount: domains.length };
}

export function statusOf(articles: ArticleRow[], now: number): "active" | "escalating" | "winding down" {
  const ages = articles.map((a) => (now - Date.parse(a.published_at)) / HOUR);
  if (Math.min(...ages) > 48) return "winding down";
  const last24 = ages.filter((h) => h <= 24).length;
  const prev24 = ages.filter((h) => h > 24 && h <= 48).length;
  return last24 >= 4 && last24 >= 2 * prev24 ? "escalating" : "active";
}

/** Up to 3 newest articles per lean, for the source ledger. Unrated outlets count toward source totals only. */
export function pickArticles(articles: ArticleRow[]) {
  const out: { outlet: string; lean: Lean; headline: string; publishedAt: string; url: string }[] = [];
  for (const lean of ["Left", "Center", "Right"] as Lean[]) {
    const seen = new Set<string>();
    for (const a of [...articles].filter((x) => x.lean === lean).sort((x, y) => y.published_at.localeCompare(x.published_at))) {
      if (seen.size >= 3 || seen.has(a.domain)) continue;
      seen.add(a.domain);
      out.push({ outlet: a.domain, lean, headline: a.title, publishedAt: a.published_at, url: a.url });
    }
  }
  return out;
}

const CROWD_RE = /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand|million|m)?\s+(?:\w+\s+){0,2}?(?:protesters|demonstrators|marchers|people|workers|strikers|teachers|farmers|students|activists|residents|supporters)/i;
const CASUALTY_RE = /\b(kill\w*|dead|died|death\w*|injur\w*|wound\w*|arrest\w*|detain\w*|jail\w*|hurt|shot|fatal\w*)\b/i;

/** Largest crowd size explicitly stated in a headline (e.g. "40,000 protesters"); null otherwise. Reported figures, not verified counts. */
export function crowdFrom(headlines: string[]): number | null {
  let best: number | null = null;
  for (const h of headlines) {
    if (CASUALTY_RE.test(h)) continue;
    const m = h.match(CROWD_RE);
    if (!m) continue; // vague phrasing ("thousands", "tens of thousands") is deliberately ignored: no invented precision
    let n = parseFloat(m[1].replace(/,/g, ""));
    const unit = (m[2] ?? "").toLowerCase();
    if (unit === "k" || unit === "thousand") n *= 1_000;
    else if (unit === "million" || unit === "m") n *= 1_000_000;
    if (n && n >= 100 && n <= 20_000_000 && (best === null || n > best)) best = Math.round(n);
  }
  return best;
}
