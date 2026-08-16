import { describe, expect, it } from "vitest";
import { shouldEscalate } from "../src/orchestrator/confidence.js";

describe("shouldEscalate", () => {
  it("escalates when the model's confidence is below the threshold", () => {
    expect(shouldEscalate({ modelConfidence: 0.4, retrievedCount: 6 }, 0.55)).toBe(true);
  });

  it("answers when the model's confidence meets the threshold", () => {
    expect(shouldEscalate({ modelConfidence: 0.55, retrievedCount: 6 }, 0.55)).toBe(false);
    expect(shouldEscalate({ modelConfidence: 0.8, retrievedCount: 6 }, 0.55)).toBe(false);
  });

  it("escalates when nothing was retrieved, however sure the model sounds", () => {
    expect(shouldEscalate({ modelConfidence: 1, retrievedCount: 0 }, 0.55)).toBe(true);
  });

  /**
   * The empty-retrieval guard used to be an emergent side effect of the
   * threshold sitting above 0.5 rather than a rule, so tuning the threshold
   * down could remove it without anyone touching this file.
   */
  it("escalates on empty retrieval even at a threshold that gates nothing else", () => {
    expect(shouldEscalate({ modelConfidence: 1, retrievedCount: 0 }, 0)).toBe(true);
    expect(shouldEscalate({ modelConfidence: 1, retrievedCount: 6 }, 0)).toBe(false);
  });

  /**
   * A workspace holding one chunk returns one row, and min-max normalising a
   * single row produced a score of 0, which the old retrieval cap read as "no
   * grounding" and escalated every question in that workspace.
   */
  it("answers from a single retrieved chunk", () => {
    expect(shouldEscalate({ modelConfidence: 0.95, retrievedCount: 1 }, 0.55)).toBe(false);
  });
});
