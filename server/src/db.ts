import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INSERT_PROTEST, SCHEMA, seedRows, type SeedProtest } from "./schema.ts";
import type { Db } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = process.env.SEED_PATH ?? resolve(here, "../../shared/protests.seed.json");

/** node:sqlite-backed Db for local development, tests and the Docker image. */
export function openNodeDb(file = process.env.DB_PATH ?? "./data/outcry.db", opts: { seed?: boolean } = { seed: true }): Db {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec(SCHEMA);
  const count = (sqlite.prepare("SELECT COUNT(*) AS n FROM protests").get() as { n: number }).n;
  if (count === 0 && opts.seed !== false) {
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedProtest[];
    const ins = sqlite.prepare(INSERT_PROTEST);
    sqlite.exec("BEGIN");
    for (const row of seedRows(seed)) ins.run(...(row as any[]));
    sqlite.exec("COMMIT");
  }
  return {
    all: async (sql, ...p) => sqlite.prepare(sql).all(...(p as any[])) as any[],
    first: async (sql, ...p) => sqlite.prepare(sql).get(...(p as any[])) as any,
    run: async (sql, ...p) => ({ changes: Number(sqlite.prepare(sql).run(...(p as any[])).changes) }),
    batch: async (stmts) => {
      sqlite.exec("BEGIN");
      try { for (const [sql, ...p] of stmts) sqlite.prepare(sql).run(...(p as any[])); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
    },
  };
}
