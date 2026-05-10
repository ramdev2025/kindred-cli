import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { InputBox } from "./InputBox.js";
import { StatusBar } from "./StatusBar.js";
import { PeacockBanner } from "./PeacockBanner.js";
import { SetupWizard } from "./SetupWizard.js";
import { SlashCommandRouter } from "../commands/router.js";
import {
  ConfigManager,
  SkillRegistry,
  McpRegistry,
  TemplateSelector,
  Cache,
  SubagentSpawner,
  Subagent,
  createLogger,
  type AppConfig,
} from "@codecli/core";

const log = createLogger("app");

export interface AppProps {
  provider: string;
  thinkingLevel: string;
  mode: string;
  apiKey?: string;
  model?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Services {
  configMgr: ConfigManager;
  cache: Cache;
  skillRegistry: SkillRegistry;
  mcpRegistry: McpRegistry;
  templateSelector: TemplateSelector;
  router: SlashCommandRouter;
  spawner: SubagentSpawner;
}

/** Route --api-key to the correct config key based on provider */
function apiKeyConfigKey(provider: string): keyof AppConfig {
  switch (provider) {
    case "openai":
      return "openaiApiKey";
    case "anthropic":
    default:
      return "anthropicApiKey";
  }
}

/** Build the API key for the current provider from config */
function getApiKeyForProvider(cfg: Partial<AppConfig>): string | undefined {
  switch (cfg.provider) {
    case "anthropic":
      return cfg.anthropicApiKey;
    case "openai":
      return cfg.openaiApiKey;
    default:
      return undefined;
  }
}

export function App({ provider, thinkingLevel, mode, apiKey, model }: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [status, setStatus] = useState(`${provider} | ${thinkingLevel} | ${mode}`);
  const [services, setServices] = useState<Services | null>(null);
  const [ready, setReady] = useState(false);

  // Onboarding state
  const [showSetup, setShowSetup] = useState(false);
  const [configMgr, setConfigMgr] = useState<ConfigManager | null>(null);
  const [initDone, setInitDone] = useState(false);

  // Persistent subagent — reused across messages
  const agentRef = useRef<Subagent | null>(null);
  // Track the config fingerprint the agent was spawned with
  const agentConfigRef = useRef<string>("");

  // Phase 1: Create ConfigManager and check if setup is needed
  useEffect(() => {
    (async () => {
      try {
        const mgr = await ConfigManager.create();

        // Apply CLI --api-key to the correct provider key
        if (apiKey) {
          mgr.set(apiKeyConfigKey(provider), apiKey as never);
        }

        setConfigMgr(mgr);

        // Show setup wizard if no API keys are configured and none was passed via CLI
        if (!apiKey && mgr.needsSetup()) {
          setShowSetup(true);
        }
        setInitDone(true);
      } catch (err) {
        log.error(`Init failed: ${err}`);
        setMessages([{ role: "system", content: `Initialization error: ${err}` }]);
        setInitDone(true);
      }
    })();
  }, []);

  // Phase 2: Initialize services (after setup is done)
  useEffect(() => {
    if (!initDone || !configMgr || showSetup) return;

    try {
      const db = configMgr.getDatabase();
      const dbPath = configMgr.getDbPath();
      const cache = new Cache(db, dbPath);
      const skillRegistry = new SkillRegistry(db, dbPath, cache);
      const mcpRegistry = new McpRegistry(db, dbPath);
      const templateSelector = new TemplateSelector(skillRegistry);
      const router = new SlashCommandRouter(configMgr, skillRegistry, mcpRegistry, () => {
        setShowSetup(true);
        setReady(false);
      });
      const spawner = new SubagentSpawner();

      // Apply CLI overrides (only non-api-key ones; api key already applied in phase 1)
      if (model) configMgr.set("model", model);
      configMgr.set("provider", provider as AppConfig["provider"]);
      configMgr.set("thinkingLevel", thinkingLevel as AppConfig["thinkingLevel"]);
      configMgr.set("mode", mode as AppConfig["mode"]);

      setServices({ configMgr, cache, skillRegistry, mcpRegistry, templateSelector, router, spawner });
      setReady(true);
      log.info("App initialized successfully");
    } catch (err) {
      log.error(`Service init failed: ${err}`);
      setMessages([{ role: "system", content: `Initialization error: ${err}` }]);
    }
  }, [initDone, showSetup, configMgr]);

  /** Called when the setup wizard completes */
  const handleSetupComplete = useCallback(() => {
    setShowSetup(false);
    // Services will be initialized by the useEffect above reacting to showSetup change
  }, []);

  /**
   * Get or create a subagent. Reuses the existing one if config hasn't changed.
   * Respawns if provider/model/apiKey changed via slash commands.
   */
  const getOrCreateAgent = useCallback(
    (cfg: Partial<AppConfig>, spawner: SubagentSpawner): Subagent => {
      const currentApiKey = getApiKeyForProvider(cfg);
      const fingerprint = `${cfg.provider}|${cfg.model ?? ""}|${currentApiKey ?? ""}`;

      // Reuse existing agent if alive and config matches
      if (agentRef.current?.alive && agentConfigRef.current === fingerprint) {
        return agentRef.current;
      }

      // Shutdown old agent if it exists
      if (agentRef.current?.alive) {
        agentRef.current.shutdown();
      }

      const agent = spawner.spawn({
        provider: cfg.provider || "anthropic",
        thinkingLevel: cfg.thinkingLevel || "medium",
        apiKey: currentApiKey,
        model: cfg.model,
      });

      agentRef.current = agent;
      agentConfigRef.current = fingerprint;
      log.info(`Subagent created (fingerprint: ${fingerprint})`);
      return agent;
    },
    []
  );

  const handleSubmit = useCallback(
    async (input: string) => {
      if (!services) return;
      const trimmed = input.trim();
      if (!trimmed) return;

      // Handle slash commands
      if (trimmed.startsWith("/")) {
        const result = services.router.handle(trimmed);
        setMessages((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          { role: "assistant", content: result },
        ]);
        const cfg = services.configMgr.getAll();
        setStatus(`${cfg.provider} | ${cfg.thinkingLevel} | ${cfg.mode}`);
        return;
      }

      // Add user message
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setStreaming(true);
      setCurrentResponse("");

      try {
        const history = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content }));

        const cfg = services.configMgr.getAll();

        // Wire TemplateSelector — prepend skill templates to the query if applicable
        const selectedSkills = services.templateSelector.select({
          mode: (cfg.mode as "plan" | "default" | "auto") || "default",
          thinkingLevel: (cfg.thinkingLevel as "low" | "medium" | "high" | "extra-high") || "medium",
          userQuery: trimmed,
        });

        let enrichedMessage = trimmed;
        if (selectedSkills.length > 0) {
          const skillContext = selectedSkills
            .map((s) => `[Skill: ${s.name}]\n${s.template}`)
            .join("\n\n");
          enrichedMessage = `${skillContext}\n\n---\n\n${trimmed}`;
        }

        // Prepend enabled MCP server context so the AI knows available tools
        const enabledMcp = services.mcpRegistry.listEnabled();
        if (enabledMcp.length > 0) {
          const mcpContext = enabledMcp
            .map((s) => `[MCP Server: ${s.name}]\nCommand: ${s.command}${s.args.length > 0 ? " " + s.args.join(" ") : ""}`)
            .join("\n\n");
          enrichedMessage = `${mcpContext}\n\n---\n\n${enrichedMessage}`;
        }

        // Get or reuse subagent
        const agent = getOrCreateAgent(cfg, services.spawner);

        // Update thinking level on the existing agent if it changed
        if (cfg.thinkingLevel) {
          await agent.setThinkingLevel(cfg.thinkingLevel);
        }

        let fullText = "";
        await agent.stream(enrichedMessage, history, (text, done) => {
          fullText += text;
          setCurrentResponse(fullText);
          if (done) {
            setStreaming(false);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: fullText },
            ]);
            setCurrentResponse("");
          }
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error(`Completion error: ${errMsg}`);
        setStreaming(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${errMsg}` },
        ]);
        setCurrentResponse("");
        // If the agent died, clear the ref so it respawns next time
        if (agentRef.current && !agentRef.current.alive) {
          agentRef.current = null;
          agentConfigRef.current = "";
        }
      }
    },
    [messages, services, getOrCreateAgent]
  );

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      agentRef.current?.shutdown();
      configMgr?.close();
      exit();
    }
  });

  // --- Render: Setup wizard ---
  if (showSetup && configMgr) {
    return <SetupWizard configMgr={configMgr} onComplete={handleSetupComplete} />;
  }

  // --- Render: Main app ---
  return (
    <Box flexDirection="column" width="100%">
      <PeacockBanner />

      {!ready && (
        <Box paddingX={1}>
          <Text color="yellow">Initializing...</Text>
        </Box>
      )}

      {/* Chat history */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {messages.map((msg, i) => (
          <Box key={i} marginBottom={1}>
            <Text bold color={msg.role === "user" ? "green" : msg.role === "system" ? "red" : "blue"}>
              {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "AI"}:{" "}
            </Text>
            <Text wrap="wrap">{msg.content}</Text>
          </Box>
        ))}

        {streaming && currentResponse && (
          <Box marginBottom={1}>
            <Text bold color="blue">
              AI:{" "}
            </Text>
            <Text wrap="wrap">{currentResponse}</Text>
            <Text color="yellow">▊</Text>
          </Box>
        )}
      </Box>

      <InputBox onSubmit={handleSubmit} isDisabled={streaming || !ready} />
      <StatusBar status={status} streaming={streaming} />
    </Box>
  );
}
