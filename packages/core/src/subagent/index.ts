import { spawn, spawnSync, ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createLogger } from "../logging/index.js";

const log = createLogger("subagent");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** User-local directory for CodeCLI data */
const CODECLI_HOME = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".codecli"
);

/**
 * Resolve the thinking package root directory.
 * Searches in priority order:
 * 1. Monorepo layout (development) — ../../../thinking relative to dist/subagent/
 * 2. Bundled inside @codecli/core npm package — ../../python relative to dist/subagent/
 * 3. User-local install — ~/.codecli/thinking
 */
function resolveThinkingRoot(): string | null {
  const candidates = [
    // Development: monorepo layout (packages/core/dist/subagent -> packages/thinking)
    path.resolve(__dirname, "..", "..", "..", "thinking"),
    // Published: bundled Python source in @codecli/core package
    path.resolve(__dirname, "..", "..", "python"),
    // User-local: installed to ~/.codecli/thinking
    path.join(CODECLI_HOME, "thinking"),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "src", "bridge.py")) ||
      fs.existsSync(path.join(candidate, "src", "engine.py"))
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Find the bundled Python source (shipped inside the npm package).
 */
function findBundledPython(): string | null {
  const bundled = path.resolve(__dirname, "..", "..", "python");
  if (fs.existsSync(path.join(bundled, "src", "bridge.py"))) {
    return bundled;
  }
  return null;
}

/**
 * Resolve a working Python executable.
 * Tries: venv python inside thinking root, then system python3, then python.
 */
function resolvePython(thinkingRoot: string): string {
  const isWin = process.platform === "win32";

  // Check for venv inside the thinking root
  const venvPython = isWin
    ? path.join(thinkingRoot, ".venv", "Scripts", "python.exe")
    : path.join(thinkingRoot, ".venv", "bin", "python");

  if (fs.existsSync(venvPython)) return venvPython;

  // Fall back to system Python
  for (const cmd of ["python3", "python"]) {
    const result = spawnSync(cmd, ["--version"], { stdio: "pipe" });
    if (result.status === 0) return cmd;
  }

  throw new Error(
    "Python not found. CodeCLI requires Python 3.10+ for the AI thinking engine.\n" +
    "Install Python from https://www.python.org/downloads/ and ensure it's on your PATH."
  );
}

/**
 * Set up the thinking package: copy bundled source to ~/.codecli/thinking,
 * create a venv, and install dependencies.
 */
function setupThinkingPackage(): string {
  const targetDir = path.join(CODECLI_HOME, "thinking");
  const bundled = findBundledPython();

  if (!bundled) {
    throw new Error(
      "CodeCLI thinking engine not found. The Python source was not bundled correctly.\n" +
      "Try reinstalling: npm install -g @codecli/cli"
    );
  }

  log.info(`Setting up thinking engine at ${targetDir}...`);

  // Ensure target directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy bundled source to target
  copyDirSync(bundled, targetDir);

  // Find system Python
  const systemPython = resolvePython(targetDir);

  // Create venv
  log.info("Creating Python virtual environment...");
  const venvResult = spawnSync(systemPython, ["-m", "venv", path.join(targetDir, ".venv")], {
    stdio: "pipe",
    cwd: targetDir,
  });
  if (venvResult.status !== 0) {
    throw new Error(
      `Failed to create Python venv: ${venvResult.stderr?.toString()}\n` +
      "Ensure Python 3.10+ is installed with the venv module."
    );
  }

  // Resolve venv pip
  const isWin = process.platform === "win32";
  const pip = isWin
    ? path.join(targetDir, ".venv", "Scripts", "pip.exe")
    : path.join(targetDir, ".venv", "bin", "pip");

  // Install dependencies
  log.info("Installing thinking engine dependencies...");
  const pipResult = spawnSync(pip, ["install", "-e", "."], {
    stdio: "pipe",
    cwd: targetDir,
  });
  if (pipResult.status !== 0) {
    throw new Error(
      `Failed to install thinking engine dependencies: ${pipResult.stderr?.toString()}`
    );
  }

  log.info("Thinking engine setup complete.");
  return targetDir;
}

/** Recursively copy a directory */
function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === ".venv" || entry.name === "__pycache__" || entry.name === ".pytest_cache") {
      continue; // skip these directories
    }
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export interface SubagentConfig {
  thinkingLevel: string;
  provider: string;
  apiKey?: string;
  model?: string;
}

export interface SubagentMessage {
  type: "result" | "error" | "chunk";
  data: unknown;
}

export class SubagentSpawner extends EventEmitter {
  private pythonPath: string | null = null;
  private thinkingRoot: string | null = null;
  private setupDone = false;

  constructor() {
    super();
  }

