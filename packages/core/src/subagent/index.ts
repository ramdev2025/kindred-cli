import { spawn, ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../logging/index.js";

const log = createLogger("subagent");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Root of the thinking Python package */
const THINKING_ROOT = path.resolve(__dirname, "..", "..", "..", "thinking");

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
  private pythonPath: string;

  constructor(pythonPath: string = "python") {
    super();
    this.pythonPath = pythonPath;
  }

  /**
   * Spawn an isolated subagent worker process.
   * Returns an object with methods to interact with the subagent.
   */
  spawn(config: SubagentConfig): Subagent {
    const child = spawn(this.pythonPath, ["-m", "src.bridge"], {
      cwd: THINKING_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    const agent = new Subagent(child, config);
    log.info(`Subagent spawned (PID: ${child.pid})`);
    return agent;
  }
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
      // Handle streaming chunks
      if (line.startsWith("chunk:")) {
        try {
          const chunk = JSON.parse(line.slice(6));
          this.events.emit("chunk", chunk);
        } catch {
          // ignore malformed chunks
        }
        return;
      }

      // Handle JSON-RPC responses
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
      // Reject all pending requests
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
    onChunk?: (text: string, done: boolean) => void
  ): Promise<string> {
    if (!this.initialized) await this.initialize();

    let chunkHandler: ((chunk: { text: string; done: boolean }) => void) | null = null;

    if (onChunk) {
      chunkHandler = (chunk: { text: string; done: boolean }) => {
        onChunk(chunk.text, chunk.done);
      };
      this.events.on("chunk", chunkHandler);
    }

    try {
      const result = (await this.send("stream", { message, history: history ?? [] })) as {
        text: string;
      };
      return result.text;
    } finally {
      // Clean up listener to prevent leaks
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
    // Give the process a moment to flush and exit cleanly
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
