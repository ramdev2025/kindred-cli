import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initDb, openDb, type Database } from "../db.js";
import { Cache } from "../cache/index.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";

function tmpDbPath(): string {
  return path.join(os.tmpdir(), `codecli-test-${randomUUID()}.db`);
}

describe("Cache", () => {
  let db: Database;
  let dbPath: string;
  let cache: Cache;

  beforeAll(async () => {
    await initDb();
  });

  beforeEach(() => {
    dbPath = tmpDbPath();
    db = openDb(dbPath);
    cache = new Cache(db, dbPath);
  });

  it("should set and get a value", () => {
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("should set and get objects", () => {
    cache.set("obj", { a: 1, b: "two" });
    expect(cache.get("obj")).toEqual({ a: 1, b: "two" });
  });

  it("should return null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should overwrite existing values", () => {
    cache.set("key", "first");
    cache.set("key", "second");
    expect(cache.get("key")).toBe("second");
  });

  it("should delete a key", () => {
    cache.set("key", "value");
    cache.delete("key");
    expect(cache.get("key")).toBeNull();
  });

  it("should expire entries based on TTL", () => {
    // Set with 1ms TTL
    cache.set("expires", "soon", 1);
    // Wait just enough for it to expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }
    expect(cache.get("expires")).toBeNull();
  });

  it("should prune expired entries", () => {
    cache.set("live", "yes", 60_000);
    cache.set("dead", "no", 1);
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }
    const pruned = cache.prune();
    expect(pruned).toBe(1);
    expect(cache.get("live")).toBe("yes");
    expect(cache.get("dead")).toBeNull();
  });

  it("should clear all entries", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });
});
