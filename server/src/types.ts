/** Minimal async SQL interface, implemented for node:sqlite (dev/tests) and Cloudflare D1 (production). */
export interface Db {
  all<T = any>(sql: string, ...params: unknown[]): Promise<T[]>;
  first<T = any>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  run(sql: string, ...params: unknown[]): Promise<{ changes: number }>;
  /** Runs statements atomically in one round trip. */
  batch(statements: [sql: string, ...params: unknown[]][]): Promise<void>;
}
