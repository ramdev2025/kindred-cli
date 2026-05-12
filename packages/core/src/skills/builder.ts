/**
 * AI-powered skill builder.
 * Takes a natural language prompt and generates a structured skill definition
 * by asking the AI to produce it.
 */

import { SubagentSpawner, type SubagentConfig } from "../subagent/index.js";
import { createLogger } from "../logging/index.js";

const log = createLogger("skill-builder");

export interface GeneratedSkill {
  id: string;
  name: string;
  description: string;
  template: string;
  tags: string[];
}

/**
 * Detect if a user's natural language prompt is asking to create a skill.
 * Returns the extracted skill description if matched, or null otherwise.
 */
const SKILL_INTENT_PATTERN = /^(?:create|build|make|generate|add|I need|new|give me)\s+(?:a\s+|me\s+a\s+)?skill\s+(?:template\s+)?(?:for|that|to|about|on)\s+(.+)/i;
const SKILL_INTENT_PATTERN2 = /^skill\s+template\s+(?:for|that|to|about|on)\s+(.+)/i;

export function detectSkillIntent(input: string): { description: string } | null {
  const trimmed = input.trim();
  const match = trimmed.match(SKILL_INTENT_PATTERN) || trimmed.match(SKILL_INTENT_PATTERN2);
  if (match && match[1]) {
    return { description: match[1].trim() };
  }
  return null;
}

const META_PROMPT = `You are a skill template generator for an AI coding assistant CLI called kindred-cli.

A "skill" is a system prompt that shapes the AI's behavior for a specific domain or task.
Given the user's description, generate a skill definition as a JSON object with these exact fields:

- "id": A short kebab-case identifier (e.g., "react-testing", "aws-lambda")
- "name": A human-readable name (2-4 words)
- "description": A one-line summary of what this skill does
- "tags": An array of 2-4 lowercase tags for categorization
- "template": A detailed system prompt (15-30 lines) that instructs the AI to act as this specialist. Include:
  - Core expertise areas
  - Guidelines and best practices
  - Response style preferences

IMPORTANT: Return ONLY valid JSON. No markdown fences, no explanation, no extra text. Just the JSON object.`;

export class SkillBuilder {
  private spawner: SubagentSpawner;
  private config: SubagentConfig;

  constructor(spawner: SubagentSpawner, config: SubagentConfig) {
    this.spawner = spawner;
    this.config = config;
  }

  async generate(prompt: string): Promise<GeneratedSkill> {
    log.info(`Generating skill from prompt: "${prompt}"`);

    const agent = this.spawner.spawn(this.config);

    try {
      const fullPrompt = `${META_PROMPT}\n\nUser's skill request: "${prompt}"\n\nGenerate the skill JSON now:`;
      const response = await agent.complete(fullPrompt);

      // Extract JSON from response — handle potential markdown fences
      let jsonStr = response.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.id || !parsed.name || !parsed.template) {
        throw new Error("Generated skill is missing required fields (id, name, template)");
      }

      const skill: GeneratedSkill = {
        id: String(parsed.id),
        name: String(parsed.name),
        description: String(parsed.description || ""),
        template: String(parsed.template),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      };

      log.info(`Skill generated: ${skill.id} — ${skill.name}`);
      return skill;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error("Failed to parse AI response as JSON. Try rephrasing your prompt.");
      }
      throw err;
    } finally {
      await agent.shutdown();
    }
  }
}
