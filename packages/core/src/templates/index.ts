import { SkillRegistry, SkillDefinition } from "../skills/index.js";
import { createLogger } from "../logging/index.js";

const log = createLogger("templates");

export type Mode = "plan" | "default" | "auto";
export type ThinkingLevel = "low" | "medium" | "high" | "extra-high";

export interface TemplateContext {
  mode: Mode;
  thinkingLevel: ThinkingLevel;
  userQuery?: string;
}

export class TemplateSelector {
  private registry: SkillRegistry;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
  }

  /**
   * Select skills to load for a given context.
   * In "auto" mode, we pick skills based on fuzzy matching the user query.
   * In "plan" mode, we load planning-tagged skills.
   * In "default" mode, we return the base skill set.
   */
  select(context: TemplateContext): SkillDefinition[] {
    const { mode, thinkingLevel, userQuery } = context;

    log.info(
      `Selecting templates: mode=${mode}, thinking=${thinkingLevel}`
    );

    switch (mode) {
      case "plan":
        return this.selectByTags(["plan", "planning"]);

      case "auto": {
        if (!userQuery) return this.selectByTags(["default"]);
        const matches = this.registry.search(userQuery);
        return matches.length > 0
          ? matches.slice(0, 5)
          : this.selectByTags(["default"]);
      }

      case "default":
      default:
        return this.selectByTags(["default"]);
    }
  }

  private selectByTags(tags: string[]): SkillDefinition[] {
    const allSkills = this.registry.list();
    return allSkills.filter((skill) =>
      tags.some((tag) => skill.tags.includes(tag))
    );
  }
}
