import type { Db } from "./types.ts";

/** Minimal structural type for Cloudflare's D1Database so this package needs no Workers typings. */
export interface D1Like {
  prepare(sql: string): { bind(...p: unknown[]): { all(): Promise<{ results: any[] }>; first(): Promise<any>; run(): Promise<{ meta: { changes: number } }> } };
}

export const d1Db = (d1: D1Like): Db => ({
  all: async (sql, ...p) => (await d1.prepare(sql).bind(...p).all()).results,
  first: async (sql, ...p) => (await d1.prepare(sql).bind(...p).first()) ?? undefined,
  run: async (sql, ...p) => ({ changes: (await d1.prepare(sql).bind(...p).run()).meta.changes }),
});
