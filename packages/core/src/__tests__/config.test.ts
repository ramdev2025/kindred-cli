import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { ConfigManager } from "../config/index.js";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

function tmpDbPath(): string {
  return path.join(os.tmpdir(), `codecli-test-${randomUUID()}.db`);
}

describe("ConfigManager", () => {
  let configMgr: ConfigManager;

  beforeAll(async () => {
    // initDb is called inside ConfigManager.create
  });

  beforeEach(async () => {
    configMgr = await ConfigManager.create(tmpDbPath());
  });

  it("should return defaults for unset keys", () => {
    expect(configMgr.get("provider")).toBe("anthropic");
    expect(configMgr.get("thinkingLevel")).toBe("medium");
    expect(configMgr.get("mode")).toBe("default");
    expect(configMgr.get("skillPaths")).toEqual([]);
  });

  it("should set and get a string value", () => {
    configMgr.set("provider", "openai");
    expect(configMgr.get("provider")).toBe("openai");
  });

  it("should set and get a model value", () => {
    configMgr.set("model", "gpt-4o");
    expect(configMgr.get("model")).toBe("gpt-4o");
  });

  it("should set and get an array value", () => {
    configMgr.set("skillPaths", ["/foo", "/bar"]);
    expect(configMgr.get("skillPaths")).toEqual(["/foo", "/bar"]);
  });

  it("should return all config merged with defaults", () => {
    configMgr.set("provider", "ollama");
    const all = configMgr.getAll();
    expect(all.provider).toBe("ollama");
    expect(all.thinkingLevel).toBe("medium"); // default
    expect(all.mode).toBe("default"); // default
  });

  it("should delete a key and fall back to default", () => {
    configMgr.set("provider", "openai");
    configMgr.delete("provider");
    expect(configMgr.get("provider")).toBe("anthropic"); // default
  });

  it("should handle optional string keys", () => {
    expect(configMgr.get("anthropicApiKey")).toBeUndefined();
    configMgr.set("anthropicApiKey", "sk-test-123");
    expect(configMgr.get("anthropicApiKey")).toBe("sk-test-123");
  });
});
