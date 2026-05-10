import React from "react";
import { Box, Text } from "ink";

/**
 * ASCII pixel-art peacock head & neck.
 * Features a blue head/crown, yellow beak, and white around dark eyes.
 */
export function PeacockBanner() {
  const art: Array<Array<{ t: string; c: string }>> = [
    // Row 1 — crest tips
    [
      { t: "        ", c: "" },
      { t: "●", c: "blueBright" },
      { t: " ", c: "" },
      { t: "●", c: "blueBright" },
      { t: " ", c: "" },
      { t: "●", c: "blueBright" },
    ],
    // Row 2 — crown stems
    [
      { t: "         ", c: "" },
      { t: "╲│╱", c: "blue" },
    ],
    // Row 3 — top of head
    [
      { t: "       ", c: "" },
      { t: "▄██████▄", c: "blueBright" },
    ],
    // Row 4 — head with eye and beak
    [
      { t: "       ", c: "" },
      { t: "█", c: "blueBright" },
      { t: "(", c: "white" },
      { t: "●", c: "black" },
      { t: ")", c: "white" },
      { t: "████", c: "blueBright" },
      { t: "▸▸▸", c: "yellow" },
    ],
    // Row 5 — bottom of head
    [
      { t: "       ", c: "" },
      { t: "▀██████▀", c: "blueBright" },
    ],
    // Row 6 — upper neck
    [
      { t: "         ", c: "" },
      { t: "████", c: "blueBright" },
    ],
    // Row 7 — neck widens
    [
      { t: "        ", c: "" },
      { t: "▄████▄", c: "blueBright" },
    ],
  ];

  return (
    <Box flexDirection="row" paddingTop={1} paddingX={1} gap={3}>
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
      <Box flexDirection="column" justifyContent="center">
        <Text bold color="blueBright">
          kindred-cli
        </Text>
        <Text dimColor>AI-Powered Coding Assistant</Text>
      </Box>
    </Box>
  );
}