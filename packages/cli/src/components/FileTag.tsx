import React from "react";
import { Box, Text } from "ink";
import * as fs from "fs";
import * as path from "path";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

interface FileTagProps {
  /** The partial path typed after '@' */
  filter: string;
  /** Index of the currently highlighted item */
  selectedIndex: number;
  /** Base directory to resolve from */
  cwd: string;
}

/**
 * Reads directory entries matching the filter typed after '@'.
 * Supports partial paths — e.g. @src/comp will resolve inside src/ and filter for "comp*".
 */
export function getFileEntries(filter: string, cwd: string): FileEntry[] {
  try {
    const parsed = filter || "";
    const dir = parsed.includes("/") || parsed.includes("\\")
      ? path.resolve(cwd, path.dirname(parsed))
      : cwd;
    const prefix = parsed.includes("/") || parsed.includes("\\")
      ? path.basename(parsed)
      : parsed;

    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => {
        // Hide hidden files unless explicitly typing a dot
        if (e.name.startsWith(".") && !prefix.startsWith(".")) return false;
        return e.name.toLowerCase().startsWith(prefix.toLowerCase());
      })
      .slice(0, 10) // Limit to 10 suggestions
      .map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
      }));
  } catch {
    return [];
  }
}

/** Builds the full completion string to insert into input */
export function buildCompletionPath(filter: string, entry: FileEntry): string {
  const parsed = filter || "";
  const dirPart =
    parsed.includes("/") || parsed.includes("\\")
      ? parsed.slice(0, parsed.lastIndexOf("/") + 1 || parsed.lastIndexOf("\\") + 1)
      : "";
  return dirPart + entry.name + (entry.isDirectory ? "/" : "");
}

/**
 * Renders a dropdown of file/folder matches for @ tagging.
 */
export function FileTag({ filter, selectedIndex, cwd }: FileTagProps) {
  const entries = getFileEntries(filter, cwd);

  if (entries.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginBottom={0}
    >
      {entries.map((entry, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={entry.name} gap={1}>
            <Text
              color={isSelected ? "black" : entry.isDirectory ? "cyan" : "white"}
              backgroundColor={isSelected ? "cyan" : undefined}
              bold={isSelected}
            >
              {isSelected ? " ▸ " : "   "}
              {entry.isDirectory ? "📁 " : "📄 "}
              {entry.name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
