/**
 * Thin wrapper around node:sqlite (built-in since Node 22).
 * Uses DatabaseSync for a fully synchronous API — no WASM init needed.
 */

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export type Database = DatabaseSync;

/**
 * Initialize the database module (no-op for node:sqlite, kept for API compat).
 */
export async function initDb(): Promise<void> {
  // node:sqlite requires no async init — this is a no-op
}

/**
 * Open or create a SQLite database file.
 */
export function openDb(filePath: string): DatabaseSync {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new DatabaseSync(filePath);
}

/**
 * Persist database to disk (no-op for node:sqlite — it writes directly).
 */
export function saveDb(_db: DatabaseSync, _filePath: string): void {
  // node:sqlite writes directly to the file — no manual persist needed
}

/**
 * Helper: run a query that returns rows as plain objects.
 */
export function queryAll<T = Record<string, unknown>>(
  db: DatabaseSync,
  sql: string,
  params?: SQLInputValue[]
): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...(params ?? [])) as T[];
}

/**
 * Helper: run a query that returns the first row.
 */
export function queryOne<T = Record<string, unknown>>(
  db: DatabaseSync,
  sql: string,
  params?: SQLInputValue[]
): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

/**
 * Helper: execute a statement (INSERT, UPDATE, DELETE) and return changes count.
 */
export function execute(
  db: DatabaseSync,
  sql: string,
  params?: SQLInputValue[]
): number {
  const stmt = db.prepare(sql);
  const result = stmt.run(...(params ?? []));
  return Number(result.changes);
}
