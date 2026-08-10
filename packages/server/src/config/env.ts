import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  AI_PROVIDER: z.enum(["ollama", "cloud"]).default("ollama"),

  OLLAMA_BASE_URL: z.string().default("http://localhost:11434/v1"),
  OLLAMA_CHAT_MODEL: z.string().default("llama3.1:8b"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),

  HANDOFF_ADAPTER: z.enum(["webhook", "mock"]).default("webhook"),

  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  WIDGET_BUNDLE_PATH: z.string().optional(),
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  REOPEN_WINDOW_HOURS: z.coerce.number().positive().default(72),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
});

const parsed = envSchema.parse(process.env);

if (parsed.AI_PROVIDER === "cloud") {
  if (!parsed.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required when AI_PROVIDER=cloud");
  }
  if (!parsed.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=cloud");
  }
}

export const env = parsed;

/**
 * Must match the pgvector column dimension on Chunk.embedding. Defaults to
 * 768 for the local nomic-embed-text model. Switching AI_PROVIDER to "cloud"
 * (OpenAI text-embedding-3-small = 1536) requires setting EMBEDDING_DIMENSIONS
 * to 1536 and migrating the column to match.
 */
export const EMBEDDING_DIMENSIONS = parsed.EMBEDDING_DIMENSIONS;
