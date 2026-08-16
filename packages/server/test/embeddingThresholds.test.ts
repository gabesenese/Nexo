import { describe, expect, it } from "vitest";
import { embeddingThresholds } from "../src/knowledge/gaps.js";

const providers = ["ollama", "cloud"] as const;

describe("embeddingThresholds", () => {
  it("carries a pair for every provider", () => {
    for (const provider of providers) {
      expect(embeddingThresholds[provider]).toBeDefined();
      for (const value of Object.values(embeddingThresholds[provider])) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  /**
   * The failure this guards against is someone adding a provider by copying the
   * pair above it. Cosine similarities are only comparable inside one embedding
   * space, so an identical pair across two models is a measurement that never
   * happened. Nothing throws when it is wrong; the gaps page just starts
   * reporting the wrong thing.
   */
  it("does not reuse one provider's numbers for another", () => {
    for (let i = 0; i < providers.length; i++) {
      for (let j = i + 1; j < providers.length; j++) {
        expect(embeddingThresholds[providers[i]]).not.toEqual(embeddingThresholds[providers[j]]);
      }
    }
  });

  it("keeps the measured pairs the gaps page was calibrated against", () => {
    expect(embeddingThresholds.ollama).toEqual({ similarity: 0.57, coverage: 0.57 });
    expect(embeddingThresholds.cloud).toEqual({ similarity: 0.396, coverage: 0.431 });
  });
});
