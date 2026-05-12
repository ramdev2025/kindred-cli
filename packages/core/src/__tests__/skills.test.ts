import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initDb, openDb, type Database } from "../db.js";
import { Cache } from "../cache/index.js";
import { SkillRegistry, type SkillDefinition } from "../skills/index.js";
import { DEFAULT_SKILLS } from "../skills/defaults.js";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

function tmpDbPath(): string {
  return path.join(os.tmpdir(), `codecli-test-${randomUUID()}.db`);
}

describe("SkillRegistry", () => {
  let db: Database;
  let dbPath: string;
  let cache: Cache;
  let registry: SkillRegistry;

  beforeAll(async () => {
    await initDb();
  });

  beforeEach(() => {
    dbPath = tmpDbPath();
    db = openDb(dbPath);
    cache = new Cache(db, dbPath);
    registry = new SkillRegistry(db, dbPath, cache);
  });

  it("should create a skill and retrieve it", () => {
    const skill = registry.create({
      id: "test-skill",
      name: "Test Skill",
      description: "A test skill for unit tests",
      template: "You are a helpful assistant.",
      tags: ["default", "test"],
    });

    expect(skill.id).toBe("test-skill");
    expect(skill.version).toBe(1);
    expect(skill.createdAt).toBeGreaterThan(0);

    const retrieved = registry.get("test-skill");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe("Test Skill");
  });

  it("should list all skills ordered by name", () => {
    registry.create({ id: "b", name: "Bravo", description: "", template: "", tags: [] });
    registry.create({ id: "a", name: "Alpha", description: "", template: "", tags: [] });

    const skills = registry.list();
    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe("Alpha");
    expect(skills[1].name).toBe("Bravo");
  });

  it("should update a skill and increment version", () => {
    registry.create({ id: "upd", name: "Original", description: "", template: "v1", tags: [] });
    const updated = registry.update("upd", { name: "Updated", template: "v2" });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated");
    expect(updated!.template).toBe("v2");
    expect(updated!.version).toBe(2);
  });

  it("should return null when updating nonexistent skill", () => {
    expect(registry.update("nope", { name: "X" })).toBeNull();
  });

  it("should delete a skill", () => {
    registry.create({ id: "del", name: "Delete Me", description: "", template: "", tags: [] });
    expect(registry.delete("del")).toBe(true);
    expect(registry.get("del")).toBeNull();
    expect(registry.delete("del")).toBe(false);
  });

  it("should fuzzy search by name and description", () => {
    registry.create({ id: "py", name: "Python Helper", description: "Assists with Python code", template: "", tags: ["python"] });
    registry.create({ id: "ts", name: "TypeScript Expert", description: "TypeScript guidance", template: "", tags: ["typescript"] });

    const results = registry.search("python");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("py");
  });

  it("should get skill by shortcut key", () => {
    registry.create({ id: "sc", name: "Shortcut Skill", description: "", template: "", shortcutKey: "shift+tab", tags: [] });

    const found = registry.getByShortcut("shift+tab");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("sc");

    expect(registry.getByShortcut("nonexistent")).toBeNull();
  });

  it("should cache skill lookups", () => {
    registry.create({ id: "cached", name: "Cached", description: "", template: "", tags: [] });

    // First call — DB lookup
    const first = registry.get("cached");
    expect(first).not.toBeNull();

    // Second call — should come from cache
    const second = registry.get("cached");
    expect(second).toEqual(first);
  });

  describe("seedDefaults", () => {
    it("should create all default skills on empty database", () => {
      const count = registry.seedDefaults();
      expect(count).toBe(DEFAULT_SKILLS.length);

      const skills = registry.list();
      expect(skills.length).toBe(DEFAULT_SKILLS.length);

      for (const def of DEFAULT_SKILLS) {
        const skill = registry.get(def.id);
        expect(skill).not.toBeNull();
        expect(skill!.name).toBe(def.name);
        expect(skill!.template).toBe(def.template);
        expect(skill!.tags).toEqual(def.tags);
      }
    });

    it("should be idempotent — no duplicates on second call", () => {
      registry.seedDefaults();
      const secondCount = registry.seedDefaults();
      expect(secondCount).toBe(0);

      const skills = registry.list();
      expect(skills.length).toBe(DEFAULT_SKILLS.length);
    });

    it("should not overwrite user-modified default skills", () => {
      registry.seedDefaults();
      registry.update("software-engineer", { name: "My Custom Engineer" });

      const thirdCount = registry.seedDefaults();
      expect(thirdCount).toBe(0);

      const skill = registry.get("software-engineer");
      expect(skill!.name).toBe("My Custom Engineer");
    });

    it("should restore only missing default skills", () => {
      registry.seedDefaults();
      registry.delete("devops-engineer");

      const count = registry.seedDefaults();
      expect(count).toBe(1);

      const restored = registry.get("devops-engineer");
      expect(restored).not.toBeNull();
      expect(restored!.name).toBe("DevOps Engineer");
    });
  });
});
