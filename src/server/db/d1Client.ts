/**
 * Minimal D1 typings shared by the Cloudflare runtime (env.DB) and the local
 * node:sqlite adapter in ./localSqlite.ts.
 *
 * This file must stay free of Node-only imports: it is bundled into the
 * Cloudflare Pages Function.
 */

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: Record<string, any>;
}

export interface ID1PreparedStatement {
  bind(...values: unknown[]): ID1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

export interface ID1Database {
  prepare(query: string): ID1PreparedStatement;
  batch<T = unknown>(statements: ID1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<unknown>;
}
