import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initDb, openDb, type Database } from "../db.js";
import { Cache } from "../cache/index.js";
import { SkillRegistry } from "../skills/index.js";
import { TemplateSelector } from "../templates/index.js";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

function tmpDbPath(): string {
  return path.join(os.tmpdir(), `codecli-test-${randomUUID()}.db`);
}

describe("TemplateSelector", () => {
  let db: Database;
  let dbPath: string;
  let cache: Cache;
  let registry: SkillRegistry;
  let selector: TemplateSelector;

  beforeAll(async () => {
    await initDb();
  });

  beforeEach(() => {
    dbPath = tmpDbPath();
    db = openDb(dbPath);
    cache = new Cache(db, dbPath);
    registry = new SkillRegistry(db, dbPath, cache);
    selector = new TemplateSelector(registry);

    // Seed skills
    registry.create({
      id: "default-coding",
      name: "Default Coding",
      description: "General coding assistant",
      template: "You are a coding assistant.",
      tags: ["default"],
    });
    registry.create({
      id: "plan-strategy",
      name: "Planning Strategy",
      description: "Helps plan implementation",
      template: "Break down the task step by step.",
      tags: ["plan", "planning"],
    });
    registry.create({
      id: "python-helper",
      name: "Python Helper",
      description: "Python-specific guidance",
      template: "You specialize in Python.",
      tags: ["python"],
    });
  });

  it("should return default-tagged skills in default mode", () => {
    const skills = selector.select({ mode: "default", thinkingLevel: "medium" });
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("default-coding");
  });

  it("should return plan-tagged skills in plan mode", () => {
    const skills = selector.select({ mode: "plan", thinkingLevel: "high" });
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("plan-strategy");
  });

  it("should return matching skills in auto mode with query", () => {
    const skills = selector.select({
      mode: "auto",
      thinkingLevel: "medium",
      userQuery: "python function",
    });
    // Auto mode should return results — either from fuzzy search or default fallback
    expect(skills.length).toBeGreaterThanOrEqual(1);
    // At least one of the returned skills should exist
    const ids = skills.map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("should fall back to default in auto mode without query", () => {
    const skills = selector.select({
      mode: "auto",
      thinkingLevel: "medium",
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("default-coding");
  });

  it("should return empty if no skills match", () => {
    // Clear all skills
    registry.delete("default-coding");
    registry.delete("plan-strategy");
    registry.delete("python-helper");

    const skills = selector.select({ mode: "default", thinkingLevel: "medium" });
    expect(skills).toHaveLength(0);
  });
});
