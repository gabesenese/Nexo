import type { FastifyInstance } from "fastify";
import { requireAuth } from "./auth.js";
import { findKnowledgeGaps } from "../knowledge/gaps.js";

export async function knowledgeGapsRoutes(app: FastifyInstance) {
  app.get("/api/knowledge-gaps", { preHandler: requireAuth }, async (req) => {
    return findKnowledgeGaps(req.auth!.organizationId);
  });
}
