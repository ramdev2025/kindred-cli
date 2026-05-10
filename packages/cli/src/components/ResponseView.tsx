import React from "react";
import { Box, Text } from "ink";

interface ResponseViewProps {
  content: string;
  isStreaming?: boolean;
}

export function ResponseView({ content, isStreaming = false }: ResponseViewProps) {
  if (!content) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="blue">
        AI:{" "}
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
        {isStreaming && <Text color="yellow">▊</Text>}
      </Box>
    </Box>
  );
}
