<p align="center">
  <img src="kindred-cli.png" alt="kindred-cli" width="600">
</p>

# kindred-cli

A terminal-based AI coding assistant with multi-provider support, skill templates, and subagent spawning.

## Features

- **Multi-provider AI** — Anthropic (Claude), OpenAI (GPT), and Ollama (local models)
- **Configurable thinking levels** — low, medium, high, extra-high
- **Skill templates** — CRUD registry with fuzzy search and mode-based selection
- **Subagent system** — Isolated worker processes for focused thinking tasks
- **Interactive TUI** — Rich terminal UI built with Ink (React for CLI)
- **Slash commands** — `/provider`, `/model`, `/think`, `/mode`, `/skill`, `/config`, `/help`

## Install

```bash
npx @kindred-cli/cli
```

Or install globally:

```bash
npm install -g @kindred-cli/cli
```

### Requirements

- Node.js >= 18.0.0
- Python >= 3.10 (auto-installed into `~/.kindred-cli/` on first run)

## Usage

```bash
# Start with defaults (Anthropic, medium thinking)
kindred-cli --api-key sk-ant-...

# Use OpenAI
kindred-cli --provider openai --api-key sk-...

# Use local Ollama
kindred-cli --provider ollama

# Set thinking level
kindred-cli --thinking high

# Set mode
kindred-cli --mode plan
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/provider [name]` | Switch AI provider (anthropic, openai, ollama) |
| `/model [name]` | Set model (e.g., gpt-4o, claude-sonnet-4-20250514) |
| `/think [level]` | Set thinking level (low, medium, high, extra-high) |
| `/mode [mode]` | Set mode (default, plan, auto) |
| `/skill list\|search\|get` | Manage skill templates |
| `/config [key] [value]` | View or set configuration |
| `/help` | Show help |
| `/exit` | Exit |

## Architecture

```
packages/
  cli/        TypeScript — Ink TUI, slash commands, CLI entrypoint
  core/       TypeScript — Config (SQLite), skills, cache, templates, subagent spawner
  thinking/   Python — LLM providers, thinking engine, JSON-RPC bridge
```

## Development

```bash
# Install dependencies
npm install
cd packages/thinking && python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"

# Build
npm run build

# Run tests
npm test                          # TypeScript tests
cd packages/thinking && .venv/Scripts/python -m pytest tests/  # Python tests

# Dev mode
npm run dev -- --api-key sk-ant-...
```

## License

MIT
