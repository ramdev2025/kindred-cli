import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface InputBoxProps {
  onSubmit: (input: string) => void;
  isDisabled?: boolean;
}

export function InputBox({ onSubmit, isDisabled = false }: InputBoxProps) {
  const [value, setValue] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);

  useInput((input, key) => {
    if (isDisabled) return;

    if (key.return) {
      onSubmit(value);
      setValue("");
      setCursorOffset(0);
      return;
    }

    if (key.backspace || key.delete) {
      const pos = value.length - cursorOffset;
      if (pos > 0) {
        setValue(value.slice(0, pos - 1) + value.slice(pos));
      }
      return;
    }

    if (key.leftArrow) {
      setCursorOffset(Math.min(cursorOffset + 1, value.length));
      return;
    }

    if (key.rightArrow) {
      setCursorOffset(Math.max(cursorOffset - 1, 0));
      return;
    }

    // Tab key — could trigger autocomplete
    if (key.tab) {
      // Slash command autocompletion
      if (value.startsWith("/")) {
        const commands = ["/config", "/skill", "/think", "/mode", "/model", "/provider", "/help", "/exit"];
        const matches = commands.filter((c) => c.startsWith(value));
        if (matches.length === 1) {
          setValue(matches[0] + " ");
          setCursorOffset(0);
        }
      }
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      const pos = value.length - cursorOffset;
      setValue(value.slice(0, pos) + input + value.slice(pos));
    }
  });

  return (
    <Box borderStyle="single" borderColor={isDisabled ? "gray" : "green"} paddingX={1}>
      <Text color="green" bold>
        {"❯ "}
      </Text>
      <Text color={isDisabled ? "gray" : "white"}>
        {value || (isDisabled ? "Thinking..." : "Type a message or /command...")}
      </Text>
      {!isDisabled && <Text color="green">▊</Text>}
    </Box>
  );
}
