import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { PeacockBanner } from "./PeacockBanner.js";
import { type ConfigManager, type McpRegistry, type AppConfig } from "@codecli/core";

type Provider = "anthropic" | "openai" | "ollama";

interface SetupWizardProps {
  configMgr: ConfigManager;
  mcpRegistry?: McpRegistry;
  onComplete: () => void;
}

const PROVIDERS: Array<{ value: Provider; label: string; description: string }> = [
  { value: "anthropic", label: "Anthropic", description: "Claude models (claude-sonnet-4-20250514, opus, haiku)" },
  { value: "openai", label: "OpenAI", description: "GPT models (gpt-4o, gpt-4-turbo, o1)" },
  { value: "ollama", label: "Ollama", description: "Local models (llama3, mistral, codellama)" },
];

type Step = "welcome" | "provider" | "apikey" | "firecrawl" | "tavily" | "done";

export function SetupWizard({ configMgr, mcpRegistry, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [providerIndex, setProviderIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [keyValue, setKeyValue] = useState("");
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);

  const finishSetup = () => {
    setStep("done");
    setTimeout(() => onComplete(), 1500);
  };

  useInput((input, key) => {
    // --- Welcome step ---
    if (step === "welcome") {
      if (key.return) {
        setStep("provider");
      }
      return;
    }

    // --- Provider selection step ---
    if (step === "provider") {
      if (key.upArrow) {
        setProviderIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (key.downArrow) {
        setProviderIndex((prev) => Math.min(prev + 1, PROVIDERS.length - 1));
        return;
      }
      if (key.return) {
        setSelectedProvider(PROVIDERS[providerIndex].value);
        if (PROVIDERS[providerIndex].value === "ollama") {
          setKeyValue("http://localhost:11434");
        }
        setStep("apikey");
        return;
      }
      return;
    }

    // --- API key / host input step ---
    if (step === "apikey") {
      if (key.return) {
        const trimmed = keyValue.trim();
        configMgr.set("provider", selectedProvider as AppConfig["provider"]);
        if (selectedProvider === "anthropic" && trimmed) {
          configMgr.set("anthropicApiKey", trimmed);
        } else if (selectedProvider === "openai" && trimmed) {
          configMgr.set("openaiApiKey", trimmed);
        } else if (selectedProvider === "ollama") {
          if (trimmed) configMgr.set("ollamaHost", trimmed);
        }
        // Move to Firecrawl step
        setKeyValue("");
        setCursorOffset(0);
        setStep("firecrawl");
        return;
      }

      if (key.backspace || key.delete) {
        const pos = keyValue.length - cursorOffset;
        if (pos > 0) {
          setKeyValue(keyValue.slice(0, pos - 1) + keyValue.slice(pos));
        }
        return;
      }

      if (key.leftArrow) {
        setCursorOffset(Math.min(cursorOffset + 1, keyValue.length));
        return;
      }

      if (key.rightArrow) {
        setCursorOffset(Math.max(cursorOffset - 1, 0));
        return;
      }

      if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
        const pos = keyValue.length - cursorOffset;
        setKeyValue(keyValue.slice(0, pos) + input + keyValue.slice(pos));
      }
      return;
    }

    // --- Firecrawl API key step ---
    if (step === "firecrawl") {
      if (key.return) {
        const trimmed = firecrawlKey.trim();
        if (trimmed && mcpRegistry) {
          const fc = mcpRegistry.get("firecrawl");
          if (fc) {
            mcpRegistry.setEnv("firecrawl", "FIRECRAWL_API_KEY", trimmed);
            mcpRegistry.enable("firecrawl");
          }
        }
        setCursorOffset(0);
        setStep("tavily");
        return;
      }

      if (key.escape) {
        setCursorOffset(0);
        setStep("tavily");
        return;
      }

      if (key.backspace || key.delete) {
        const pos = firecrawlKey.length - cursorOffset;
        if (pos > 0) {
          setFirecrawlKey(firecrawlKey.slice(0, pos - 1) + firecrawlKey.slice(pos));
        }
        return;
      }

      if (key.leftArrow) {
        setCursorOffset(Math.min(cursorOffset + 1, firecrawlKey.length));
        return;
      }

      if (key.rightArrow) {
        setCursorOffset(Math.max(cursorOffset - 1, 0));
        return;
      }

      if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
        const pos = firecrawlKey.length - cursorOffset;
        setFirecrawlKey(firecrawlKey.slice(0, pos) + input + firecrawlKey.slice(pos));
      }
      return;
    }

    // --- Tavily API key step ---
    if (step === "tavily") {
      if (key.return) {
        const trimmed = tavilyKey.trim();
        if (trimmed && mcpRegistry) {
          const tv = mcpRegistry.get("tavily");
          if (tv) {
            mcpRegistry.setEnv("tavily", "TAVILY_API_KEY", trimmed);
            mcpRegistry.enable("tavily");
          }
        }
        finishSetup();
        return;
      }

      if (key.escape) {
        finishSetup();
        return;
      }

      if (key.backspace || key.delete) {
        const pos = tavilyKey.length - cursorOffset;
        if (pos > 0) {
          setTavilyKey(tavilyKey.slice(0, pos - 1) + tavilyKey.slice(pos));
        }
        return;
      }

      if (key.leftArrow) {
        setCursorOffset(Math.min(cursorOffset + 1, tavilyKey.length));
        return;
      }

      if (key.rightArrow) {
        setCursorOffset(Math.max(cursorOffset - 1, 0));
        return;
      }

      if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
        const pos = tavilyKey.length - cursorOffset;
        setTavilyKey(tavilyKey.slice(0, pos) + input + tavilyKey.slice(pos));
      }
      return;
    }
  });

  // --- Render ---

  if (step === "welcome") {
    return (
      <Box flexDirection="column" width="100%">
        <PeacockBanner />
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text bold color="cyan">
            Welcome to kindred-cli!
          </Text>
          <Text> </Text>
          <Text>Let's set up your AI provider, API key, and integrations.</Text>
          <Text>This only takes a moment and is saved for future sessions.</Text>
          <Text> </Text>
          <Text dimColor>Press <Text bold color="green">Enter</Text> to continue...</Text>
        </Box>
      </Box>
    );
  }

  if (step === "provider") {
    return (
      <Box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          Step 1/4 — Choose your AI provider
        </Text>
        <Text> </Text>
        <Box flexDirection="column">
          {PROVIDERS.map((p, i) => {
            const isSelected = i === providerIndex;
            return (
              <Box key={p.value} gap={1}>
                <Text color={isSelected ? "green" : "white"} bold={isSelected}>
                  {isSelected ? " ▸ " : "   "}
                  {p.label}
                </Text>
                <Text dimColor>{p.description}</Text>
              </Box>
            );
          })}
        </Box>
        <Text> </Text>
        <Text dimColor>
          Use <Text bold>↑ ↓</Text> to select, <Text bold color="green">Enter</Text> to confirm
        </Text>
      </Box>
    );
  }

  if (step === "apikey") {
    const isOllama = selectedProvider === "ollama";
    const label = isOllama ? "Ollama host URL" : `${selectedProvider === "anthropic" ? "Anthropic" : "OpenAI"} API key`;
    const placeholder = isOllama ? "http://localhost:11434" : `sk-...`;
    const masked = isOllama ? keyValue : "*".repeat(keyValue.length);

    return (
      <Box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          Step 2/4 — Enter your {label}
        </Text>
        <Text> </Text>
        {!isOllama && (
          <Box marginBottom={1}>
            <Text dimColor>
              {selectedProvider === "anthropic"
                ? "Get your key at console.anthropic.com"
                : "Get your key at platform.openai.com"}
            </Text>
          </Box>
        )}
        <Box borderStyle="single" borderColor="green" paddingX={1}>
          <Text color="green" bold>{"❯ "}</Text>
          {keyValue ? (
            <>
              <Text color="white">{masked}</Text>
              <Text color="green">▊</Text>
            </>
          ) : (
            <>
              <Text dimColor>{placeholder}</Text>
              <Text color="green">▊</Text>
            </>
          )}
        </Box>
        <Text> </Text>
        <Text dimColor>
          Type your {isOllama ? "host URL" : "API key"} and press <Text bold color="green">Enter</Text>
          {isOllama && <Text> (leave default if running locally)</Text>}
        </Text>
        {!isOllama && (
          <Text dimColor>
            You can also skip and set it later via <Text bold>/config</Text> or env var
          </Text>
        )}
      </Box>
    );
  }

  if (step === "firecrawl") {
    const masked = "*".repeat(firecrawlKey.length);

    return (
      <Box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          Step 3/4 — Firecrawl Web Scraper (optional)
        </Text>
        <Text> </Text>
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>Firecrawl enables web scraping and crawling capabilities.</Text>
          <Text dimColor>Get a free API key at <Text bold>firecrawl.dev</Text></Text>
        </Box>
        <Text> </Text>
        <Text dimColor>Pre-configured integrations (no setup needed):</Text>
        <Text color="green">  ● Playwright Browser — browser automation</Text>
        <Text color="green">  ● DuckDuckGo Search — web search</Text>
        <Text> </Text>
        <Box borderStyle="single" borderColor="green" paddingX={1}>
          <Text color="green" bold>{"❯ "}</Text>
          {firecrawlKey ? (
            <>
              <Text color="white">{masked}</Text>
              <Text color="green">▊</Text>
            </>
          ) : (
            <>
              <Text dimColor>fc-...</Text>
              <Text color="green">▊</Text>
            </>
          )}
        </Box>
        <Text> </Text>
        <Text dimColor>
          Enter your Firecrawl API key and press <Text bold color="green">Enter</Text>
        </Text>
        <Text dimColor>
          Press <Text bold>Escape</Text> to skip — you can configure it later via <Text bold>/mcp env firecrawl FIRECRAWL_API_KEY=...</Text>
        </Text>
      </Box>
    );
  }

  if (step === "tavily") {
    const masked = "*".repeat(tavilyKey.length);

    return (
      <Box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          Step 4/4 — Tavily Search & Crawl (optional)
        </Text>
        <Text> </Text>
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>Tavily provides AI-optimized search, crawl, and extract capabilities.</Text>
          <Text dimColor>Get a free API key at <Text bold>tavily.com</Text></Text>
        </Box>
        <Text> </Text>
        <Box borderStyle="single" borderColor="green" paddingX={1}>
          <Text color="green" bold>{"❯ "}</Text>
          {tavilyKey ? (
            <>
              <Text color="white">{masked}</Text>
              <Text color="green">▊</Text>
            </>
          ) : (
            <>
              <Text dimColor>tvly-...</Text>
              <Text color="green">▊</Text>
            </>
          )}
        </Box>
        <Text> </Text>
        <Text dimColor>
          Enter your Tavily API key and press <Text bold color="green">Enter</Text>
        </Text>
        <Text dimColor>
          Press <Text bold>Escape</Text> to skip — you can configure it later via <Text bold>/mcp env tavily TAVILY_API_KEY=...</Text>
        </Text>
      </Box>
    );
  }

  // Done step
  return (
    <Box flexDirection="column" width="100%" paddingX={2} paddingY={1}>
      <Text bold color="green">
        Setup complete!
      </Text>
      <Text> </Text>
      <Text>
        Provider: <Text bold color="cyan">{selectedProvider}</Text>
      </Text>
      <Text>
        {selectedProvider === "ollama" ? "Host" : "API key"}: <Text bold color="cyan">
          {selectedProvider === "ollama"
            ? keyValue || "http://localhost:11434"
            : keyValue ? "****" + keyValue.slice(-4) : "(skipped)"}
        </Text>
      </Text>
      <Text> </Text>
      <Text>MCP Servers:</Text>
      <Text color="green">  ● Playwright Browser</Text>
      <Text color="green">  ● DuckDuckGo Search</Text>
      <Text color={firecrawlKey ? "green" : "gray"}>  {firecrawlKey ? "●" : "○"} Firecrawl Web Scraper {!firecrawlKey && "(skipped)"}</Text>
      <Text color="green">  ● Tavily Search & Crawl {tavilyKey ? "" : "(shared key)"}</Text>
      <Text> </Text>
      <Text dimColor>Configuration saved. Starting kindred-cli...</Text>
    </Box>
  );
}
