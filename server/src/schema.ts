export const SCHEMA = `
CREATE TABLE IF NOT EXISTS protests (
  id TEXT PRIMARY KEY, title TEXT, summary TEXT, city TEXT, country TEXT, continent TEXT,
  lat REAL, lng REAL, start_date TEXT, crowd INTEGER, topic TEXT, status TEXT,
  cov_left INTEGER, cov_center INTEGER, cov_right INTEGER, source_count INTEGER,
  cause_base INTEGER, action_base INTEGER, articles TEXT
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, created_at TEXT, xp INTEGER DEFAULT 0, streak INTEGER DEFAULT 0,
  last_bridge TEXT, spent_day TEXT, spent INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS votes (
  device TEXT, protest TEXT, cause INTEGER DEFAULT 0, action INTEGER DEFAULT 0, PRIMARY KEY (device, protest)
);
CREATE TABLE IF NOT EXISTS reads (
  device TEXT, protest TEXT, lean TEXT, PRIMARY KEY (device, protest, lean)
);
`;

export interface SeedProtest {
  id: string; title: string; summary: string; city: string; country: string; continent: string; lat: number; lng: number;
  daysAgo: number; crowdEstimate: number; topic: string; status: string;
  coverage: { left: number; center: number; right: number; sourceCount: number };
  causeScore: number; actionScore: number; articles: { outlet: string; lean: string; headline: string; hoursAgo: number }[];
}

/** Parameter rows for `INSERT INTO protests VALUES (?,...)`, with dates resolved relative to `now`. */
export function seedRows(seed: SeedProtest[], now = Date.now()): unknown[][] {
  return seed.map((p) => [
    p.id, p.title, p.summary, p.city, p.country, p.continent, p.lat, p.lng,
    new Date(now - p.daysAgo * 86_400_000).toISOString(), p.crowdEstimate, p.topic, p.status,
    p.coverage.left, p.coverage.center, p.coverage.right, p.coverage.sourceCount, p.causeScore, p.actionScore,
    JSON.stringify(p.articles.map((a) => ({ outlet: a.outlet, lean: a.lean, headline: a.headline, publishedAt: new Date(now - a.hoursAgo * 3_600_000).toISOString() }))),
  ]);
}
export const INSERT_PROTEST = "INSERT INTO protests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
