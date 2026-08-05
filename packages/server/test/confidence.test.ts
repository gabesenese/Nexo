import { describe, expect, it } from "vitest";
import { computeCombinedConfidence, shouldEscalate } from "../src/orchestrator/confidence.js";

describe("computeCombinedConfidence", () => {
  it("caps a confident model answer when retrieval score is weak", () => {
    const combined = computeCombinedConfidence(0.95, 0.0);
    expect(combined).toBeCloseTo(0.5);
  });

  it("allows near-full confidence when retrieval score is strong", () => {
    const combined = computeCombinedConfidence(0.95, 1.0);
    expect(combined).toBeCloseTo(0.95);
  });

  it("is never dragged up by retrieval score alone (ceiling, not boost)", () => {
    const combined = computeCombinedConfidence(0.2, 1.0);
    expect(combined).toBeCloseTo(0.2);
  });
});

describe("shouldEscalate", () => {
  it("escalates when combined confidence is below the threshold", () => {
    expect(shouldEscalate(0.4, 0.55)).toBe(true);
  });

  it("does not escalate when combined confidence meets the threshold", () => {
    expect(shouldEscalate(0.55, 0.55)).toBe(false);
    expect(shouldEscalate(0.8, 0.55)).toBe(false);
  });
});
