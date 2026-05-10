import { type Database, queryAll, queryOne, execute, saveDb } from "../db.js";
import { createLogger } from "../logging/index.js";

const log = createLogger("cache");

export class Cache {
  private db: Database;
  private dbPath: string;
  private defaultTtlMs: number;

  constructor(db: Database, dbPath: string, defaultTtlMs: number = 3600_000) {
    this.db = db;
    this.dbPath = dbPath;
    this.defaultTtlMs = defaultTtlMs;
    this.migrate();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL
      );
    `);
  }

  get<T = unknown>(key: string): T | null {
    const now = Date.now();
    const row = queryOne<{ value: string; expires_at: number | null }>(
      this.db,
      "SELECT value, expires_at FROM cache WHERE key = ?",
      [key]
    );

    if (!row) return null;
    if (row.expires_at && row.expires_at < now) {
      this.delete(key);
      return null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as T;
    }
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttl > 0 ? now + ttl : null;
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);

    execute(
      this.db,
      `INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
      [key, serialized, expiresAt, now]
    );
    this.save();
  }

  delete(key: string): void {
    execute(this.db, "DELETE FROM cache WHERE key = ?", [key]);
    this.save();
  }

  prune(): number {
    const changes = execute(
      this.db,
      "DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at < ?",
      [Date.now()]
    );
    if (changes > 0) {
      log.info(`Cache pruned ${changes} expired entries`);
      this.save();
    }
    return changes;
  }

  clear(): void {
    this.db.run("DELETE FROM cache");
    this.save();
    log.info("Cache cleared");
  }

  private save(): void {
    saveDb(this.db, this.dbPath);
  }
}
