import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { env } from "./config/env.js";
import { sourcesRoutes } from "./routes/sources.js";
import { chatRoutes } from "./routes/chat.js";
import { conversationsRoutes } from "./routes/conversations.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { leadsRoutes } from "./routes/leads.js";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/org.js";

export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { transport: { target: "pino-pretty" } },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(cookie);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(orgRoutes);
  await app.register(sourcesRoutes);
  await app.register(chatRoutes);
  await app.register(conversationsRoutes);
  await app.register(analyticsRoutes);
  await app.register(leadsRoutes);

  return app;
}
