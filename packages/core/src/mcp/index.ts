import { type Database, queryAll, queryOne, execute, saveDb } from "../db.js";
import { createLogger } from "../logging/index.js";
import { DEFAULT_MCP_SERVERS } from "./defaults.js";

const log = createLogger("mcp");

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface McpRow {
  id: string;
  name: string;
  command: string;
  args: string;
  env: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

function rowToConfig(row: McpRow): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    args: row.args ? JSON.parse(row.args) : [],
    env: row.env ? JSON.parse(row.env) : {},
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class McpRegistry {
  private db: Database;
  private dbPath: string;

  constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        command    TEXT NOT NULL,
        args       TEXT NOT NULL DEFAULT '[]',
        env        TEXT NOT NULL DEFAULT '{}',
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    this.save();
  }

  add(
    server: Omit<McpServerConfig, "enabled" | "createdAt" | "updatedAt">
  ): McpServerConfig {
    const now = Date.now();
    execute(
      this.db,
      `INSERT INTO mcp_servers (id, name, command, args, env, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        server.id,
        server.name,
        server.command,
        JSON.stringify(server.args),
        JSON.stringify(server.env),
        now,
        now,
      ]
    );
    this.save();
    log.info(`MCP server added: ${server.id}`);
    return { ...server, enabled: true, createdAt: now, updatedAt: now };
  }

  get(id: string): McpServerConfig | null {
    const row = queryOne<McpRow>(
      this.db,
      "SELECT * FROM mcp_servers WHERE id = ?",
      [id]
    );
    return row ? rowToConfig(row) : null;
  }

  list(): McpServerConfig[] {
    const rows = queryAll<McpRow>(
      this.db,
      "SELECT * FROM mcp_servers ORDER BY name"
    );
    return rows.map(rowToConfig);
  }

  listEnabled(): McpServerConfig[] {
    const rows = queryAll<McpRow>(
      this.db,
      "SELECT * FROM mcp_servers WHERE enabled = 1 ORDER BY name"
    );
    return rows.map(rowToConfig);
  }

  update(
    id: string,
    updates: Partial<Pick<McpServerConfig, "name" | "command" | "args" | "env">>
  ): McpServerConfig | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = Date.now();
    execute(
      this.db,
      `UPDATE mcp_servers
       SET name = ?, command = ?, args = ?, env = ?, updated_at = ?
       WHERE id = ?`,
      [
        updates.name ?? existing.name,
        updates.command ?? existing.command,
        JSON.stringify(updates.args ?? existing.args),
        JSON.stringify(updates.env ?? existing.env),
        now,
        id,
      ]
    );
    this.save();
    log.info(`MCP server updated: ${id}`);
    return this.get(id);
  }

  enable(id: string): boolean {
    const changes = execute(
      this.db,
      "UPDATE mcp_servers SET enabled = 1, updated_at = ? WHERE id = ?",
      [Date.now(), id]
    );
    this.save();
    if (changes > 0) log.info(`MCP server enabled: ${id}`);
    return changes > 0;
  }

  disable(id: string): boolean {
    const changes = execute(
      this.db,
      "UPDATE mcp_servers SET enabled = 0, updated_at = ? WHERE id = ?",
      [Date.now(), id]
    );
    this.save();
    if (changes > 0) log.info(`MCP server disabled: ${id}`);
    return changes > 0;
  }

  setEnv(id: string, key: string, value: string): McpServerConfig | null {
    const existing = this.get(id);
    if (!existing) return null;
    const env = { ...existing.env, [key]: value };
    return this.update(id, { env });
  }

  removeEnv(id: string, key: string): McpServerConfig | null {
    const existing = this.get(id);
    if (!existing) return null;
    const env = { ...existing.env };
    delete env[key];
    return this.update(id, { env });
  }

  remove(id: string): boolean {
    const changes = execute(
      this.db,
      "DELETE FROM mcp_servers WHERE id = ?",
      [id]
    );
    this.save();
    if (changes > 0) log.info(`MCP server removed: ${id}`);
    return changes > 0;
  }

  /**
   * Seed default MCP servers if they don't already exist.
   * Idempotent — safe to call on every startup.
   * Returns the number of servers created.
   */
  seedDefaults(): number {
    let created = 0;
    for (const server of DEFAULT_MCP_SERVERS) {
      if (!this.get(server.id)) {
        const now = Date.now();
        execute(
          this.db,
          `INSERT INTO mcp_servers (id, name, command, args, env, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            server.id,
            server.name,
            server.command,
            JSON.stringify(server.args),
            JSON.stringify(server.env),
            server.enabledByDefault ? 1 : 0,
            now,
            now,
          ]
        );
        this.save();
        log.info(`Default MCP server seeded: ${server.id} (${server.enabledByDefault ? "enabled" : "disabled"})`);
        created++;
      }
    }
    if (created > 0) {
      log.info(`Seeded ${created} default MCP server(s)`);
    }
    return created;
  }

  private save(): void {
    saveDb(this.db, this.dbPath);
  }
}
