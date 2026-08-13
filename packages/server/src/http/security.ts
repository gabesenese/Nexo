import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

/**
 * Nexo serves two audiences from one origin, and they need opposite CORS rules.
 *
 * The widget is embedded on arbitrary customer domains, so its endpoints must
 * answer any origin. The admin console carries a session cookie, so its
 * endpoints must answer only origins we control. The server previously applied
 * the widget's rule to everything and relied on `SameSite=lax` to keep the
 * cookie off cross-site requests. That worked, but it made browser cookie
 * policy the only thing standing between a reflected origin and a credentialed
 * request, which is far too load-bearing for an implicit detail.
 *
 * Splitting them makes the guarantee explicit: credentials are only ever
 * offered to an allowlisted origin, and the any-origin rule is only ever paired
 * with `credentials: false`.
 */
const PUBLIC_ENDPOINTS: readonly { method: string; path: string }[] = [
  { method: "GET", path: "/health" },
  { method: "GET", path: "/widget.js" },
  { method: "GET", path: "/api/widget/config" },
  { method: "GET", path: "/api/chat/messages" },
  { method: "GET", path: "/api/chat/events" },
  { method: "POST", path: "/api/chat" },
  /** The landing site posts leads from its own origin, which is not the admin console's. */
  { method: "POST", path: "/api/leads" },
];

function pathOf(url: string): string {
  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
}

/**
 * A preflight arrives as OPTIONS and names the real method in a header, so
 * matching on `req.method` alone would classify every widget preflight as
 * private and break the widget on every customer domain.
 */
export function effectiveMethod(method: string, requestedMethod?: string): string {
  return method === "OPTIONS" ? (requestedMethod ?? "").toUpperCase() : method.toUpperCase();
}

export function isPublicEndpoint(method: string, url: string): boolean {
  const path = pathOf(url);
  return PUBLIC_ENDPOINTS.some((e) => e.method === method && e.path === path);
}

export const adminOrigins: string[] = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export interface CorsDecision {
  origin: boolean | string[];
  credentials: boolean;
}

export function corsFor(method: string, url: string, requestedMethod?: string): CorsDecision {
  return isPublicEndpoint(effectiveMethod(method, requestedMethod), url)
    ? { origin: true, credentials: false }
    : { origin: adminOrigins, credentials: true };
}

/**
 * Rate limiting is expressed as one policy here rather than as config scattered
 * across route files, so the whole budget can be read in one place and a test
 * can substitute it wholesale.
 *
 * Buckets are separate counters, not one counter with different ceilings.
 * Sharing a counter would mean an operator's ordinary dashboard traffic could
 * spend the login budget and lock them out of signing in again.
 */
export type RateBucket = "auth" | "chat" | "general";

export interface RateLimits {
  auth: number;
  chat: number;
  general: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = {
  auth: env.RATE_LIMIT_AUTH_MAX,
  chat: env.RATE_LIMIT_CHAT_MAX,
  general: env.RATE_LIMIT_MAX,
};

export function bucketFor(url: string): RateBucket {
  const path = pathOf(url);
  /** Both take an email and a password and say whether they match, so both are guessing oracles. */
  if (path === "/api/auth/login" || path === "/api/auth/signup") return "auth";
  /** The one public endpoint that spends money on every call. */
  if (path === "/api/chat") return "chat";
  return "general";
}

/**
 * Event streams are a single request held open for as long as an operator keeps
 * the page open. Counting them would exhaust the budget of anyone who simply
 * leaves the dashboard running.
 */
export function isEventStream(url: string): boolean {
  const path = pathOf(url);
  return path === "/api/events" || path === "/api/chat/events";
}

/**
 * Set by hand rather than via helmet, whose defaults fight this server: it
 * sends `Cross-Origin-Resource-Policy: same-origin`, which would stop customer
 * sites loading `/widget.js`, the one thing that must be loadable everywhere.
 * Every header below is here for a stated reason instead.
 */
export async function applySecurityHeaders(_req: FastifyRequest, reply: FastifyReply, payload: unknown) {
  /** This server returns JSON and one script. Neither should ever be sniffed into another type. */
  reply.header("x-content-type-options", "nosniff");
  /** Nothing here should leak a workspace URL to a third party via a referrer. */
  reply.header("referrer-policy", "no-referrer");
  /** An API has no reason to be framed, and framing it is how clickjacking starts. */
  reply.header("x-frame-options", "DENY");
  reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");

  /**
   * Only meaningful over TLS, and actively harmful to send from a plain-http
   * dev server, since a browser would then refuse http on localhost for a year.
   */
  if (env.APP_URL.startsWith("https://")) {
    reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  return payload;
}
