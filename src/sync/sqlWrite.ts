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

export interface UpsertOptions {
  /** Columns left untouched on update (e.g. first_seen_at). */
  keepOnUpdate?: string[];
  /**
   * SQL condition (using `<table>.col` for the stored row and `excluded.col`
   * for the incoming one) that must hold for an existing row to be updated.
   * Rows that fail it are skipped and cost no D1 row writes. Without it every
   * conflicting row is rewritten, which on a 7,000-game catalog (plus its
   * indexes) burns tens of thousands of D1 "rows written" per run.
   */
  updateWhen?: string;
}

export interface UpsertResult {
  /** Rows offered to the upsert. */
  offered: number;
  /** Rows actually inserted or updated. */
  changed: number;
  /** D1's own "rows written" meter for these statements (includes index writes), when reported. */
  rowsWritten: number | null;
}

/** `(t.a IS NOT excluded.a OR t.b IS NOT excluded.b ...)`: true when any listed column differs. */
export function anyColumnChanged(table: string, columns: string[]): string {
  return `(${columns.map((c) => `${table}.${c} IS NOT excluded.${c}`).join(' OR ')})`;
}

export async function upsertRows(
  db: ID1Database,
  table: string,
  columns: string[],
  conflictKey: string,
  rows: SqlValue[][],
  options: UpsertOptions = {}
): Promise<UpsertResult> {
  const result: UpsertResult = { offered: rows.length, changed: 0, rowsWritten: null };
  if (rows.length === 0) return result;
  const keep = options.keepOnUpdate ?? [];
  const head = `INSERT INTO ${table} (${columns.join(', ')}) VALUES `;
  const updates = columns
    .filter((c) => c !== conflictKey && !keep.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  const tail = ` ON CONFLICT(${conflictKey}) DO UPDATE SET ${updates}${options.updateWhen ? ` WHERE ${options.updateWhen}` : ''}`;

  let chunk: string[] = [];
  let size = head.length + tail.length;
  const flush = async () => {
    if (chunk.length === 0) return;
    const res = await db.prepare(head + chunk.join(', ') + tail).run();
    result.changed += Number(res.meta?.changes ?? 0);
    if (typeof res.meta?.rows_written === 'number') result.rowsWritten = (result.rowsWritten ?? 0) + res.meta.rows_written;
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
  return result;
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
