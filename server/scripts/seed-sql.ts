// Writes SQL for `wrangler d1 execute`.
//   node scripts/seed-sql.ts live    -> switch a database to live ingestion (drops sample protests, clears votes) and ensure the schema
//   node scripts/seed-sql.ts sample  -> schema + sample data (local Workers dev)
import { readFileSync } from "node:fs";
import { INSERT_PROTEST, RESET_FOR_LIVE, SCHEMA, seedRows, type SeedProtest } from "../src/schema.ts";

const mode = process.argv[2] ?? "sample";
const lit = (v: unknown) => (typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const out: string[] = [];
if (mode === "live") out.push(RESET_FOR_LIVE);
out.push(SCHEMA);
if (mode === "sample") {
  const seed = JSON.parse(readFileSync(new URL("../../shared/protests.seed.json", import.meta.url), "utf8")) as SeedProtest[];
  out.push("DELETE FROM protests;");
  for (const row of seedRows(seed)) out.push(INSERT_PROTEST.replace(/\?/g, () => lit(row.shift())).replace(/\s+/g, " ") + ";");
}
console.log(out.join("\n"));
