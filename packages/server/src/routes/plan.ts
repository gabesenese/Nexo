import type { FastifyInstance } from "fastify";
import { requireAuth } from "./auth.js";
import { usageFor } from "../billing/usage.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/api/plan", { preHandler: requireAuth }, async (req) => {
    return usageFor(req.auth!.organizationId);
  });
}
