import React from "react";
import { Box, Text } from "ink";

export interface SlashCommand {
  name: string;
  description: string;
  subcommands?: SlashCommand[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/config", description: "View or set configuration" },
  { name: "/provider", description: "Switch AI provider" },
  { name: "/model", description: "Set model name" },
  { name: "/think", description: "Set thinking level" },
  { name: "/mode", description: "Set mode (default, plan, auto)" },
  {
    name: "/skill",
    description: "Manage skill templates",
    subcommands: [
      { name: "list", description: "List all saved skills" },
      { name: "search", description: "Fuzzy search skills" },
      { name: "get", description: "Show skill details" },
      { name: "create", description: "Create a new skill" },
      { name: "update", description: "Update a skill field" },
      { name: "delete", description: "Delete a skill" },
      { name: "export", description: "Export skill as JSON" },
      { name: "import", description: "Import skill from JSON" },
    ],
  },
  {
    name: "/mcp",
    description: "Manage MCP servers",
    subcommands: [
      { name: "list", description: "List all MCP servers" },
      { name: "add", description: "Register a new server" },
      { name: "remove", description: "Remove a server" },
      { name: "get", description: "Show server details" },
      { name: "enable", description: "Enable a server" },
      { name: "disable", description: "Disable a server" },
      { name: "env", description: "Set env var (KEY=VALUE)" },
      { name: "update", description: "Update server field" },
    ],
  },
  { name: "/setup", description: "Re-run setup wizard" },
  { name: "/help", description: "Show help text" },
  { name: "/exit", description: "Exit kindred-cli" },
];

interface CommandDropdownProps {
  /** Current input value — used to filter matching commands */
  filter: string;
  /** Index of the currently highlighted item */
  selectedIndex: number;
}

/** Determine what items to show based on current input */
function getDropdownItems(filter: string): SlashCommand[] {
  const trimmed = filter.trim();
  const spaceIdx = trimmed.indexOf(" ");

  // If input has a space, check for subcommand context
  if (spaceIdx !== -1) {
    const baseCmd = trimmed.slice(0, spaceIdx);
    const subFilter = trimmed.slice(spaceIdx + 1).trim();
    const parent = SLASH_COMMANDS.find((cmd) => cmd.name === baseCmd);
    if (parent?.subcommands) {
      if (!subFilter) return parent.subcommands;
      return parent.subcommands.filter((sub) =>
        sub.name.startsWith(subFilter)
      );
    }
    return [];
  }

  // Top-level command filtering
  return SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(trimmed));
}

/**
 * Renders a dropdown of matching slash commands above the input box.
 * Supports two levels: top-level commands and subcommands (e.g. /skill create).
 */
export function CommandDropdown({ filter, selectedIndex }: CommandDropdownProps) {
  const items = getDropdownItems(filter);

  if (items.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginBottom={0}
    >
      {items.map((cmd, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={cmd.name} gap={1}>
            <Text
              color={isSelected ? "black" : "cyan"}
              backgroundColor={isSelected ? "cyan" : undefined}
              bold={isSelected}
            >
              {isSelected ? " ▸ " : "   "}
              {cmd.name}
            </Text>
            <Text dimColor>{cmd.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

/** Returns the filtered commands/subcommands for a given input */
export function getFilteredCommands(filter: string): SlashCommand[] {
  return getDropdownItems(filter);
}
