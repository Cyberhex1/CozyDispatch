/**
 * Node-only D1 stand-in backed by node:sqlite (Node >= 22.5).
 * Used by server.ts (local dev / `npm start`) and scripts. Never imported by
 * the Cloudflare Pages Function.
 *
 * Behaves like real D1 where it matters: failed statements throw, batch() is
 * atomic, and migrations from d1/migrations are applied in order.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { D1Result, ID1Database, ID1PreparedStatement } from './d1Client';

const MIGRATIONS_DIR = path.join(process.cwd(), 'd1', 'migrations');

function applyMigrations(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    (db.prepare('SELECT name FROM _local_migrations').all() as { name: string }[]).map((r) => r.name)
  );
  const files = fs.existsSync(MIGRATIONS_DIR)
    ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    : [];
  for (const file of files) {
    if (applied.has(file)) continue;
    db.exec('BEGIN');
    try {
      db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      db.prepare('INSERT INTO _local_migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

// node:sqlite rejects `undefined` and booleans; D1 accepts booleans as 0/1.
function normalize(values: unknown[]): any[] {
  return values.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

class LocalStatement implements ID1PreparedStatement {
  constructor(private db: DatabaseSync, private query: string, private values: unknown[] = []) {}

  bind(...values: unknown[]): ID1PreparedStatement {
    return new LocalStatement(this.db, this.query, normalize(values));
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const row = this.db.prepare(this.query).get(...(this.values as any[])) as any;
    if (!row) return null;
    return colName ? ((row[colName] ?? null) as T) : (row as T);
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const rows = this.db.prepare(this.query).all(...(this.values as any[])) as T[];
    return { results: rows, success: true };
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    const stmt = this.db.prepare(this.query);
    // RETURNING clauses produce rows; plain writes produce change counts.
    if (/\breturning\b/i.test(this.query)) {
      return { results: stmt.all(...(this.values as any[])) as T[], success: true };
    }
    const res = stmt.run(...(this.values as any[]));
    return { results: [], success: true, meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) } };
  }
}

export function createLocalD1(dbFilePath = path.join(process.cwd(), '.data', 'cozydispatch.sqlite')): ID1Database {
  if (dbFilePath !== ':memory:') fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  const db = new DatabaseSync(dbFilePath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  applyMigrations(db);

  return {
    prepare: (query) => new LocalStatement(db, query),
    async batch<T = unknown>(statements: ID1PreparedStatement[]) {
      const results: D1Result<T>[] = [];
      db.exec('BEGIN');
      try {
        for (const s of statements) results.push(await s.run<T>());
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return results;
    },
    async exec(query) {
      db.exec(query);
      return {};
    }
  };
}
