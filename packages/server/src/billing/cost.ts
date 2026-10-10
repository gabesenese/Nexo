import type { TokenUsage } from "../llm/provider.js";

/**
 * What a model call costs Nexo, as opposed to what a customer pays Nexo.
 *
 * Prices are USD per million tokens, copied from Anthropic's published model
 * pricing (checked 2026-10-06). They change, and a margin figure is only as
 * good as this table, so re-check it before acting on a number. A model that is
 * not listed is reported as unpriced; the cost is never guessed, because a
 * wrong margin looks exactly like a right one.
 *
 * Embeddings are deliberately not recorded or priced. A question embeds a
 * handful of tokens, and indexing a help center is a one-off cost paid at
 * onboarding, so neither moves cost per conversation. Revisit if a workspace
 * re-indexes constantly.
 *
 * Haiku 5.5 is cheaper per token for prompts up to 100K tokens and dearer
 * beyond; a support prompt is a few thousand tokens, so the lower rate is used.
 */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/**
 * Anthropic's documented multipliers on the input rate. Nexo does not use
 * prompt caching today, so these apply to counts that are zero. They exist so
 * that turning caching on cannot make the report quietly wrong.
 */
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

export type CostableUsage = Pick<
  TokenUsage,
  "model" | "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens"
>;

/** USD for one call, or null when the model has no known price. */
export function estimateCostUsd(usage: CostableUsage): number | null {
  const price = MODEL_PRICES_USD_PER_MTOK[usage.model];
  if (!price) return null;
  const perToken = (rate: number) => rate / 1_000_000;
  return (
    usage.inputTokens * perToken(price.input) +
    usage.outputTokens * perToken(price.output) +
    usage.cacheReadTokens * perToken(price.input * CACHE_READ_MULTIPLIER) +
    usage.cacheWriteTokens * perToken(price.input * CACHE_WRITE_MULTIPLIER)
  );
}

export interface CostTotal {
  costUsd: number;
  /** Calls whose model has no price. Their cost is absent from `costUsd`, so a non-zero count means it is a floor. */
  unpricedCalls: number;
}

export function sumCostUsd(rows: CostableUsage[]): CostTotal {
  let costUsd = 0;
  let unpricedCalls = 0;
  for (const row of rows) {
    const cost = estimateCostUsd(row);
    if (cost === null) unpricedCalls += 1;
    else costUsd += cost;
  }
  return { costUsd, unpricedCalls };
}

export interface MarginResult {
  costCad: number;
  marginCad: number;
  /** Null when the plan price is zero, where a percentage means nothing. */
  marginPercent: number | null;
}

/**
 * Margin on AI inference alone. It leaves out hosting, payment fees, tax and
 * the time spent supporting the customer, so the true margin is lower.
 */
export function aiMargin(priceCad: number, costUsd: number, usdToCad: number): MarginResult {
  const costCad = costUsd * usdToCad;
  return {
    costCad,
    marginCad: priceCad - costCad,
    marginPercent: priceCad > 0 ? ((priceCad - costCad) / priceCad) * 100 : null,
  };
}
