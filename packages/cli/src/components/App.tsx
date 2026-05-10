import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { InputBox } from "./InputBox.js";
import { StatusBar } from "./StatusBar.js";
import { PeacockBanner } from "./PeacockBanner.js";
import { SetupWizard } from "./SetupWizard.js";
import { BackgroundTask, type TaskStatus } from "./BackgroundTask.js";
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
  type TokenUsage,
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
  role: "user" | "assistant" | "system" | "task";
  content: string;
  /** For task messages — current background task state */
  taskState?: {
    status: TaskStatus;
    startTime: number;
    usage?: TokenUsage;
    errorMessage?: string;
  };
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

interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
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
  const [status, setStatus] = useState(`${provider} | ${thinkingLevel} | ${mode}`);
  const [services, setServices] = useState<Services | null>(null);
  const [ready, setReady] = useState(false);

  // Background task state
  const [thinking, setThinking] = useState(false);
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage>({ inputTokens: 0, outputTokens: 0 });

  // Onboarding state
  const [showSetup, setShowSetup] = useState(false);
  const [configMgr, setConfigMgr] = useState<ConfigManager | null>(null);
  const [initDone, setInitDone] = useState(false);

  // Persistent subagent — reused across messages
  const agentRef = useRef<Subagent | null>(null);
  const agentConfigRef = useRef<string>("");
  // Track the index of the current task message so we can update it
  const taskIndexRef = useRef<number>(-1);

  // Phase 1: Create ConfigManager and check if setup is needed
  useEffect(() => {
    (async () => {
      try {
        const mgr = await ConfigManager.create();
        if (apiKey) {
          mgr.set(apiKeyConfigKey(provider), apiKey as never);
        }
        setConfigMgr(mgr);
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

  const handleSetupComplete = useCallback(() => {
    setShowSetup(false);
  }, []);

  const getOrCreateAgent = useCallback(
    (cfg: Partial<AppConfig>, spawner: SubagentSpawner): Subagent => {
      const currentApiKey = getApiKeyForProvider(cfg);
      const fingerprint = `${cfg.provider}|${cfg.model ?? ""}|${currentApiKey ?? ""}`;

      if (agentRef.current?.alive && agentConfigRef.current === fingerprint) {
        return agentRef.current;
      }

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

      // Handle slash commands (always immediate, even while thinking)
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

      // Add user message + task placeholder
      const startTime = Date.now();
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          { role: "user" as const, content: trimmed },
          {
            role: "task" as const,
            content: "",
            taskState: { status: "thinking" as TaskStatus, startTime },
          },
        ];
        taskIndexRef.current = newMessages.length - 1;
        return newMessages;
      });
      setThinking(true);
      setLastUsage(null);

      try {
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }));

        const cfg = services.configMgr.getAll();

        // Skill enrichment
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

        // MCP enrichment
        const enabledMcp = services.mcpRegistry.listEnabled();
        if (enabledMcp.length > 0) {
          const mcpContext = enabledMcp
            .map((s) => `[MCP Server: ${s.name}]\nCommand: ${s.command}${s.args.length > 0 ? " " + s.args.join(" ") : ""}`)
            .join("\n\n");
          enrichedMessage = `${mcpContext}\n\n---\n\n${enrichedMessage}`;
        }

        const agent = getOrCreateAgent(cfg, services.spawner);

        if (cfg.thinkingLevel) {
          await agent.setThinkingLevel(cfg.thinkingLevel);
        }

        let fullText = "";
        let finalUsage: TokenUsage | undefined;

        await agent.stream(enrichedMessage, history, (text, done, usage) => {
          fullText += text;
          if (done && usage) {
            finalUsage = usage;
          }
        });

        // Replace task placeholder with response + done indicator
        const idx = taskIndexRef.current;
        setMessages((prev) => {
          const updated = [...prev];
          // Update the task indicator to "done"
          if (idx >= 0 && idx < updated.length && updated[idx].role === "task") {
            updated[idx] = {
              role: "task",
              content: "",
              taskState: { status: "done", startTime, usage: finalUsage },
            };
          }
          // Add the actual AI response after it
          updated.splice(idx + 1, 0, { role: "assistant", content: fullText });
          return updated;
        });

        setThinking(false);
        if (finalUsage) {
          setLastUsage(finalUsage);
          setSessionUsage((prev) => ({
            inputTokens: prev.inputTokens + finalUsage!.input_tokens,
            outputTokens: prev.outputTokens + finalUsage!.output_tokens,
          }));
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error(`Completion error: ${errMsg}`);

        // Update task placeholder to error state
        const idx = taskIndexRef.current;
        setMessages((prev) => {
          const updated = [...prev];
          if (idx >= 0 && idx < updated.length && updated[idx].role === "task") {
            updated[idx] = {
              role: "task",
              content: "",
              taskState: { status: "error", startTime, errorMessage: errMsg },
            };
          }
          return updated;
        });

        setThinking(false);

        // Clear dead agent so it respawns next time
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
        {messages.map((msg, i) => {
          if (msg.role === "task" && msg.taskState) {
            return (
              <BackgroundTask
                key={i}
                status={msg.taskState.status}
                startTime={msg.taskState.startTime}
                usage={msg.taskState.usage}
                errorMessage={msg.taskState.errorMessage}
              />
            );
          }
          return (
            <Box key={i} marginBottom={1}>
              <Text bold color={msg.role === "user" ? "green" : msg.role === "system" ? "red" : "blue"}>
                {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "AI"}:{" "}
              </Text>
              <Text wrap="wrap">{msg.content}</Text>
            </Box>
          );
        })}
      </Box>

      <InputBox onSubmit={handleSubmit} isDisabled={!ready} />
      <StatusBar status={status} thinking={thinking} lastUsage={lastUsage} sessionUsage={sessionUsage} />
    </Box>
  );
}
