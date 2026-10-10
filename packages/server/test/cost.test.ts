import { describe, expect, it } from "vitest";
import { aiMargin, estimateCostUsd, sumCostUsd, type CostableUsage } from "../src/billing/cost.js";

const usage = (over: Partial<CostableUsage> = {}): CostableUsage => ({
  model: "claude-sonnet-5",
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...over,
});

describe("estimateCostUsd", () => {
  it("prices input and output at their own rates", () => {
    // $2 per million in, $10 per million out: 1,000 in + 500 out = $0.002 + $0.005.
    expect(estimateCostUsd(usage({ inputTokens: 1000, outputTokens: 500 }))).toBeCloseTo(0.007, 10);
  });

  it("charges nothing for a call that used no tokens", () => {
    expect(estimateCostUsd(usage())).toBe(0);
  });

  it("is far cheaper on a smaller model, which is the point of measuring", () => {
    const heavy = estimateCostUsd(usage({ inputTokens: 4000, outputTokens: 300 }))!;
    const light = estimateCostUsd(usage({ model: "claude-haiku-5-5", inputTokens: 4000, outputTokens: 300 }))!;
    expect(light).toBeLessThan(heavy / 10);
  });

  it("prices cache reads at a tenth and cache writes at 1.25 times the input rate", () => {
    expect(estimateCostUsd(usage({ cacheReadTokens: 1_000_000 }))).toBeCloseTo(0.2, 10);
    expect(estimateCostUsd(usage({ cacheWriteTokens: 1_000_000 }))).toBeCloseTo(2.5, 10);
  });

  /** A wrong margin looks exactly like a right one, so an unknown model is never guessed. */
  it("returns null for a model it has no price for", () => {
    expect(estimateCostUsd(usage({ model: "llama3.1:8b", inputTokens: 1000 }))).toBeNull();
  });
});

describe("sumCostUsd", () => {
  it("adds priced calls and counts the unpriced ones instead of hiding them", () => {
    const total = sumCostUsd([
      usage({ inputTokens: 1_000_000 }),
      usage({ outputTokens: 1_000_000 }),
      usage({ model: "mystery-model", inputTokens: 5_000_000 }),
    ]);
    expect(total.costUsd).toBeCloseTo(12, 10);
    expect(total.unpricedCalls).toBe(1);
  });

  it("is zero with nothing recorded", () => {
    expect(sumCostUsd([])).toEqual({ costUsd: 0, unpricedCalls: 0 });
  });
});

describe("aiMargin", () => {
  it("converts to CAD and subtracts from the plan price", () => {
    const m = aiMargin(249, 10, 1.39);
    expect(m.costCad).toBeCloseTo(13.9, 10);
    expect(m.marginCad).toBeCloseTo(235.1, 10);
    expect(m.marginPercent).toBeCloseTo(94.4177, 3);
  });

  it("goes negative when serving the customer costs more than they pay", () => {
    const m = aiMargin(249, 300, 1.39);
    expect(m.marginCad).toBeLessThan(0);
    expect(m.marginPercent!).toBeLessThan(0);
  });

  it("reports no percentage for a free plan", () => {
    expect(aiMargin(0, 1, 1.39).marginPercent).toBeNull();
  });
});
