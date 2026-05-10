#!/usr/bin/env node
import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";

const program = new Command()
  .name("kindred-cli")
  .description("kindred-cli — AI-powered coding assistant")
  .version("0.1.0")
  .option("-p, --provider <name>", "AI provider (anthropic, openai, ollama)", "anthropic")
  .option("-t, --thinking <level>", "Thinking level (low, medium, high, extra-high)", "medium")
  .option("-m, --mode <mode>", "Mode (default, plan, auto)", "default")
  .option("--api-key <key>", "API key for the selected provider")
  .option("--model <model>", "Model name override")
  .action((opts) => {
    render(
      React.createElement(App, {
        provider: opts.provider,
        thinkingLevel: opts.thinking,
        mode: opts.mode,
        apiKey: opts.apiKey,
        model: opts.model,
      })
    );
  });

program.parse();
