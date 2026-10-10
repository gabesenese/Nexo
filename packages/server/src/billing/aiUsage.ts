import { prisma } from "../db/client.js";
import type { TokenUsage } from "../llm/provider.js";

export type AiUsageKind = "answer" | "draft";

/**
 * Records what one model call consumed. This is bookkeeping, so it must never
 * be the reason a customer goes unanswered: a failure here is logged and
 * swallowed, and a provider that reports no token counts records nothing.
 */
export async function recordAiUsage(params: {
  organizationId: string;
  conversationId?: string | null;
  kind: AiUsageKind;
  usage: TokenUsage | undefined;
}): Promise<void> {
  const { organizationId, conversationId, kind, usage } = params;
  if (!usage) return;
  try {
    await prisma.aiUsage.create({
      data: {
        organizationId,
        conversationId: conversationId ?? null,
        kind,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
      },
    });
  } catch (err) {
    console.error(`Could not record AI usage: ${(err as Error).message}`);
  }
}
