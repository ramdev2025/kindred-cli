import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { CommandDropdown, getFilteredCommands } from "./CommandDropdown.js";
import { FileTag, getFileEntries, buildCompletionPath } from "./FileTag.js";

interface InputBoxProps {
  onSubmit: (input: string) => void;
  isDisabled?: boolean;
  cwd?: string;
}

type DropdownMode = "none" | "command" | "file";

export function InputBox({ onSubmit, isDisabled = false, cwd = process.cwd() }: InputBoxProps) {
  const [value, setValue] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>("none");

  /** Extract the @ token being typed at cursor position */
  function getAtToken(): string | null {
    const pos = value.length - cursorOffset;
    const before = value.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return null;
    // Make sure the @ isn't preceded by a non-space (it's a word start)
    if (atIdx > 0 && before[atIdx - 1] !== " ") return null;
    return before.slice(atIdx + 1);
  }

  /** Determine active dropdown mode from current input */
  function resolveDropdownMode(input: string): DropdownMode {
    if (input.startsWith("/")) {
      const matches = getFilteredCommands(input);
      if (matches.length > 0) return "command";
    }
    // Check for @ token
    const pos = input.length - cursorOffset;
    const before = input.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && (atIdx === 0 || before[atIdx - 1] === " ")) {
      const filter = before.slice(atIdx + 1);
      const entries = getFileEntries(filter, cwd);
      if (entries.length > 0) return "file";
    }
    return "none";
  }

  function updateValue(newValue: string) {
    setValue(newValue);
    const mode = resolveDropdownMode(newValue);
    setDropdownMode(mode);
    if (mode === "none") setDropdownIndex(0);
  }

  /** Build the completed string when accepting a command dropdown item */
  function acceptCommandItem(currentValue: string, itemName: string): string {
    const trimmed = currentValue.trim();
    const spaceIdx = trimmed.indexOf(" ");
    // If we're in subcommand context (e.g. "/skill " -> picking "create")
    if (spaceIdx !== -1) {
      const baseCmd = trimmed.slice(0, spaceIdx);
      return baseCmd + " " + itemName + " ";
    }
    // Top-level command
    return itemName + " ";
  }

  useInput((input, key) => {
    if (isDisabled) return;

    // Submit
    if (key.return) {
      // If dropdown is open, accept the selection instead
      if (dropdownMode === "command") {
        const matches = getFilteredCommands(value);
        if (matches.length > 0 && matches[dropdownIndex]) {
          const completed = acceptCommandItem(value, matches[dropdownIndex].name);
          updateValue(completed);
          setCursorOffset(0);
          return;
        }
      }
      if (dropdownMode === "file") {
        const token = getAtToken();
        if (token !== null) {
          const entries = getFileEntries(token, cwd);
          if (entries.length > 0 && entries[dropdownIndex]) {
            const completion = buildCompletionPath(token, entries[dropdownIndex]);
            const pos = value.length - cursorOffset;
            const before = value.slice(0, pos);
            const atIdx = before.lastIndexOf("@");
            const newValue = value.slice(0, atIdx + 1) + completion + value.slice(pos);
            setValue(newValue);
            setCursorOffset(0);
            setDropdownMode("none");
            setDropdownIndex(0);
            return;
          }
        }
      }
      // Normal submit
      onSubmit(value);
      setValue("");
      setCursorOffset(0);
      setDropdownMode("none");
      setDropdownIndex(0);
      return;
    }

    // Escape closes dropdown
    if (key.escape) {
      if (dropdownMode !== "none") {
        setDropdownMode("none");
        setDropdownIndex(0);
        return;
      }
    }

    if (key.backspace || key.delete) {
      const pos = value.length - cursorOffset;
      if (pos > 0) {
        const newVal = value.slice(0, pos - 1) + value.slice(pos);
        updateValue(newVal);
      }
      return;
    }

    // Up/down arrows navigate dropdown
    if (key.upArrow && dropdownMode !== "none") {
      setDropdownIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.downArrow && dropdownMode !== "none") {
      if (dropdownMode === "command") {
        const max = getFilteredCommands(value).length - 1;
        setDropdownIndex((prev) => Math.min(prev + 1, max));
      } else if (dropdownMode === "file") {
        const token = getAtToken();
        const max = token !== null ? getFileEntries(token, cwd).length - 1 : 0;
        setDropdownIndex((prev) => Math.min(prev + 1, max));
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

    // Tab accepts current dropdown selection
    if (key.tab) {
      if (dropdownMode === "command") {
        const matches = getFilteredCommands(value);
        if (matches.length > 0 && matches[dropdownIndex]) {
          const completed = acceptCommandItem(value, matches[dropdownIndex].name);
          updateValue(completed);
          setCursorOffset(0);
        }
        return;
      }
      if (dropdownMode === "file") {
        const token = getAtToken();
        if (token !== null) {
          const entries = getFileEntries(token, cwd);
          if (entries.length > 0 && entries[dropdownIndex]) {
            const completion = buildCompletionPath(token, entries[dropdownIndex]);
            const pos = value.length - cursorOffset;
            const before = value.slice(0, pos);
            const atIdx = before.lastIndexOf("@");
            const newValue = value.slice(0, atIdx + 1) + completion + value.slice(pos);
            setValue(newValue);
            setCursorOffset(0);
            setDropdownMode("none");
            setDropdownIndex(0);
          }
        }
        return;
      }
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      const pos = value.length - cursorOffset;
      const newVal = value.slice(0, pos) + input + value.slice(pos);
      updateValue(newVal);
    }
  });

  // Render the displayed text with cursor
  const cursorPos = value.length - cursorOffset;
  const beforeCursor = value.slice(0, cursorPos);
  const afterCursor = value.slice(cursorPos);

  return (
    <Box flexDirection="column">
      {/* Slash command dropdown */}
      {dropdownMode === "command" && (
        <CommandDropdown filter={value} selectedIndex={dropdownIndex} />
      )}

      {/* File tag dropdown */}
      {dropdownMode === "file" && (() => {
        const token = getAtToken();
        return token !== null ? (
          <FileTag filter={token} selectedIndex={dropdownIndex} cwd={cwd} />
        ) : null;
      })()}

      {/* Input box */}
      <Box borderStyle="single" borderColor={isDisabled ? "gray" : "green"} paddingX={1}>
        <Text color="green" bold>
          {"❯ "}
        </Text>
        {value ? (
          <>
            <Text color="white">{beforeCursor}</Text>
            {!isDisabled && <Text color="green" inverse>{afterCursor[0] || " "}</Text>}
            <Text color="white">{afterCursor.slice(1)}</Text>
          </>
        ) : (
          <>
            <Text color={isDisabled ? "gray" : undefined} dimColor={!isDisabled}>
              {isDisabled ? "Thinking..." : "Type a message, /command, or @file..."}
            </Text>
            {!isDisabled && <Text color="green">▊</Text>}
          </>
        )}
      </Box>
    </Box>
  );
}
