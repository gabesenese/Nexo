import type { OutgoingHttpHeaders } from "node:http";
import type { FastifyReply, FastifyRequest } from "fastify";
import { subscribe } from "./bus.js";

const HEARTBEAT_MS = 25_000;
const RETRY_MS = 3_000;

/**
 * Hands the socket to us for the lifetime of the stream. Fastify's reply
 * lifecycle assumes a single buffered body, so the response is written raw.
 * The headers the CORS plugin set live on the Fastify reply and would be lost
 * by writing raw, so they are copied across first: without them the browser
 * rejects a cross-origin EventSource and the dashboard silently falls back to
 * polling.
 */
export function openEventStream(req: FastifyRequest, reply: FastifyReply, channel: string): void {
  const inherited = reply.getHeaders() as OutgoingHttpHeaders;
  reply.hijack();
  reply.raw.writeHead(200, {
    ...inherited,
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    /** Nginx and friends buffer responses by default, which would hold events back until the buffer fills. */
    "x-accel-buffering": "no",
  });

  const write = (chunk: string) => {
    if (reply.raw.writableEnded || reply.raw.destroyed) return;
    reply.raw.write(chunk);
  };

  write(`retry: ${RETRY_MS}\n\n`);

  const unsubscribe = subscribe(channel, (payload) => write(`data: ${payload}\n\n`));
  const heartbeat = setInterval(() => write(": keepalive\n\n"), HEARTBEAT_MS);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  };

  req.raw.on("close", close);
  req.raw.on("error", close);
  reply.raw.on("close", close);
  reply.raw.on("error", close);
}
