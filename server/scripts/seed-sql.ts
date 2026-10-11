// Writes schema + seed data as SQL for `wrangler d1 execute`. Usage: node scripts/seed-sql.ts > seed.sql
import { readFileSync } from "node:fs";
import { SCHEMA, seedRows, type SeedProtest } from "../src/schema.ts";

const seed = JSON.parse(readFileSync(new URL("../../shared/protests.seed.json", import.meta.url), "utf8")) as SeedProtest[];
const lit = (v: unknown) => (typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const out = [SCHEMA, "DELETE FROM protests;"];
for (const row of seedRows(seed)) out.push(`INSERT INTO protests VALUES (${row.map(lit).join(",")});`);
console.log(out.join("\n"));
