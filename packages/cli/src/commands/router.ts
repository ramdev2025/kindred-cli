import { ConfigManager, SkillRegistry, McpRegistry, type AppConfig } from "@codecli/core";
import { createLogger } from "@codecli/core";

const log = createLogger("commands");

type CommandHandler = (args: string) => string;

export class SlashCommandRouter {
  private commands: Map<string, CommandHandler> = new Map();
  private configMgr: ConfigManager;
  private skillRegistry: SkillRegistry;
  private mcpRegistry: McpRegistry;
  private onTriggerSetup?: () => void;

  constructor(configMgr: ConfigManager, skillRegistry: SkillRegistry, mcpRegistry: McpRegistry, onTriggerSetup?: () => void) {
    this.configMgr = configMgr;
    this.skillRegistry = skillRegistry;
    this.mcpRegistry = mcpRegistry;
    this.onTriggerSetup = onTriggerSetup;
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.commands.set("/help", () => this.helpText());

    this.commands.set("/config", (args) => {
      const parts = args.trim().split(/\s+/);
      if (parts.length === 0 || parts[0] === "") {
        const cfg = this.configMgr.getAll();
        return Object.entries(cfg)
          .map(([k, v]) => `  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join("\n");
      }

      if (parts.length === 1) {
        const val = this.configMgr.get(parts[0] as keyof AppConfig);
        return `${parts[0]}: ${typeof val === "object" ? JSON.stringify(val) : val}`;
      }

      // Set config: /config key value
      this.configMgr.set(parts[0] as keyof AppConfig, parts.slice(1).join(" ") as never);
      return `Config updated: ${parts[0]} = ${parts.slice(1).join(" ")}`;
    });

    this.commands.set("/provider", (args) => {
      const provider = args.trim();
      if (!provider) return `Current provider: ${this.configMgr.get("provider")}`;
      if (!["anthropic", "openai", "ollama"].includes(provider)) {
        return `Unknown provider: ${provider}. Options: anthropic, openai, ollama`;
      }
      this.configMgr.set("provider", provider as AppConfig["provider"]);
      return `Provider set to: ${provider}`;
    });

    this.commands.set("/model", (args) => {
      const modelName = args.trim();
      if (!modelName) {
        const current = this.configMgr.get("model");
        return current ? `Current model: ${current}` : "No model set (using provider default)";
      }
      this.configMgr.set("model", modelName);
      return `Model set to: ${modelName}`;
    });

    this.commands.set("/think", (args) => {
      const level = args.trim();
      if (!level) return `Current thinking level: ${this.configMgr.get("thinkingLevel")}`;
      if (!["low", "medium", "high", "extra-high"].includes(level)) {
        return `Invalid level: ${level}. Options: low, medium, high, extra-high`;
      }
      this.configMgr.set("thinkingLevel", level as AppConfig["thinkingLevel"]);
      return `Thinking level set to: ${level}`;
    });

    this.commands.set("/mode", (args) => {
      const mode = args.trim();
      if (!mode) return `Current mode: ${this.configMgr.get("mode")}`;
      if (!["default", "plan", "auto"].includes(mode)) {
        return `Invalid mode: ${mode}. Options: default, plan, auto`;
      }
      this.configMgr.set("mode", mode as AppConfig["mode"]);
      return `Mode set to: ${mode}`;
    });

    this.commands.set("/skill", (args) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0] || "list";

      switch (subcommand) {
        case "list": {
          const skills = this.skillRegistry.list();
          if (skills.length === 0) return "No skills registered. Use /skill create to add one.";
          return skills.map((s: { id: string; name: string; version: number }) => `  ${s.id} — ${s.name} (v${s.version})`).join("\n");
        }
        case "search": {
          const query = parts.slice(1).join(" ");
          if (!query) return "Usage: /skill search <query>";
          const results = this.skillRegistry.search(query);
          if (results.length === 0) return `No skills matching "${query}"`;
          return results.map((s: { id: string; name: string }) => `  ${s.id} — ${s.name}`).join("\n");
        }
        case "get": {
          if (!parts[1]) return "Usage: /skill get <id>";
          const skill = this.skillRegistry.get(parts[1]);
          if (!skill) return `Skill not found: ${parts[1]}`;
          return [
            `Name: ${skill.name}`,
            `ID: ${skill.id}`,
            `Version: ${skill.version}`,
            `Tags: ${skill.tags.join(", ")}`,
            `Shortcut: ${skill.shortcutKey || "none"}`,
            `Template:\n${skill.template}`,
          ].join("\n");
        }
        case "create": {
          // /skill create <id> <name> -- <template>
          // Optional: --tags tag1,tag2 --shortcut key
          const raw = args.trim().slice("create".length).trim();
          const dashIdx = raw.indexOf("--");
          if (dashIdx === -1) {
            return "Usage: /skill create <id> <name> -- <template>\n  Options: --tags tag1,tag2  --shortcut <key>";
          }
          const beforeDash = raw.slice(0, dashIdx).trim();
          const template = raw.slice(dashIdx + 2).trim();
          if (!template) {
            return "Template cannot be empty. Usage: /skill create <id> <name> -- <template>";
          }
          const tokens = beforeDash.split(/\s+/);
          if (tokens.length < 2) {
            return "Usage: /skill create <id> <name> -- <template>";
          }
          const id = tokens[0];
          // Parse optional flags from the end of tokens
          let tags: string[] = [];
          let shortcutKey: string | undefined;
          let nameTokens: string[] = [];
          for (let i = 1; i < tokens.length; i++) {
            if (tokens[i] === "--tags" && tokens[i + 1]) {
              tags = tokens[i + 1].split(",").map((t) => t.trim()).filter(Boolean);
              i++;
            } else if (tokens[i] === "--shortcut" && tokens[i + 1]) {
              shortcutKey = tokens[i + 1];
              i++;
            } else {
              nameTokens.push(tokens[i]);
            }
          }
          const name = nameTokens.join(" ");
          if (!name) {
            return "Usage: /skill create <id> <name> -- <template>";
          }
          // Check for duplicate
          if (this.skillRegistry.get(id)) {
            return `Skill "${id}" already exists. Use /skill update to modify it.`;
          }
          try {
            const skill = this.skillRegistry.create({
              id,
              name,
              description: "",
              template,
              tags,
              shortcutKey,
            });
            return `Skill created: ${skill.id} — ${skill.name} (v${skill.version})`;
          } catch (err) {
            return `Error creating skill: ${err}`;
          }
        }
        case "update": {
          // /skill update <id> <field> <value>
          const id = parts[1];
          const field = parts[2];
          const value = parts.slice(3).join(" ");
          if (!id || !field) {
            return "Usage: /skill update <id> <field> <value>\n  Fields: name, description, template, tags, shortcut";
          }
          const existing = this.skillRegistry.get(id);
          if (!existing) return `Skill not found: ${id}`;
          if (!value) return `Value required. Usage: /skill update ${id} ${field} <value>`;

          const updates: Record<string, unknown> = {};
          switch (field) {
            case "name":
              updates.name = value;
              break;
            case "description":
              updates.description = value;
              break;
            case "template":
              updates.template = value;
              break;
            case "tags":
              updates.tags = value.split(",").map((t) => t.trim()).filter(Boolean);
              break;
            case "shortcut":
              updates.shortcutKey = value;
              break;
            default:
              return `Unknown field: ${field}. Options: name, description, template, tags, shortcut`;
          }
          const updated = this.skillRegistry.update(id, updates);
          if (!updated) return `Failed to update skill: ${id}`;
          return `Skill updated: ${updated.id} — ${updated.name} (v${updated.version})`;
        }
        case "delete": {
          const id = parts[1];
          if (!id) return "Usage: /skill delete <id>";
          const existing = this.skillRegistry.get(id);
          if (!existing) return `Skill not found: ${id}`;
          const deleted = this.skillRegistry.delete(id);
          return deleted ? `Skill deleted: ${id}` : `Failed to delete skill: ${id}`;
        }
        case "export": {
          const id = parts[1];
          if (!id) return "Usage: /skill export <id>";
          const skill = this.skillRegistry.get(id);
          if (!skill) return `Skill not found: ${id}`;
          const { createdAt, updatedAt, ...exportable } = skill;
          return JSON.stringify(exportable, null, 2);
        }
        case "import": {
          const jsonStr = args.trim().slice("import".length).trim();
          if (!jsonStr) return "Usage: /skill import <json>";
          try {
            const data = JSON.parse(jsonStr);
            if (!data.id || !data.name || !data.template) {
              return "Invalid skill JSON. Required fields: id, name, template";
            }
            if (this.skillRegistry.get(data.id)) {
              return `Skill "${data.id}" already exists. Delete it first or use a different id.`;
            }
            const skill = this.skillRegistry.create({
              id: data.id,
              name: data.name,
              description: data.description || "",
              template: data.template,
              tags: data.tags || [],
              shortcutKey: data.shortcutKey,
            });
            return `Skill imported: ${skill.id} — ${skill.name} (v${skill.version})`;
          } catch (err) {
            return `Invalid JSON: ${err}`;
          }
        }
        default:
          return `Unknown subcommand: ${subcommand}. Options: list, search, get, create, update, delete, export, import`;
      }
    });

    this.commands.set("/mcp", (args) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0] || "list";

      switch (subcommand) {
        case "list": {
          const servers = this.mcpRegistry.list();
          if (servers.length === 0) return "No MCP servers configured. Use /mcp add to register one.";
          return servers.map((s) => {
            const status = s.enabled ? "\x1b[32m●\x1b[0m" : "\x1b[90m○\x1b[0m";
            return `  ${status} ${s.id} — ${s.name} (${s.command}${s.args.length > 0 ? " " + s.args.join(" ") : ""})`;
          }).join("\n");
        }
        case "add": {
          // /mcp add <id> <name> <command> [args...]
          const id = parts[1];
          const name = parts[2];
          const command = parts[3];
          if (!id || !name || !command) {
            return "Usage: /mcp add <id> <name> <command> [args...]";
          }
          if (this.mcpRegistry.get(id)) {
            return `MCP server "${id}" already exists. Use /mcp update to modify it.`;
          }
          const serverArgs = parts.slice(4);
          try {
            const server = this.mcpRegistry.add({
              id,
              name,
              command,
              args: serverArgs,
              env: {},
            });
            return `MCP server added: ${server.id} — ${server.name} (${server.command})`;
          } catch (err) {
            return `Error adding MCP server: ${err}`;
          }
        }
        case "remove": {
          const id = parts[1];
          if (!id) return "Usage: /mcp remove <id>";
          if (!this.mcpRegistry.get(id)) return `MCP server not found: ${id}`;
          const removed = this.mcpRegistry.remove(id);
          return removed ? `MCP server removed: ${id}` : `Failed to remove MCP server: ${id}`;
        }
        case "get": {
          const id = parts[1];
          if (!id) return "Usage: /mcp get <id>";
          const server = this.mcpRegistry.get(id);
          if (!server) return `MCP server not found: ${id}`;
          const envEntries = Object.entries(server.env);
          return [
            `ID: ${server.id}`,
            `Name: ${server.name}`,
            `Command: ${server.command}`,
            `Args: ${server.args.length > 0 ? server.args.join(" ") : "(none)"}`,
            `Enabled: ${server.enabled ? "yes" : "no"}`,
            `Env: ${envEntries.length > 0 ? envEntries.map(([k, v]) => `${k}=${v}`).join(", ") : "(none)"}`,
          ].join("\n");
        }
        case "enable": {
          const id = parts[1];
          if (!id) return "Usage: /mcp enable <id>";
          if (!this.mcpRegistry.get(id)) return `MCP server not found: ${id}`;
          this.mcpRegistry.enable(id);
          return `MCP server enabled: ${id}`;
        }
        case "disable": {
          const id = parts[1];
          if (!id) return "Usage: /mcp disable <id>";
          if (!this.mcpRegistry.get(id)) return `MCP server not found: ${id}`;
          this.mcpRegistry.disable(id);
          return `MCP server disabled: ${id}`;
        }
        case "env": {
          // /mcp env <id> <KEY=VALUE> or /mcp env <id> --remove <KEY>
          const id = parts[1];
          const kvOrFlag = parts[2];
          if (!id || !kvOrFlag) {
            return "Usage: /mcp env <id> <KEY=VALUE>\n       /mcp env <id> --remove <KEY>";
          }
          if (!this.mcpRegistry.get(id)) return `MCP server not found: ${id}`;
          if (kvOrFlag === "--remove") {
            const key = parts[3];
            if (!key) return "Usage: /mcp env <id> --remove <KEY>";
            const updated = this.mcpRegistry.removeEnv(id, key);
            return updated ? `Env var removed: ${key} from ${id}` : `Failed to update: ${id}`;
          }
          const eqIdx = kvOrFlag.indexOf("=");
          if (eqIdx === -1) {
            return "Invalid format. Use KEY=VALUE (e.g., /mcp env myserver API_KEY=abc123)";
          }
          const key = kvOrFlag.slice(0, eqIdx);
          const value = kvOrFlag.slice(eqIdx + 1);
          const updated = this.mcpRegistry.setEnv(id, key, value);
          return updated ? `Env var set: ${key} on ${id}` : `Failed to update: ${id}`;
        }
        case "update": {
          // /mcp update <id> <field> <value>
          const id = parts[1];
          const field = parts[2];
          const value = parts.slice(3).join(" ");
          if (!id || !field) {
            return "Usage: /mcp update <id> <field> <value>\n  Fields: name, command, args";
          }
          if (!this.mcpRegistry.get(id)) return `MCP server not found: ${id}`;
          if (!value) return `Value required. Usage: /mcp update ${id} ${field} <value>`;

          const updates: Record<string, unknown> = {};
          switch (field) {
            case "name":
              updates.name = value;
              break;
            case "command":
              updates.command = value;
              break;
            case "args":
              updates.args = value.split(/\s+/);
              break;
            default:
              return `Unknown field: ${field}. Options: name, command, args`;
          }
          const result = this.mcpRegistry.update(id, updates);
          if (!result) return `Failed to update MCP server: ${id}`;
          return `MCP server updated: ${result.id} — ${result.name} (${result.command})`;
        }
        default:
          return `Unknown subcommand: ${subcommand}. Options: list, add, remove, get, enable, disable, env, update`;
      }
    });

    this.commands.set("/setup", () => {
      if (this.onTriggerSetup) {
        this.onTriggerSetup();
        return "Launching setup wizard...";
      }
      return "Setup wizard not available. Reconfigure manually with /config or /provider.";
    });

    this.commands.set("/exit", () => {
      process.exit(0);
    });
  }

  handle(input: string): string {
    const firstSpace = input.indexOf(" ");
    const command = firstSpace === -1 ? input : input.slice(0, firstSpace);
    const args = firstSpace === -1 ? "" : input.slice(firstSpace + 1);

    const handler = this.commands.get(command);
    if (!handler) {
      return `Unknown command: ${command}. Type /help to see available commands.`;
    }

    log.info(`Slash command: ${command}`);
    return handler(args);
  }

  private helpText(): string {
    return [
      "Available commands:",
      "  /config [key] [value]  — View or set configuration",
      "  /provider [name]       — Switch AI provider (anthropic, openai, ollama)",
      "  /model [name]          — Set model (e.g., gpt-4o, claude-sonnet-4-20250514, llama3.2)",
      "  /think [level]         — Set thinking level (low, medium, high, extra-high)",
      "  /mode [mode]           — Set mode (default, plan, auto)",
      "  /skill                 — Manage skill templates:",
      "    list                 — List all saved skills",
      "    search <query>       — Fuzzy search skills",
      "    get <id>             — Show skill details",
      "    create <id> <name> -- <template>",
      "                         — Create a new skill (--tags t1,t2 --shortcut key)",
      "    update <id> <field> <value>",
      "                         — Update a skill field (name, description, template, tags, shortcut)",
      "    delete <id>          — Delete a skill",
      "    export <id>          — Export skill as JSON",
      "    import <json>        — Import a skill from JSON",
      "  /mcp                   — Manage MCP servers:",
      "    list                 — List all servers (● enabled, ○ disabled)",
      "    add <id> <name> <cmd> [args]",
      "                         — Register a new MCP server",
      "    remove <id>          — Remove a server",
      "    get <id>             — Show server details",
      "    enable <id>          — Enable a server",
      "    disable <id>         — Disable a server",
      "    env <id> KEY=VALUE   — Set an env var on a server",
      "    env <id> --remove KEY— Remove an env var",
      "    update <id> <field> <value>",
      "                         — Update a field (name, command, args)",
      "  /setup                 — Re-run the setup wizard (provider & API key)",
      "  /help                  — Show this help text",
      "  /exit                  — Exit kindred-cli",
      "",
      "Shortcuts:",
      "  Ctrl+C  — Exit",
      "  Tab     — Accept autocomplete suggestion",
      "  ↑ / ↓   — Navigate suggestion dropdown",
      "  Escape  — Close dropdown",
      "  @       — Tag a file or folder",
    ].join("\n");
  }
}
