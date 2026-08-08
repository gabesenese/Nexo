import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { ingestHelpCenterUrl, ingestPdf } from "../ingestion/pipeline.js";
import { requireAuth } from "./auth.js";

export async function sourcesRoutes(app: FastifyInstance) {
  app.get("/api/sources", { preHandler: requireAuth }, async (req) => {
    const sources = await prisma.source.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
    return sources.map((s: (typeof sources)[number]) => ({
      id: s.id,
      type: s.type,
      name: s.name,
      origin: s.origin,
      lastSyncedAt: s.lastSyncedAt,
      chunkCount: s._count.chunks,
    }));
  });

  app.post<{ Body: { url: string } }>("/api/sources/help-center", { preHandler: requireAuth }, async (req, reply) => {
    const { url } = req.body ?? {};
    if (!url) {
      return reply.status(400).send({ error: "url is required" });
    }
    try {
      const result = await ingestHelpCenterUrl(url, req.auth!.organizationId);
      return result;
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: (err as Error).message });
    }
  });

  app.post("/api/sources/pdf", { preHandler: requireAuth }, async (req, reply) => {
    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ error: "a PDF file is required (multipart field 'file')" });
    }
    const buffer = await file.toBuffer();
    try {
      const result = await ingestPdf({ filename: file.filename, buffer }, req.auth!.organizationId);
      return result;
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: (err as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/sources/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { count } = await prisma.source.deleteMany({
      where: { id: req.params.id, organizationId: req.auth!.organizationId },
    });
    if (count === 0) {
      return reply.status(404).send({ error: "source not found" });
    }
    return { ok: true };
  });
}
