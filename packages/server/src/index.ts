import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { sourcesRoutes } from "./routes/sources.js";
import { chatRoutes } from "./routes/chat.js";
import { analyticsRoutes } from "./routes/analytics.js";

const app = Fastify({
  logger: {
    transport: { target: "pino-pretty" },
  },
});

await app.register(cors, {
  origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
});
await app.register(multipart, {
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.get("/health", async () => ({ status: "ok" }));

await app.register(sourcesRoutes);
await app.register(chatRoutes);
await app.register(analyticsRoutes);

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`Nexo server listening on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
