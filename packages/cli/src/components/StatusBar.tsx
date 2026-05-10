import React from "react";
import { Box, Text } from "ink";
import type { TokenUsage } from "@codecli/core";

interface StatusBarProps {
  status: string;
  thinking?: boolean;
  lastUsage?: TokenUsage | null;
  sessionUsage?: { inputTokens: number; outputTokens: number };
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

export function StatusBar({ status, thinking = false, lastUsage, sessionUsage }: StatusBarProps) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text dimColor>
          {status}
        </Text>
        {sessionUsage && (sessionUsage.inputTokens > 0 || sessionUsage.outputTokens > 0) && (
          <Text dimColor>
            tokens: {formatNum(sessionUsage.inputTokens)} in / {formatNum(sessionUsage.outputTokens)} out
          </Text>
        )}
      </Box>
      <Box gap={1}>
        {thinking && <Text color="yellow">⏳ thinking </Text>}
        <Text dimColor>Ctrl+C to exit | /help for commands</Text>
      </Box>
    </Box>
  );
}
