/**
 * ID1Database over Cloudflare's D1 HTTP API, so the scheduled sync (GitHub
 * Actions) can write to the production database without a Worker.
 * Needs an API token with "D1 Edit" permission.
 */
import type { D1Result, ID1Database, ID1PreparedStatement } from '../server/db/d1Client';

export interface D1HttpConfig {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

async function query<T>(cfg: D1HttpConfig, sql: string, params: unknown[]): Promise<D1Result<T>> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`;
  let lastError = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    const body: any = await res.json().catch(() => null);
    if (res.ok && body?.success) {
      const first = body.result?.[0] ?? {};
      return { results: first.results ?? [], success: true, meta: first.meta };
    }
    lastError = body?.errors?.map((e: any) => e.message).join('; ') || `HTTP ${res.status}`;
    if (res.status < 500 && res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(`D1 HTTP query failed: ${lastError}`);
}

class HttpStatement implements ID1PreparedStatement {
  constructor(private cfg: D1HttpConfig, private sql: string, private params: unknown[] = []) {}
  bind(...values: unknown[]): ID1PreparedStatement {
    return new HttpStatement(this.cfg, this.sql, values.map((v) => (v === undefined ? null : v)));
  }
  async first<T = unknown>(colName?: string): Promise<T | null> {
    const row: any = (await query<T>(this.cfg, this.sql, this.params)).results[0];
    if (!row) return null;
    return colName ? (row[colName] ?? null) : row;
  }
  all<T = unknown>() {
    return query<T>(this.cfg, this.sql, this.params);
  }
  run<T = unknown>() {
    return query<T>(this.cfg, this.sql, this.params);
  }
}

export function createHttpD1(cfg: D1HttpConfig): ID1Database {
  return {
    prepare: (sql) => new HttpStatement(cfg, sql),
    // Not atomic over HTTP; the sync only batches idempotent upserts.
    async batch<T = unknown>(statements: ID1PreparedStatement[]) {
      const out: D1Result<T>[] = [];
      for (const s of statements) out.push(await s.run<T>());
      return out;
    },
    async exec(sql) {
      return query(cfg, sql, []);
    }
  };
}
