import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { PeacockBanner } from "./PeacockBanner.js";
import { type ConfigManager, type AppConfig } from "@codecli/core";

type Provider = "anthropic" | "openai" | "ollama";

interface SetupWizardProps {
  configMgr: ConfigManager;
  onComplete: () => void;
}

const PROVIDERS: Array<{ value: Provider; label: string; description: string }> = [
  { value: "anthropic", label: "Anthropic", description: "Claude models (claude-sonnet-4-20250514, opus, haiku)" },
  { value: "openai", label: "OpenAI", description: "GPT models (gpt-4o, gpt-4-turbo, o1)" },
  { value: "ollama", label: "Ollama", description: "Local models (llama3, mistral, codellama)" },
];

type Step = "welcome" | "provider" | "apikey" | "done";

export function SetupWizard({ configMgr, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [providerIndex, setProviderIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [keyValue, setKeyValue] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);

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
        // Save to config
        configMgr.set("provider", selectedProvider as AppConfig["provider"]);
        if (selectedProvider === "anthropic" && trimmed) {
          configMgr.set("anthropicApiKey", trimmed);
        } else if (selectedProvider === "openai" && trimmed) {
          configMgr.set("openaiApiKey", trimmed);
        } else if (selectedProvider === "ollama") {
          if (trimmed) configMgr.set("ollamaHost", trimmed);
        }
        setStep("done");
        // Allow the "done" screen to render, then transition
        setTimeout(() => onComplete(), 1500);
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

      // Regular character input
      if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
        const pos = keyValue.length - cursorOffset;
        setKeyValue(keyValue.slice(0, pos) + input + keyValue.slice(pos));
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
          <Text>Let's set up your AI provider and API key.</Text>
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
          Step 1/2 — Choose your AI provider
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
          Step 2/2 — Enter your {label}
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
      <Text dimColor>Configuration saved. Starting kindred-cli...</Text>
    </Box>
  );
}
