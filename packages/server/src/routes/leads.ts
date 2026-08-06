import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { requireAuth } from "./auth.js";

const createLeadSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  email: z.string().trim().email("a valid work email is required").max(320),
  company: z.string().trim().min(1, "company is required").max(200),
  source: z.string().trim().max(100).optional(),
});

export async function leadsRoutes(app: FastifyInstance) {
  app.post("/api/leads", async (req, reply) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "invalid request" });
    }

    const { name, email, company, source } = parsed.data;
    const lead = await prisma.lead.create({
      data: { name, email, company, source: source ?? "landing" },
    });

    return reply.status(201).send({ id: lead.id, createdAt: lead.createdAt });
  });

  app.get("/api/leads", { preHandler: requireAuth }, async () => {
    return prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  });
}
