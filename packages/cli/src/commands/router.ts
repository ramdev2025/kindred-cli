import { ConfigManager, SkillRegistry, type AppConfig } from "@codecli/core";
import { createLogger } from "@codecli/core";

const log = createLogger("commands");

type CommandHandler = (args: string) => string;

export class SlashCommandRouter {
  private commands: Map<string, CommandHandler> = new Map();
  private configMgr: ConfigManager;
  private skillRegistry: SkillRegistry;

  constructor(configMgr: ConfigManager, skillRegistry: SkillRegistry) {
    this.configMgr = configMgr;
    this.skillRegistry = skillRegistry;
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
        default:
          return `Unknown subcommand: ${subcommand}. Options: list, search, get`;
      }
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
      "  /skill list|search|get — Manage skills",
      "  /help                  — Show this help text",
      "  /exit                  — Exit CodeCLI",
      "",
      "Shortcuts:",
      "  Ctrl+C — Exit",
      "  Tab    — Autocomplete slash commands",
    ].join("\n");
  }
}
