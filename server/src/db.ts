import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = process.env.SEED_PATH ?? resolve(here, "../../shared/protests.seed.json");

export function openDb(file = process.env.DB_PATH ?? "./data/outcry.db") {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
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
  `);
  const count = (db.prepare("SELECT COUNT(*) AS n FROM protests").get() as { n: number }).n;
  if (count === 0) seed(db);
  return db;
}

function seed(db: DatabaseSync) {
  const rows = JSON.parse(readFileSync(seedPath, "utf8")) as any[];
  const ins = db.prepare(`INSERT INTO protests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now = Date.now();
  db.exec("BEGIN");
  for (const p of rows) {
    const start = new Date(now - p.daysAgo * 86_400_000).toISOString();
    const articles = p.articles.map((a: any) => ({
      outlet: a.outlet, lean: a.lean, headline: a.headline,
      publishedAt: new Date(now - a.hoursAgo * 3_600_000).toISOString(),
    }));
    ins.run(p.id, p.title, p.summary, p.city, p.country, p.continent, p.lat, p.lng, start, p.crowdEstimate,
      p.topic, p.status, p.coverage.left, p.coverage.center, p.coverage.right, p.coverage.sourceCount,
      p.causeScore, p.actionScore, JSON.stringify(articles));
  }
  db.exec("COMMIT");
}
