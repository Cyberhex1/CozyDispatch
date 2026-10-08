/**
 * Bulk upsert helper that works the same on D1 bindings, the D1 HTTP API and
 * local SQLite. D1 caps bound parameters at 100 per statement, so rows are
 * written as escaped literals in multi-row INSERTs instead (values here are
 * produced by our own sync code, and every value is typed and escaped).
 */
import type { ID1Database } from '../server/db/d1Client';

export type SqlValue = string | number | boolean | null | undefined;

export function sqlLiteral(value: SqlValue): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  // Strip NULs (not valid in SQLite text literals) and escape quotes.
  return `'${value.replace(/\u0000/g, '').replace(/'/g, "''")}'`;
}

const MAX_STATEMENT_BYTES = 90_000; // D1 limit is 100 KB per statement

export async function upsertRows(
  db: ID1Database,
  table: string,
  columns: string[],
  conflictKey: string,
  rows: SqlValue[][],
  /** Columns left untouched on update (e.g. first_seen_at). */
  keepOnUpdate: string[] = []
): Promise<number> {
  if (rows.length === 0) return 0;
  const head = `INSERT INTO ${table} (${columns.join(', ')}) VALUES `;
  const updates = columns
    .filter((c) => c !== conflictKey && !keepOnUpdate.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  const tail = ` ON CONFLICT(${conflictKey}) DO UPDATE SET ${updates}`;

  let written = 0;
  let chunk: string[] = [];
  let size = head.length + tail.length;
  const flush = async () => {
    if (chunk.length === 0) return;
    await db.prepare(head + chunk.join(', ') + tail).run();
    written += chunk.length;
    chunk = [];
    size = head.length + tail.length;
  };

  for (const row of rows) {
    const tuple = `(${row.map(sqlLiteral).join(', ')})`;
    if (size + tuple.length + 2 > MAX_STATEMENT_BYTES) await flush();
    chunk.push(tuple);
    size += tuple.length + 2;
  }
  await flush();
  return written;
}

export async function recordSyncRun(
  db: ID1Database,
  target: string,
  startedAt: Date,
  status: 'success' | 'error',
  stats: Record<string, unknown>,
  error?: string
) {
  await db
    .prepare(
      `INSERT INTO sync_runs (id, target, status, started_at, finished_at, stats_json, error) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `${target}-${startedAt.getTime()}`,
      target,
      status,
      startedAt.toISOString(),
      new Date().toISOString(),
      JSON.stringify(stats),
      error ?? null
    )
    .run();
}
