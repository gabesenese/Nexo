import type { FastifyInstance } from "fastify";
import { requireAuth, requirePermission } from "./auth.js";
import { usageFor } from "../billing/usage.js";
import { accessForOrganization } from "../billing/entitlement.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/api/plan", { preHandler: [requireAuth, requirePermission("workspace:read")] }, async (req) => {
    const organizationId = req.auth!.organizationId;
    const [usage, access] = await Promise.all([
      usageFor(organizationId),
      accessForOrganization(organizationId),
    ]);
    /**
     * `trial` stays at the top level because the console's trial banner reads it
     * there. It is now one input to `access` rather than the whole answer, and
     * a banner that reads it alone will be wrong for a paying workspace.
     */
    return { ...usage, trial: access.trial, access };
  });
}
