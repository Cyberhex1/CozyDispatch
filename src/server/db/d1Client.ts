/**
 * src/server/db/d1Client.ts
 *
 * Universal Cloudflare D1 database interface & local SQLite driver.
 * Operates seamlessly on both:
 * 1. Cloudflare Workers / Pages Functions (via `env.DB` native D1 binding)
 * 2. Node.js runtime for dev/testing/scripts (via native `node:sqlite` DatabaseSync)
 */

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: Record<string, any>;
  error?: string;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface ID1PreparedStatement {
  bind(...values: any[]): ID1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface ID1Database {
  prepare(query: string): ID1PreparedStatement;
  batch<T = unknown>(statements: ID1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

// ============================================================================
// Node.js SQLite Driver for Local Development & Automated Tests
// ============================================================================

let localSqliteInstance: ID1Database | null = null;

export async function createLocalSqliteD1(dbFilePath?: string): Promise<ID1Database> {
  // Dynamically import node:sqlite and fs/path in Node environments only
  const { DatabaseSync } = await import('node:sqlite');
  const fs = await import('node:fs');
  const path = await import('node:path');

  const resolvedPath = dbFilePath || path.join(process.cwd(), '.data', 'cozydispatch.sqlite');
  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);

  // Enable WAL mode, busy timeout & foreign keys for SQLite performance & multi-process consistency
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Automatically ensure tables from schema.sql exist
  const schemaPath = path.join(process.cwd(), 'd1', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  class NodePreparedStatement implements ID1PreparedStatement {
    private query: string;
    private boundValues: any[];

    constructor(query: string, boundValues: any[] = []) {
      this.query = query;
      this.boundValues = boundValues;
    }

    bind(...values: any[]): ID1PreparedStatement {
      // Flatten arrays if passed as single array
      const flat = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
      return new NodePreparedStatement(this.query, flat);
    }

    async first<T = unknown>(colName?: string): Promise<T | null> {
      try {
        const stmt = db.prepare(this.query);
        const row: any = stmt.get(...this.boundValues);
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      } catch (err: any) {
        console.error('[D1 Local SQLite] Error in first():', err.message, '\nQuery:', this.query);
        throw err;
      }
    }

    async all<T = unknown>(): Promise<D1Result<T>> {
      try {
        const stmt = db.prepare(this.query);
        const rows: any = stmt.all(...this.boundValues);
        return {
          results: (rows as T[]) || [],
          success: true
        };
      } catch (err: any) {
        console.error('[D1 Local SQLite] Error in all():', err.message, '\nQuery:', this.query);
        return {
          results: [],
          success: false,
          error: err.message
        };
      }
    }

    async run<T = unknown>(): Promise<D1Result<T>> {
      try {
        const stmt = db.prepare(this.query);
        const result = stmt.run(...this.boundValues);
        return {
          results: [],
          success: true,
          meta: {
            changes: result.changes,
            last_row_id: result.lastInsertRowid
          }
        };
      } catch (err: any) {
        console.error('[D1 Local SQLite] Error in run():', err.message, '\nQuery:', this.query);
        return {
          results: [],
          success: false,
          error: err.message
        };
      }
    }

    async raw<T = unknown>(): Promise<T[]> {
      const stmt = db.prepare(this.query);
      const rows: any = stmt.all(...this.boundValues);
      return rows.map((r: any) => Object.values(r)) as T[];
    }
  }

  const d1Adapter: ID1Database = {
    prepare(query: string): ID1PreparedStatement {
      return new NodePreparedStatement(query);
    },
    async batch<T = unknown>(statements: ID1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      db.exec('BEGIN TRANSACTION;');
      try {
        for (const stmt of statements) {
          const res = await stmt.run<T>();
          results.push(res);
        }
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
      return results;
    },
    async exec(query: string): Promise<D1ExecResult> {
      const start = Date.now();
      db.exec(query);
      return { count: 1, duration: Date.now() - start };
    }
  };

  return d1Adapter;
}

/**
 * Universal resolver for the D1 database instance.
 * Accepts optional Cloudflare env containing `DB`.
 */
export async function getDb(env?: { DB?: ID1Database }): Promise<ID1Database> {
  if (env && env.DB) {
    return env.DB;
  }
  if (!localSqliteInstance) {
    localSqliteInstance = await createLocalSqliteD1();
  }
  return localSqliteInstance;
}
