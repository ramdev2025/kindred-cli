import path from "node:path";
import fs from "node:fs";
import { type Database, queryOne, queryAll, execute, saveDb, openDb, initDb } from "../db.js";
import { createLogger } from "../logging/index.js";

const log = createLogger("config");

export interface AppConfig {
  provider: "anthropic" | "openai" | "ollama";
  thinkingLevel: "low" | "medium" | "high" | "extra-high";
  mode: "plan" | "default" | "auto";
  model?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaHost?: string;
  skillPaths: string[];
}

const DEFAULTS: AppConfig = {
  provider: "anthropic",
  thinkingLevel: "medium",
  mode: "default",
  skillPaths: [],
};

export class ConfigManager {
  private db: Database;
  private dbPath: string;

  private constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.migrate();
    log.info(`Config database opened at ${dbPath}`);
  }

  static async create(dbPath?: string): Promise<ConfigManager> {
    await initDb();
    const configDir = path.join(
      process.env.HOME || process.env.USERPROFILE || ".",
      ".codecli"
    );
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const resolvedPath = dbPath ?? path.join(configDir, "codecli.db");
    const db = openDb(resolvedPath);
    return new ConfigManager(db, resolvedPath);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.save();
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    const row = queryOne<{ value: string }>(
      this.db,
      "SELECT value FROM config WHERE key = ?",
      [key]
    );

    if (!row) return DEFAULTS[key];

    try {
      return JSON.parse(row.value) as AppConfig[K];
    } catch {
      return row.value as AppConfig[K];
    }
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    execute(
      this.db,
      "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
      [key, serialized]
    );
    this.save();
    log.info(`Config set: ${key}`);
  }

  getAll(): Partial<AppConfig> {
    const rows = queryAll<{ key: string; value: string }>(
      this.db,
      "SELECT key, value FROM config"
    );

    const config: Partial<AppConfig> = {};
    for (const row of rows) {
      try {
        (config as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        (config as Record<string, unknown>)[row.key] = row.value;
      }
    }
    return { ...DEFAULTS, ...config };
  }

  delete(key: keyof AppConfig): void {
    execute(this.db, "DELETE FROM config WHERE key = ?", [key]);
    this.save();
    log.info(`Config deleted: ${key}`);
  }

  getDatabase(): Database {
    return this.db;
  }

  getDbPath(): string {
    return this.dbPath;
  }

  close(): void {
    this.db.close();
  }

  /**
   * Returns true if no API key or host is configured for any provider.
   * Used to detect first-run and trigger the setup wizard.
   */
  needsSetup(): boolean {
    const cfg = this.getAll();
    return !cfg.anthropicApiKey && !cfg.openaiApiKey && !cfg.ollamaHost;
  }

  private save(): void {
    saveDb(this.db, this.dbPath);
  }
}
