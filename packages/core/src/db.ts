/**
 * Thin wrapper around sql.js providing a synchronous-looking API.
 * sql.js loads WASM and must be initialized async once, but
 * after that, queries are synchronous (it's an in-memory DB
 * that we manually persist to disk).
 */

import initSqlJs from "sql.js";
import type { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";
import fs from "node:fs";
import path from "node:path";

export type Database = SqlJsDatabase;

let SQL: SqlJsStatic | null = null;

/**
 * Initialize the sql.js WASM module (call once at startup).
 */
export async function initDb(): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
}

/**
 * Open or create a SQLite database file.
 * Must call initDb() before this.
 */
export function openDb(filePath: string): SqlJsDatabase {
  if (!SQL) throw new Error("Call initDb() before openDb()");

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    return new SQL.Database(buffer);
  }

  return new SQL.Database();
}

/**
 * Persist database to disk.
 */
export function saveDb(db: SqlJsDatabase, filePath: string): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
}

/**
 * Helper: run a query that returns rows as plain objects.
 */
export function queryAll<T = Record<string, unknown>>(
  db: SqlJsDatabase,
  sql: string,
  params?: unknown[]
): T[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

/**
 * Helper: run a query that returns the first row.
 */
export function queryOne<T = Record<string, unknown>>(
  db: SqlJsDatabase,
  sql: string,
  params?: unknown[]
): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

/**
 * Helper: execute a statement (INSERT, UPDATE, DELETE) and return changes count.
 */
export function execute(
  db: SqlJsDatabase,
  sql: string,
  params?: unknown[]
): number {
  db.run(sql, params);
  return db.getRowsModified();
}
