import React from "react";
import { Box, Text } from "ink";

/**
 * ASCII pixel-art peacock banner with blue body and green tail feathers.
 * Rendered using Unicode block characters for a retro pixel look.
 */
export function PeacockBanner() {
  // Each line is an array of { text, color } segments
  const art: Array<Array<{ t: string; c: string }>> = [
    // Row 1 — top of tail fan
    [
      { t: "          ", c: "" },
      { t: "░░▓▓", c: "green" },
      { t: "████", c: "greenBright" },
      { t: "▓▓", c: "green" },
      { t: "████", c: "greenBright" },
      { t: "▓▓░░", c: "green" },
    ],
    // Row 2 — tail fan expanding
    [
      { t: "       ", c: "" },
      { t: "░▓", c: "green" },
      { t: "██", c: "greenBright" },
      { t: "▓▓", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "▓▓", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "▓▓", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "▓░", c: "green" },
    ],
    // Row 3 — tail fan full width
    [
      { t: "     ", c: "" },
      { t: "░▓", c: "green" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "▓░", c: "green" },
    ],
    // Row 4 — tail feather "eyes"
    [
      { t: "    ", c: "" },
      { t: "▓", c: "green" },
      { t: "██", c: "greenBright" },
      { t: " ", c: "" },
      { t: "◉", c: "blueBright" },
      { t: " ", c: "" },
      { t: "██", c: "greenBright" },
      { t: " ", c: "" },
      { t: "◉", c: "blueBright" },
      { t: " ", c: "" },
      { t: "██", c: "greenBright" },
      { t: " ", c: "" },
      { t: "◉", c: "blueBright" },
      { t: " ", c: "" },
      { t: "██", c: "greenBright" },
      { t: " ", c: "" },
      { t: "◉", c: "blueBright" },
      { t: " ", c: "" },
      { t: "██", c: "greenBright" },
      { t: "▓", c: "green" },
    ],
    // Row 5 — lower tail fan
    [
      { t: "     ", c: "" },
      { t: "░▓", c: "green" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "░░", c: "cyan" },
      { t: "██", c: "greenBright" },
      { t: "▓░", c: "green" },
    ],
    // Row 6 — tail narrowing + head
    [
      { t: "       ", c: "" },
      { t: "░▓", c: "green" },
      { t: "████", c: "greenBright" },
      { t: "████", c: "greenBright" },
      { t: "████", c: "greenBright" },
      { t: "▓░", c: "green" },
      { t: "  ", c: "" },
      { t: "▄█▄", c: "blueBright" },
    ],
    // Row 7 — tail base + head/crown
    [
      { t: "         ", c: "" },
      { t: "░▓", c: "green" },
      { t: "██████", c: "greenBright" },
      { t: "▓░", c: "green" },
      { t: "  ", c: "" },
      { t: "▀", c: "yellow" },
      { t: "█", c: "blueBright" },
      { t: "▀", c: "yellow" },
    ],
    // Row 8 — body connection
    [
      { t: "           ", c: "" },
      { t: "░▓██▓░", c: "green" },
      { t: "   ", c: "" },
      { t: "█", c: "blueBright" },
      { t: "▄", c: "yellow" },
      { t: "█", c: "blueBright" },
    ],
    // Row 9 — body
    [
      { t: "                ", c: "" },
      { t: "▄", c: "blue" },
      { t: "████", c: "blueBright" },
      { t: "█", c: "blue" },
    ],
    // Row 10 — body + beak
    [
      { t: "               ", c: "" },
      { t: "█", c: "blue" },
      { t: "████", c: "blueBright" },
      { t: "██", c: "blue" },
      { t: "▸", c: "yellow" },
    ],
    // Row 11 — lower body
    [
      { t: "               ", c: "" },
      { t: "█", c: "blue" },
      { t: "█████", c: "blueBright" },
      { t: "█", c: "blue" },
    ],
    // Row 12 — legs
    [
      { t: "               ", c: "" },
      { t: " ▀", c: "blue" },
      { t: "███", c: "blueBright" },
      { t: "▀", c: "blue" },
    ],
    // Row 13 — feet
    [
      { t: "               ", c: "" },
      { t: "  ", c: "" },
      { t: "█", c: "gray" },
      { t: " ", c: "" },
      { t: "█", c: "gray" },
    ],
    // Row 14 — feet base
    [
      { t: "               ", c: "" },
      { t: " ", c: "" },
      { t: "▀▀", c: "gray" },
      { t: " ", c: "" },
      { t: "▀▀", c: "gray" },
    ],
  ];

  return (
    <Box flexDirection="column" alignItems="center" paddingTop={1}>
      <Box flexDirection="column">
        {art.map((row, ri) => (
          <Text key={ri}>
            {row.map((seg, si) =>
              seg.c ? (
                <Text key={si} color={seg.c}>
                  {seg.t}
                </Text>
              ) : (
                <Text key={si}>{seg.t}</Text>
              )
            )}
          </Text>
        ))}
      </Box>
      <Box paddingTop={1}>
        <Text bold color="blueBright">
          {"  "}kindred-cli
        </Text>
        <Text dimColor>{" "}— AI-Powered Coding Assistant</Text>
      </Box>
    </Box>
  );
}
