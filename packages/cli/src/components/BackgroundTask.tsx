import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { TokenUsage } from "@codecli/core";

export type TaskStatus = "thinking" | "done" | "error";

interface BackgroundTaskProps {
  status: TaskStatus;
  startTime: number;
  usage?: TokenUsage;
  errorMessage?: string;
}

/** Format milliseconds into a human-readable duration */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

/** Format a number with comma separators */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Classify raw error messages into user-friendly descriptions */
export function classifyError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("rate_limit")) {
    return "Rate limit exceeded. Wait a moment and retry.";
  }
  if (lower.includes("authentication") || lower.includes("401") || lower.includes("invalid") && lower.includes("key") || lower.includes("unauthorized")) {
    return "Invalid API key. Run /setup to reconfigure.";
  }
  if (lower.includes("context length") || lower.includes("max_tokens") || lower.includes("too many tokens") || lower.includes("token limit")) {
    return "Token limit exceeded. Try a shorter message or lower thinking level.";
  }
  if (lower.includes("insufficient_quota") || lower.includes("quota") || lower.includes("billing")) {
    return "API quota exhausted. Check your billing at your provider's dashboard.";
  }
  if (lower.includes("connection") || lower.includes("timeout") || lower.includes("econnrefused")) {
    return "Connection failed. Check your network or provider status.";
  }
  if (lower.includes("not running") || lower.includes("exited with code")) {
    return "AI engine crashed. It will restart on your next message.";
  }

  return raw;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function BackgroundTask({ status, startTime, usage, errorMessage }: BackgroundTaskProps) {
  const [elapsed, setElapsed] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (status !== "thinking") return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 100);

    return () => clearInterval(interval);
  }, [status, startTime]);

  if (status === "thinking") {
    return (
      <Box marginBottom={1} gap={1}>
        <Text color="yellow" bold>
          {SPINNER_FRAMES[frame]}
        </Text>
        <Text color="yellow">
          AI is thinking...
        </Text>
        <Text dimColor>
          ({formatDuration(elapsed)})
        </Text>
      </Box>
    );
  }

  if (status === "done" && usage) {
    return (
      <Box marginBottom={1} gap={1}>
        <Text color="green" bold>
          ✓
        </Text>
        <Text dimColor>
          {formatNumber(usage.input_tokens)} in / {formatNumber(usage.output_tokens)} out tokens
        </Text>
      </Box>
    );
  }

  if (status === "error" && errorMessage) {
    const friendly = classifyError(errorMessage);
    return (
      <Box marginBottom={1} gap={1}>
        <Text color="red" bold>
          ✗
        </Text>
        <Text color="red">
          {friendly}
        </Text>
      </Box>
    );
  }

  return null;
}
