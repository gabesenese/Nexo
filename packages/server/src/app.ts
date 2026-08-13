import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import {
  applySecurityHeaders,
  bucketFor,
  corsFor,
  isEventStream,
  DEFAULT_RATE_LIMITS,
  type CorsDecision,
  type RateLimits,
} from "./http/security.js";
import { recoverInterruptedSources } from "./ingestion/pipeline.js";
import { sourcesRoutes } from "./routes/sources.js";
import { chatRoutes } from "./routes/chat.js";
import { conversationsRoutes } from "./routes/conversations.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { attentionRoutes } from "./routes/attention.js";
import { leadsRoutes } from "./routes/leads.js";
import { knowledgeGapsRoutes } from "./routes/knowledgeGaps.js";
import { impactRoutes } from "./routes/impact.js";
import { planRoutes } from "./routes/plan.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { eventsRoutes } from "./routes/events.js";
import { overviewRoutes } from "./routes/overview.js";
import { authRoutes } from "./routes/auth.js";
import { passwordResetRoutes } from "./routes/passwordReset.js";
import { auditRoutes } from "./routes/audit.js";
import { privacyRoutes } from "./routes/privacy.js";
import { startRetentionSweeps } from "./privacy/retention.js";
import { orgRoutes } from "./routes/org.js";

export interface BuildAppOptions {
  logger?: boolean;
  /**
   * Overrides the per-minute budgets, or disables limiting entirely with
   * `false`. Suites that create many workspaces are exercising tenancy rather
   * than throttling, and would otherwise spend the signup budget and fail for
   * a reason unrelated to what they assert.
   */
  rateLimits?: RateLimits | false;
  /**
   * The background retention sweep. Off in tests, which drive `sweepRetention`
   * directly and would otherwise race a timer mutating the same rows.
   */
  retentionSweeps?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { transport: { target: "pino-pretty" } },
  });

  /**
   * Per-request CORS, because the widget and the admin console need opposite
   * rules from the same origin. See http/security.ts for which endpoints are
   * public and why credentials are never offered alongside a reflected origin.
   */
  await app.register(cors, () => (req: FastifyRequest, done: (err: Error | null, options: CorsDecision) => void) => {
    done(null, corsFor(req.method, req.url ?? "", req.headers["access-control-request-method"]));
  });

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(cookie);

  app.addHook("onSend", applySecurityHeaders);

  const limits = options.rateLimits ?? DEFAULT_RATE_LIMITS;
  if (limits !== false) {
    await app.register(rateLimit, {
      global: true,
      timeWindow: "1 minute",
      max: (req) => limits[bucketFor(req.url ?? "")],
      /** One counter per bucket per client, so the budgets cannot spend each other. */
      keyGenerator: (req) => `${bucketFor(req.url ?? "")}:${req.ip}`,
      allowList: (req) => isEventStream(req.url ?? ""),
    });
  }

  app.get("/health", async () => ({ status: "ok" }));

  /**
   * Serve the built widget bundle so customers embed a single-origin snippet:
   * <script src="{API}/widget.js" data-org-key="..." data-api-url="{API}">.
   * The bundle is produced by `npm run build --workspace=@nexo/widget`.
   */
  const widgetBundlePath = env.WIDGET_BUNDLE_PATH
    ? path.resolve(env.WIDGET_BUNDLE_PATH)
    : fileURLToPath(new URL("../../widget/dist/widget.js", import.meta.url));
  app.get("/widget.js", async (_req, reply) => {
    try {
      const bundle = await readFile(widgetBundlePath);
      return reply
        .header("content-type", "application/javascript; charset=utf-8")
        .header("cache-control", "public, max-age=300")
        .send(bundle);
    } catch {
      return reply
        .status(503)
        .header("content-type", "application/javascript; charset=utf-8")
        .send("// Nexo widget bundle not built. Run: npm run build --workspace=@nexo/widget");
    }
  });

  await app.register(authRoutes);
  await app.register(passwordResetRoutes);
  await app.register(orgRoutes);
  await app.register(auditRoutes);
  await app.register(privacyRoutes);
  await app.register(sourcesRoutes);
  await app.register(chatRoutes);
  await app.register(conversationsRoutes);
  await app.register(notificationsRoutes);
  await app.register(analyticsRoutes);
  await app.register(attentionRoutes);
  await app.register(leadsRoutes);
  await app.register(knowledgeGapsRoutes);
  await app.register(impactRoutes);
  await app.register(planRoutes);
  await app.register(webhookRoutes);
  await app.register(eventsRoutes);
  await app.register(overviewRoutes);

  await recoverInterruptedSources();
  if (options.retentionSweeps ?? true) startRetentionSweeps();

  return app;
}
