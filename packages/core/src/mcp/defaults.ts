/**
 * Default MCP server configurations seeded on first run.
 * All use npx for zero-install convenience.
 */

export interface DefaultMcpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  /** If false, the server is added in disabled state (e.g., needs API key) */
  enabledByDefault: boolean;
}

export const DEFAULT_MCP_SERVERS: DefaultMcpServer[] = [
  {
    id: "playwright",
    name: "Playwright Browser",
    command: "npx",
    args: ["@playwright/mcp"],
    env: {},
    enabledByDefault: true,
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo Search",
    command: "npx",
    args: ["@nicepkg/duckduckgo-mcp-server"],
    env: {},
    enabledByDefault: true,
  },
  {
    id: "firecrawl",
    name: "Firecrawl Web Scraper",
    command: "npx",
    args: ["firecrawl-mcp"],
    env: {},
    enabledByDefault: false,
  },
  {
    id: "tavily",
    name: "Tavily Search & Crawl",
    command: "npx",
    args: ["tavily-mcp"],
    env: { TAVILY_API_KEY: "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" },
    enabledByDefault: true,
  },
];
