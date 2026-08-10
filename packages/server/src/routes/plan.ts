import type { FastifyInstance } from "fastify";
import { requireAuth } from "./auth.js";
import { usageFor } from "../billing/usage.js";
import { trialStatusForOrganization } from "../billing/trial.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/api/plan", { preHandler: requireAuth }, async (req) => {
    const organizationId = req.auth!.organizationId;
    const [usage, trial] = await Promise.all([
      usageFor(organizationId),
      trialStatusForOrganization(organizationId),
    ]);
    return { ...usage, trial };
  });
}
