import type { Db } from "./types.ts";

/** Minimal structural type for Cloudflare's D1Database so this package needs no Workers typings. */
interface D1Stmt { bind(...p: unknown[]): D1Bound }
interface D1Bound { all(): Promise<{ results: any[] }>; first(): Promise<any>; run(): Promise<{ meta: { changes: number } }> }
export interface D1Like { prepare(sql: string): D1Stmt; batch(stmts: D1Bound[]): Promise<unknown> }

export const d1Db = (d1: D1Like): Db => ({
  all: async (sql, ...p) => (await d1.prepare(sql).bind(...p).all()).results,
  first: async (sql, ...p) => (await d1.prepare(sql).bind(...p).first()) ?? undefined,
  run: async (sql, ...p) => ({ changes: (await d1.prepare(sql).bind(...p).run()).meta.changes }),
  batch: async (stmts) => { for (let i = 0; i < stmts.length; i += 50) await d1.batch(stmts.slice(i, i + 50).map(([sql, ...p]) => d1.prepare(sql).bind(...p))); },
});
