import "dotenv/config";
import { z } from "zod";
import { logger } from "../logger/logger";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATA_FILE_PATH: z.string().min(1).default("./train-ticket-be.json"),
  LOG_LEVEL: z.string().default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse({
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    DATA_FILE_PATH: process.env.DATA_FILE_PATH,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });

  if (!parsed.success) {
    logger.error("Invalid configuration", { issues: parsed.error.flatten() });
    process.exit(1);
  }

  return parsed.data;
}

export const config: Config = loadConfig();
