import { type Database, queryAll, queryOne, execute, saveDb } from "../db.js";
import Fuse from "fuse.js";
import { Cache } from "../cache/index.js";
import { createLogger } from "../logging/index.js";

const log = createLogger("skills");

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  template: string;
  version: number;
  shortcutKey?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface SkillRow {
  id: string;
  name: string;
  description: string;
  template: string;
  version: number;
  shortcut_key: string | null;
  tags: string;
  created_at: number;
  updated_at: number;
}

function rowToSkill(row: SkillRow): SkillDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    template: row.template,
    version: row.version,
    shortcutKey: row.shortcut_key ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SkillRegistry {
  private db: Database;
  private dbPath: string;
  private cache: Cache;
  private fuse: Fuse<SkillDefinition> | null = null;

  constructor(db: Database, dbPath: string, cache: Cache) {
    this.db = db;
    this.dbPath = dbPath;
    this.cache = cache;
    this.migrate();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS skills (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        template     TEXT NOT NULL,
        version      INTEGER NOT NULL DEFAULT 1,
        shortcut_key TEXT,
        tags         TEXT NOT NULL DEFAULT '[]',
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );
    `);
    this.save();
  }

  private invalidateIndex(): void {
    this.fuse = null;
  }

  private buildIndex(): Fuse<SkillDefinition> {
    if (this.fuse) return this.fuse;
    const skills = this.list();
    this.fuse = new Fuse(skills, {
      keys: ["name", "description", "tags"],
      threshold: 0.4,
    });
    return this.fuse;
  }

  create(
    skill: Omit<SkillDefinition, "version" | "createdAt" | "updatedAt">
  ): SkillDefinition {
    const now = Date.now();
    execute(
      this.db,
      `INSERT INTO skills (id, name, description, template, version, shortcut_key, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        skill.id,
        skill.name,
        skill.description,
        skill.template,
        skill.shortcutKey ?? null,
        JSON.stringify(skill.tags),
        now,
        now,
      ]
    );
    this.save();
    this.invalidateIndex();
    log.info(`Skill created: ${skill.id}`);
    return { ...skill, version: 1, createdAt: now, updatedAt: now };
  }

  get(id: string): SkillDefinition | null {
    const cached = this.cache.get<SkillDefinition>(`skill:${id}`);
    if (cached) return cached;

    const row = queryOne<SkillRow>(
      this.db,
      "SELECT * FROM skills WHERE id = ?",
      [id]
    );
    if (!row) return null;

    const skill = rowToSkill(row);
    this.cache.set(`skill:${id}`, skill, 300_000);
    return skill;
  }

  list(): SkillDefinition[] {
    const rows = queryAll<SkillRow>(
      this.db,
      "SELECT * FROM skills ORDER BY name"
    );
    return rows.map(rowToSkill);
  }

  update(
    id: string,
    updates: Partial<Pick<SkillDefinition, "name" | "description" | "template" | "shortcutKey" | "tags">>
  ): SkillDefinition | null {
    const existing = this.get(id);
    if (!existing) return null;

    const now = Date.now();
    execute(
      this.db,
      `UPDATE skills
       SET name = ?, description = ?, template = ?, shortcut_key = ?, tags = ?,
           version = version + 1, updated_at = ?
       WHERE id = ?`,
      [
        updates.name ?? existing.name,
        updates.description ?? existing.description,
        updates.template ?? existing.template,
        updates.shortcutKey ?? existing.shortcutKey ?? null,
        JSON.stringify(updates.tags ?? existing.tags),
        now,
        id,
      ]
    );
    this.cache.delete(`skill:${id}`);
    this.save();
    this.invalidateIndex();
    log.info(`Skill updated: ${id}`);
    return this.get(id);
  }

  delete(id: string): boolean {
    const changes = execute(
      this.db,
      "DELETE FROM skills WHERE id = ?",
      [id]
    );
    this.cache.delete(`skill:${id}`);
    this.save();
    this.invalidateIndex();
    if (changes > 0) log.info(`Skill deleted: ${id}`);
    return changes > 0;
  }

  search(query: string): SkillDefinition[] {
    const fuse = this.buildIndex();
    return fuse.search(query).map((r) => r.item);
  }

  getByShortcut(key: string): SkillDefinition | null {
    const row = queryOne<SkillRow>(
      this.db,
      "SELECT * FROM skills WHERE shortcut_key = ?",
      [key]
    );
    return row ? rowToSkill(row) : null;
  }

  private save(): void {
    saveDb(this.db, this.dbPath);
  }
}
