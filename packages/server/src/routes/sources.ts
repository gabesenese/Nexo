import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { queueHelpCenterUrl, queuePdf, reindexSource } from "../ingestion/pipeline.js";
import { requireAuth } from "./auth.js";

function serializeSource(s: {
  id: string;
  type: string;
  name: string;
  origin: string;
  status: string;
  errorMessage: string | null;
  totalChunks: number | null;
  processedChunks: number;
  lastSyncedAt: Date | null;
  createdAt: Date;
  _count: { chunks: number };
}) {
  return {
    id: s.id,
    type: s.type,
    name: s.name,
    origin: s.origin,
    status: s.status,
    errorMessage: s.errorMessage,
    totalChunks: s.totalChunks,
    processedChunks: s.processedChunks,
    lastSyncedAt: s.lastSyncedAt,
    createdAt: s.createdAt,
    chunkCount: s._count.chunks,
  };
}

export async function sourcesRoutes(app: FastifyInstance) {
  app.get("/api/sources", { preHandler: requireAuth }, async (req) => {
    const sources = await prisma.source.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
    return sources.map(serializeSource);
  });

  app.post<{ Body: { url: string } }>("/api/sources/help-center", { preHandler: requireAuth }, async (req, reply) => {
    const { url } = req.body ?? {};
    if (!url) {
      return reply.status(400).send({ error: "url is required" });
    }
    const queued = await queueHelpCenterUrl(url, req.auth!.organizationId);
    return reply.status(202).send(queued);
  });

  app.post("/api/sources/pdf", { preHandler: requireAuth }, async (req, reply) => {
    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ error: "a PDF file is required (multipart field 'file')" });
    }
    const buffer = await file.toBuffer();
    const queued = await queuePdf({ filename: file.filename, buffer }, req.auth!.organizationId);
    return reply.status(202).send(queued);
  });

  app.post<{ Params: { id: string } }>("/api/sources/:id/reindex", { preHandler: requireAuth }, async (req, reply) => {
    try {
      await reindexSource(req.params.id, req.auth!.organizationId);
      return reply.status(202).send({ ok: true });
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
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
