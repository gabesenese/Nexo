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

  TRIAL_DAYS: z.coerce.number().int().positive().default(14),

  INGESTION_CONCURRENCY: z.coerce.number().int().positive().default(1),
  INGESTION_TIMEOUT_MS: z.coerce.number().int().positive().default(900_000),
  MAX_CHUNKS_PER_SOURCE: z.coerce.number().int().positive().default(1500),

  PORT: z.coerce.number().default(4000),

  /**
   * The public origin the admin console is served from. Decides whether the
   * session cookie is marked `secure`, so it is the difference between a
   * session that cannot travel over plain http and one that can.
   */
  APP_URL: z.string().url().default("http://localhost:5173"),

  /**
   * Origins allowed to make credentialed requests: the admin console and the
   * landing site. Comma separated. Widget endpoints do not use this, since they
   * answer any origin without credentials (see http/security.ts).
   */
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174"),
  WIDGET_BUNDLE_PATH: z.string().optional(),
  /**
   * Requests per minute per IP. The ceiling is generous because a single
   * operator working the inbox is legitimately chatty; the limits that protect
   * something specific are declared per route.
   */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  /**
   * Login and signup attempts per IP per minute.
   *
   * Sized for a support team behind one office NAT all signing in at 9am, not
   * for an attacker, because the limiter counts successful logins too and
   * cannot tell the two apart. Throttling by IP only ever bounds volume; the
   * control that actually stops credential stuffing is a per-account budget,
   * which belongs with the password-reset work rather than here.
   */
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(30),
  /** Model spend is real money, and /api/chat is the one public endpoint that spends it. */
  RATE_LIMIT_CHAT_MAX: z.coerce.number().int().positive().default(30),

  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  REOPEN_WINDOW_HOURS: z.coerce.number().positive().default(72),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
});

const parsed = envSchema.parse(process.env);

/**
 * A session cookie without `secure` is readable by anyone on the network path,
 * and the mistake is invisible: the product works exactly as well either way.
 * Refusing to boot is the only way it gets noticed.
 */
if (process.env.NODE_ENV === "production" && !parsed.APP_URL.startsWith("https://")) {
  throw new Error(
    `APP_URL must be https in production (got ${parsed.APP_URL}), otherwise the session cookie cannot be marked secure.`,
  );
}

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
