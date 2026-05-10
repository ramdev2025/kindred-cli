import winston from "winston";
import path from "node:path";
import fs from "node:fs";

const LOG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".codecli",
  "logs"
);

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export function createLogger(
  component: string,
  level: LogLevel = "info"
): winston.Logger {
  ensureLogDir();

  return winston.createLogger({
    level,
    defaultMeta: { component },
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, component, message, stack }) =>
        stack
          ? `${timestamp} [${level}] [${component}] ${message}\n${stack}`
          : `${timestamp} [${level}] [${component}] ${message}`
      )
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ level, component, message }) =>
              `[${level}] [${component}] ${message}`
          )
        ),
      }),
      new winston.transports.File({
        filename: path.join(LOG_DIR, "codecli.log"),
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
      }),
    ],
  });
}

/** Shared application logger — components should create their own via createLogger() */
export const logger = createLogger("codecli");
