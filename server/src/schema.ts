export const SCHEMA = `
CREATE TABLE IF NOT EXISTS protests (
  id TEXT PRIMARY KEY, title TEXT, summary TEXT, summary_ai INTEGER DEFAULT 0, city TEXT, country TEXT, continent TEXT,
  lat REAL, lng REAL, start_date TEXT, crowd INTEGER, topic TEXT, status TEXT,
  cov_left INTEGER, cov_center INTEGER, cov_right INTEGER, rated INTEGER DEFAULT 0, source_count INTEGER,
  cause_base INTEGER DEFAULT 0, action_base INTEGER DEFAULT 0, articles TEXT,
  article_count INTEGER DEFAULT 0, summarized_count INTEGER DEFAULT 0, first_seen TEXT, last_seen TEXT, hidden INTEGER DEFAULT 0
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
CREATE TABLE IF NOT EXISTS seen_articles (
  url TEXT PRIMARY KEY, title TEXT, domain TEXT, lean TEXT, published_at TEXT, seen_at TEXT,
  state TEXT DEFAULT 'new', is_protest INTEGER DEFAULT 0, city TEXT, country TEXT, topic TEXT
);
CREATE INDEX IF NOT EXISTS seen_state ON seen_articles(state, published_at);
CREATE TABLE IF NOT EXISTS geocache (
  key TEXT PRIMARY KEY, ok INTEGER, lat REAL, lng REAL, continent TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

/** One-off: replaces the sample-data protests table when moving a database to live ingestion. */
export const RESET_FOR_LIVE = `DROP TABLE IF EXISTS protests; DELETE FROM votes; DELETE FROM reads;`;

export interface SeedProtest {
  id: string; title: string; summary: string; city: string; country: string; continent: string; lat: number; lng: number;
  daysAgo: number; crowdEstimate: number; topic: string; status: string;
  coverage: { left: number; center: number; right: number; sourceCount: number };
  causeScore: number; actionScore: number; articles: { outlet: string; lean: string; headline: string; hoursAgo: number }[];
}

export const INSERT_PROTEST = `INSERT INTO protests (id,title,summary,city,country,continent,lat,lng,start_date,crowd,topic,status,
  cov_left,cov_center,cov_right,rated,source_count,cause_base,action_base,articles,article_count,first_seen,last_seen)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

/** Sample data (offline mode, local dev, tests). Dates are resolved relative to \`now\`. */
export function seedRows(seed: SeedProtest[], now = Date.now()): unknown[][] {
  return seed.map((p) => {
    const start = new Date(now - p.daysAgo * 86_400_000).toISOString();
    const articles = p.articles.map((a) => ({ outlet: a.outlet, lean: a.lean, headline: a.headline, publishedAt: new Date(now - a.hoursAgo * 3_600_000).toISOString() }));
    return [p.id, p.title, p.summary, p.city, p.country, p.continent, p.lat, p.lng, start, p.crowdEstimate, p.topic, p.status,
      p.coverage.left, p.coverage.center, p.coverage.right, p.coverage.sourceCount, p.coverage.sourceCount, p.causeScore, p.actionScore,
      JSON.stringify(articles), articles.length, start, new Date(now).toISOString()];
  });
}
