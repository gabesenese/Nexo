import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required for the chat provider"),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required for embeddings"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
});

export const env = envSchema.parse(process.env);

export const EMBEDDING_DIMENSIONS = 1536;
