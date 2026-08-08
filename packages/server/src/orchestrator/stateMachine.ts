import type { Message, Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { hybridSearch } from "../retrieval/search.js";
import { anthropicChatProvider } from "../llm/anthropic.js";
import { ollamaChatProvider } from "../llm/ollama.js";
import type { ChatProvider, ChatTurn } from "../llm/provider.js";
import { mockHandoffAdapter } from "../handoff/mockAdapter.js";
import type { HandoffAdapter } from "../handoff/adapter.js";
import { computeCombinedConfidence, shouldEscalate } from "./confidence.js";

export interface ChatTurnResult {
  conversationId: string;
  answer: string;
  confidence: number | null;
  citations: { id: string; sourceName: string; headingPath: string[] }[];
  escalated: boolean;
}

const chatProvider: ChatProvider = env.AI_PROVIDER === "cloud" ? anthropicChatProvider : ollamaChatProvider;
const handoffAdapter: HandoffAdapter = mockHandoffAdapter;

async function getOrCreateConversation(sessionId: string, organizationId: string, channel: string) {
  /**
   * A session's thread continues across `active` and `escalated` (a human
   * taking over must not fork a new conversation). Only a `resolved`
   * conversation starts a fresh thread on the next message.
   */
  const existing = await prisma.conversation.findFirst({
    where: { sessionId, organizationId, status: { in: ["active", "escalated"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return prisma.conversation.create({ data: { sessionId, organizationId, channel } });
}

/**
 * The conversation orchestrator, run as an explicit state machine rather
 * than a bare prompt loop: every path through this function ends in either
 * a normal answer (conversation stays `active`) or an escalation
 * (`escalated`). There is no third outcome where the user gets stuck.
 * `forceEscalate` is how the widget's always-visible "talk to a human"
 * button guarantees an exit regardless of model confidence.
 */
export async function handleUserMessage(params: {
  sessionId: string;
  organizationId: string;
  message: string;
  channel?: string;
  forceEscalate?: boolean;
}): Promise<ChatTurnResult> {
  const { sessionId, organizationId, message, channel = "widget", forceEscalate = false } = params;

  const conversation = await getOrCreateConversation(sessionId, organizationId, channel);

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  /**
   * Once a human has taken over (conversation escalated), the AI stops
   * auto-answering: the customer's message is recorded and surfaced to the
   * operator, who replies. This keeps the AI from talking over the human.
   */
  if (conversation.status === "escalated") {
    return { conversationId: conversation.id, answer: "", confidence: null, citations: [], escalated: true };
  }

  if (forceEscalate) {
    return escalate({
      conversationId: conversation.id,
      reason: "user_requested",
      confidence: null,
      answer: "Connecting you with a human agent now.",
      citations: [],
    });
  }

  const priorMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  /** Drop the last row: it's the message just inserted, passed separately as `message`. */
  const history: ChatTurn[] = priorMessages
    .slice(0, -1)
    .map((m: Message) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

  const retrieved = await hybridSearch(message, organizationId);
  const context = retrieved.map((r) => ({ id: r.id, sourceName: r.sourceName, content: r.content }));

  const result = await chatProvider.generateResponse({ history, message, context });

  const topRetrievalScore = retrieved[0]?.score ?? 0;
  const combinedConfidence = computeCombinedConfidence(result.confidence, topRetrievalScore);

  const citations = retrieved
    .filter((r) => result.usedSourceIds.includes(r.id))
    .map((r) => ({ id: r.id, sourceName: r.sourceName, headingPath: r.headingPath }));

  if (shouldEscalate(combinedConfidence, env.CONFIDENCE_THRESHOLD)) {
    return escalate({
      conversationId: conversation.id,
      reason: "low_confidence",
      confidence: combinedConfidence,
      answer: result.answer,
      citations,
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: result.answer,
      citations: citations,
      confidence: combinedConfidence,
    },
  });

  return {
    conversationId: conversation.id,
    answer: result.answer,
    confidence: combinedConfidence,
    citations,
    escalated: false,
  };
}

async function escalate(params: {
  conversationId: string;
  reason: string;
  confidence: number | null;
  answer: string;
  citations: { id: string; sourceName: string; headingPath: string[] }[];
}): Promise<ChatTurnResult> {
  const { conversationId, reason, confidence, answer, citations } = params;

  await prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: answer,
      citations,
      confidence: confidence ?? undefined,
    },
  });

  const allMessages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  const summary =
    reason === "user_requested"
      ? "User explicitly requested a human agent."
      : `Low-confidence AI answer (confidence ${confidence?.toFixed(2)}); escalated instead of guessing.`;

  const handoffResult = await handoffAdapter.createTicket({
    conversationId,
    reason,
    summary,
    transcript: allMessages.map((m: Message) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
    sources: citations.map((c) => ({ id: c.id, sourceName: c.sourceName })),
  });

  await prisma.$transaction([
    prisma.conversation.update({ where: { id: conversationId }, data: { status: "escalated" } }),
    prisma.escalation.create({
      data: {
        conversationId,
        reason,
        summary,
        handoffPayload: handoffResult.raw as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { conversationId, answer, confidence, citations, escalated: true };
}
