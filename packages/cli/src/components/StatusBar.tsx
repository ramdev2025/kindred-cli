import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  status: string;
  streaming?: boolean;
}

export function StatusBar({ status, streaming = false }: StatusBarProps) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text dimColor>
        {status}
      </Text>
      <Box>
        {streaming && <Text color="yellow">streaming </Text>}
        <Text dimColor>Ctrl+C to exit | /help for commands</Text>
      </Box>
    </Box>
  );
}
