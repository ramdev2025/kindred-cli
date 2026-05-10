# CodeCLI Coding Assistant

A TypeScript/Python CLI tool installable via npx that enables users to spawn subagents, manage skill templates, and interact with multiple AI providers (Anthropic, OpenAI, Ollama) using slash commands to configure thinking levels and shortcut keys.

## Components (11)

- **CLI Entrypoint** (service) — The main entry point invoked via `npx`. Parses command‑line arguments, slash commands, and shortcut keys (e.g., Shift+Tab) to route requests to the appropriate internal services such as config, template selection, and subagent spawning.
- **Configuration Manager** (service) — Handles persistent storage of user settings (API keys, preferred provider, thinking level, skill paths) using a local SQLite database. Provides thread‑safe read/write APIs for other components and validates configuration on startup.
- **Skill Registry** (service) — Maintains a catalog of skill definitions, templates, and associated shortcut keys. Supports CRUD operations, versioning, and fuzzy search to enable users to suggest, choose, or create new skills dynamically.
- **Template Selector** (service) — Selects an appropriate skill template based on the current mode (plan, default, auto) and thinking level. Exposes a simple API that returns a list of skill IDs to load for a given context.
- **Subagent Spawner** (service) — Spawns isolated worker processes (subagents) that perform focused thinking tasks. Each subagent receives a thinking level configuration and communicates results back via an internal message channel.
- **Thinking Engine** (service) — Core LLM interaction layer. Chooses the appropriate AI provider based on user config, formats prompts according to the selected thinking level (low, medium, high, extra high), and streams responses back to the CLI or subagents.
- **Anthropic Provider** (external) — Remote API endpoint for Anthropic's Claude models. Used when the user selects Anthropic as the AI provider; handles authentication, request formatting, and error handling.
- **OpenAI Provider** (external) — Remote API endpoint for OpenAI's GPT models. Used when the user selects OpenAI as the AI provider; similar responsibilities as the Anthropic provider.
- **Ollama Provider** (external) — Local Ollama server exposing a REST‑compatible API for running open‑source LLMs on the user's machine. Enables offline or private model usage.
- **Skill Cache** (cache) — In‑memory Redis cache storing frequently accessed skill metadata and recent LLM responses to reduce latency and database load. Configured with TTL policies to keep data fresh.
- **Logging Service** (service) — Centralized logging subsystem that aggregates logs from all components, rotates log files, and provides configurable log levels (debug, info, warn, error). Outputs to both console and file.

## Connections (15)

- CLI Entrypoint → Configuration Manager — read/write user config
- CLI Entrypoint → Skill Registry — fetch skill definitions
- CLI Entrypoint → Template Selector — select template based on mode
- CLI Entrypoint → Subagent Spawner — spawn subagent for task
- CLI Entrypoint → Thinking Engine — request LLM completion
- Thinking Engine → Anthropic Provider — call Anthropic API
- Thinking Engine → OpenAI Provider — call OpenAI API
- Thinking Engine → Ollama Provider — call Ollama API
- Subagent Spawner → Thinking Engine — subagent thinking task
- Skill Registry → Skill Cache — cache skill metadata
- Template Selector → Skill Registry — get template skill set
- Configuration Manager → Skill Cache — store user preferences
- CLI Entrypoint → Logging Service — log CLI events
- Thinking Engine → Logging Service — log LLM requests/responses
- Subagent Spawner → Logging Service — log subagent lifecycle

---
