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

  /**
   * "log" prints emails instead of sending them, so a fresh clone can complete
   * a password reset with no account anywhere. Production must use "smtp";
   * env.ts refuses to boot otherwise, because a reset that silently sends
   * nothing looks exactly like one that worked.
   */
  EMAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
  /** Any provider's SMTP connection string, e.g. smtps://user:pass@smtp.host:465 */
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("Nexo <no-reply@localhost>"),
  /** How long a password reset link stays usable. Short, because it is a bearer credential. */
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),

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

  /**
   * Below this combined confidence, the answer goes to a human instead of the
   * customer. Bounded on both sides, which is why the window is narrow.
   *
   * Above 0.60 it escalates answers that are actually good: measured against
   * claude-haiku-4-5 on ten covered and ten uncovered support questions,
   * self-assessed confidence ran 0.60-0.95 when the context held the answer and
   * 0.05-0.10 when it did not. The floor of the covered band is the ceiling here.
   *
   * Nothing bounds it from below any more: a question that retrieved no context
   * escalates on its own rule in `orchestrator/confidence.ts`, rather than relying
   * on this number staying above 0.5 to do it.
   *
   * 0.55 leaves comfortable room under that ceiling. It was first chosen against
   * llama3.1:8b, whose self-assessment turns out not to separate the two bands at
   * any threshold (covered saturates at 1.0, uncovered scatters 0-1.0), so local
   * escalation behaviour on Ollama is not evidence of anything. Re-measure both
   * bands before moving this; do not nudge it.
   */
  CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  /**
   * How many prior messages travel with each question. Every turn resends the
   * history, so an uncapped thread costs tokens quadratically in its own
   * length: turn 20 pays to reread turns 1 to 19. Most support threads are
   * short, but the long ones are exactly the expensive case, a customer going
   * round after round before escalating. Retrieval reruns against the newest
   * message every turn, so older turns are only carrying conversational
   * reference ("it", "that one"), which a recent window keeps. Tunable because
   * the right window is a quality/cost tradeoff that only real traffic settles.
   * Must stay positive: `slice(-0)` returns the whole array, so a zero here
   * would silently restore the unbounded behaviour it exists to prevent.
   */
  CHAT_HISTORY_MESSAGES: z.coerce.number().int().positive().default(10),
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

/**
 * A password reset whose email never leaves the building is worse than no reset
 * at all: the customer is told to check their inbox, nothing arrives, and the
 * server reports success. Refuse to start rather than ship that.
 */
if (process.env.NODE_ENV === "production") {
  if (parsed.EMAIL_TRANSPORT !== "smtp") {
    throw new Error("EMAIL_TRANSPORT must be 'smtp' in production; 'log' silently discards every email.");
  }
  if (!parsed.SMTP_URL) {
    throw new Error("SMTP_URL is required when EMAIL_TRANSPORT=smtp");
  }
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