  /**
   * Ensure the thinking engine is available.
   * Discovers or auto-installs on first call.
   */
  private ensureSetup(): { python: string; thinkingRoot: string } {
    if (this.setupDone && this.pythonPath && this.thinkingRoot) {
      return { python: this.pythonPath, thinkingRoot: this.thinkingRoot };
    }

    // Try to find existing thinking package
    let root = resolveThinkingRoot();

    if (!root) {
      // Auto-install from bundled source
      log.info("Thinking engine not found. Setting up...");
      root = setupThinkingPackage();
    }

    const python = resolvePython(root);

    this.pythonPath = python;
    this.thinkingRoot = root;
    this.setupDone = true;

    log.info(`Thinking engine: ${root} (python: ${python})`);
    return { python, thinkingRoot: root };
  }

  /**
   * Spawn an isolated subagent worker process.
   */
  spawn(config: SubagentConfig): Subagent {
    const { python, thinkingRoot } = this.ensureSetup();

    const child = spawn(python, ["-m", "src.bridge"], {
      cwd: thinkingRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        log.error(
          `Python not found at "${python}". ` +
          "Install Python 3.10+ and ensure it's on your PATH."
        );
      } else {
        log.error(`Failed to spawn subagent: ${err.message}`);
      }
    });

    const agent = new Subagent(child, config);
    log.info(`Subagent spawned (PID: ${child.pid})`);
    return agent;
  }
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export class Subagent {
  private child: ChildProcess;
  private config: SubagentConfig;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (val: unknown) => void; reject: (err: Error) => void }
  >();
  private readline: ReturnType<typeof createInterface> | null = null;
  private initialized = false;
  private _alive = true;

  /** Event emitter for streaming chunks */
  readonly events = new EventEmitter();

  constructor(child: ChildProcess, config: SubagentConfig) {
    this.child = child;
    this.config = config;
    this.setupIO();
  }

  get alive(): boolean {
    return this._alive;
  }

  private setupIO(): void {
    if (!this.child.stdout) return;

    this.readline = createInterface({ input: this.child.stdout });

    this.readline.on("line", (line: string) => {
      if (line.startsWith("chunk:")) {
        try {
          const chunk = JSON.parse(line.slice(6));
          this.events.emit("chunk", chunk);
        } catch {
          // ignore malformed chunks
        }
        return;
      }

      try {
        const response = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // ignore non-JSON output
      }
    });

    this.child.stderr?.on("data", (data: Buffer) => {
      log.warn(`Subagent stderr: ${data.toString().trim()}`);
    });

    this.child.on("exit", (code: number | null) => {
      this._alive = false;
      log.info(`Subagent exited (code: ${code})`);
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error(`Subagent exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });
  }

  private send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this._alive) {
        reject(new Error("Subagent is not running"));
        return;
      }
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });
      const request = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      this.child.stdin?.write(request + "\n");
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.send("initialize", {
      provider: this.config.provider,
      thinking_level: this.config.thinkingLevel,
      api_key: this.config.apiKey,
      model: this.config.model,
    });
    this.initialized = true;
  }

  async complete(message: string, history?: Array<{ role: string; content: string }>): Promise<string> {
    if (!this.initialized) await this.initialize();
    const result = (await this.send("complete", { message, history: history ?? [] })) as {
      text: string;
    };
    return result.text;
  }

  async stream(
    message: string,
    history?: Array<{ role: string; content: string }>,
    onChunk?: (text: string, done: boolean, usage?: TokenUsage) => void
  ): Promise<string> {
    if (!this.initialized) await this.initialize();

    let chunkHandler: ((chunk: { text: string; done: boolean; usage?: TokenUsage }) => void) | null = null;

    if (onChunk) {
      chunkHandler = (chunk: { text: string; done: boolean; usage?: TokenUsage }) => {
        onChunk(chunk.text, chunk.done, chunk.usage ?? undefined);
        if (chunk.done && chunk.usage) {
          this.events.emit("usage", chunk.usage);
        }
      };
      this.events.on("chunk", chunkHandler);
    }

    try {
      const result = (await this.send("stream", { message, history: history ?? [] })) as {
        text: string;
      };
      return result.text;
    } finally {
      if (chunkHandler) {
        this.events.removeListener("chunk", chunkHandler);
      }
    }
  }

  async setThinkingLevel(level: string): Promise<void> {
    await this.send("set_thinking_level", { level });
  }

  async setProvider(provider: string, apiKey?: string, model?: string): Promise<void> {
    await this.send("set_provider", { provider, api_key: apiKey, model });
  }

  async shutdown(): Promise<void> {
    if (!this._alive) return;
    try {
      await this.send("shutdown");
    } catch {
      // process may have already exited
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (this._alive) this.child.kill();
        resolve();
      }, 500);
      this.child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.readline?.close();
  }

  get pid(): number | undefined {
    return this.child.pid;
  }
}
