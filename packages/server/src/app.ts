import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { env } from "./config/env.js";
import { sourcesRoutes } from "./routes/sources.js";
import { chatRoutes } from "./routes/chat.js";
import { conversationsRoutes } from "./routes/conversations.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { leadsRoutes } from "./routes/leads.js";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/org.js";

export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { transport: { target: "pino-pretty" } },
  });

  /**
   * The widget is embedded on arbitrary customer domains and calls the public
   * endpoints (chat, messages, widget config) from there, so CORS reflects any
   * origin. Admin/auth endpoints stay safe because the session cookie is
   * SameSite=lax (see setSession): cross-site requests never carry it, so they
   * 401 regardless of the reflected origin.
   */
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(cookie);

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
  await app.register(orgRoutes);
  await app.register(sourcesRoutes);
  await app.register(chatRoutes);
  await app.register(conversationsRoutes);
  await app.register(notificationsRoutes);
  await app.register(analyticsRoutes);
  await app.register(leadsRoutes);

  return app;
}
