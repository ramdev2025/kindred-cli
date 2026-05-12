import { defineConfig, type Plugin } from "vitest/config";

function nodeSqlitePlugin(): Plugin {
  return {
    name: "node-sqlite-external",
    enforce: "pre",
    resolveId(source) {
      if (source === "node:sqlite" || source === "sqlite") {
        return "\0node:sqlite";
      }
    },
    load(id) {
      if (id === "\0node:sqlite") {
        return `
          import { createRequire } from "node:module";
          const req = createRequire(import.meta.url);
          const mod = req("node:sqlite");
          export const DatabaseSync = mod.DatabaseSync;
        `;
      }
    },
  };
}

export default defineConfig({
  plugins: [nodeSqlitePlugin()],
  test: {
    globals: true,
  },
});
