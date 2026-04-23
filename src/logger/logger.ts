import { createLogger, format, transports, Logger } from "winston";

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const NODE_ENV = process.env.NODE_ENV ?? "development";

const baseFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const consoleFormat =
  NODE_ENV === "production"
    ? format.combine(baseFormat, format.json())
    : format.combine(
        format.colorize(),
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }),
        format.splat(),
        format.simple()
      );

export const logger: Logger = createLogger({
  level: LOG_LEVEL,
  format: baseFormat,
  transports: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log", level: LOG_LEVEL }),
  ],
});
