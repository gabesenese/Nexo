import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../db/client.js";
import type { HandoffAdapter, HandoffPayload, HandoffResult } from "./adapter.js";

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 1000, 4000];

export function newWebhookSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function signPayload(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/**
 * Exposed so the receiving end has a reference implementation, and so the
 * signature is verified in tests the same way a customer would verify it.
 */
export function verifySignature(secret: string, timestamp: string, body: string, signature: string) {
  const expected = signPayload(secret, timestamp, body);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface DeliveryOutcome {
  status: "succeeded" | "failed";
  statusCode: number | null;
  attempts: number;
  error: string | null;
  durationMs: number;
}

async function postOnce(url: string, secret: string, body: string) {
  const timestamp = Date.now().toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nexo-Timestamp": timestamp,
        "X-Nexo-Signature": `sha256=${signPayload(secret, timestamp, body)}`,
      },
      body,
      signal: controller.signal,
    });
    return { ok: res.ok, statusCode: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    const message = (err as Error).name === "AbortError" ? `Timed out after ${TIMEOUT_MS}ms` : (err as Error).message;
    return { ok: false, statusCode: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function deliver(params: {
  endpointId: string;
  url: string;
  secret: string;
  event: string;
  conversationId: string | null;
  data: unknown;
}): Promise<DeliveryOutcome> {
  const body = JSON.stringify({ event: params.event, data: params.data });
  const started = Date.now();

  let last = { ok: false, statusCode: null as number | null, error: "not attempted" as string | null };
  let attempts = 0;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (BACKOFF_MS[i]) await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    attempts = i + 1;
    last = await postOnce(params.url, params.secret, body);
    if (last.ok) break;
  }

  const outcome: DeliveryOutcome = {
    status: last.ok ? "succeeded" : "failed",
    statusCode: last.statusCode,
    attempts,
    error: last.ok ? null : last.error,
    durationMs: Date.now() - started,
  };

  await prisma.webhookDelivery
    .create({
      data: {
        endpointId: params.endpointId,
        conversationId: params.conversationId,
        event: params.event,
        status: outcome.status,
        statusCode: outcome.statusCode,
        attempts: outcome.attempts,
        error: outcome.error?.slice(0, 500) ?? null,
        durationMs: outcome.durationMs,
      },
    })
    .catch(() => {});

  return outcome;
}

/**
 * Delivers the handoff to whatever endpoint the workspace configured, which
 * is usually a helpdesk's inbound webhook or an automation step in front of
 * one. Helpdesk-agnostic on purpose: choosing a single vendor to integrate
 * first is a design-partner decision, and this works with all of them.
 *
 * Delivery never decides whether the escalation happened, and never delays it.
 * Retries with backoff can take half a minute against a dead endpoint, and the
 * customer sitting in the widget must not wait on someone else's server, so
 * the send is scheduled and the handoff returns immediately. WebhookDelivery
 * is the record of what actually happened.
 */
export const webhookHandoffAdapter: HandoffAdapter = {
  async createTicket(payload: HandoffPayload): Promise<HandoffResult> {
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { organizationId: payload.organizationId },
    });

    if (!endpoint || !endpoint.enabled) {
      return { externalTicketId: null, raw: { delivered: false, reason: "no endpoint configured" } };
    }

    void deliver({
      endpointId: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
      event: "escalation.created",
      conversationId: payload.conversationId,
      data: {
        conversationId: payload.conversationId,
        reason: payload.reason,
        summary: payload.summary,
        transcript: payload.transcript,
        sources: payload.sources,
      },
    }).catch(() => {});

    return { externalTicketId: null, raw: { delivered: "scheduled", endpoint: endpoint.url } };
  },
};
