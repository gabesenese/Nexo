import { describe, expect, it } from "vitest";
import { conversationUsageState } from "../src/billing/usage.js";

describe("conversationUsageState", () => {
  it("stays quiet well inside the allowance", () => {
    expect(conversationUsageState(0)).toBe("ok");
    expect(conversationUsageState(0.5)).toBe("ok");
    expect(conversationUsageState(0.79)).toBe("ok");
  });

  it("warns from four fifths of the allowance", () => {
    expect(conversationUsageState(0.8)).toBe("approaching");
    expect(conversationUsageState(0.99)).toBe("approaching");
  });

  /**
   * `overage` is `used - limit`, so the last conversation inside the allowance
   * is not an overage. Reporting "over" here would put a banner in front of an
   * operator who has spent exactly what they paid for.
   */
  it("does not call the workspace over at exactly the allowance", () => {
    expect(conversationUsageState(1)).toBe("approaching");
  });

  it("reports over once the allowance is passed", () => {
    expect(conversationUsageState(1.0001)).toBe("over");
    expect(conversationUsageState(3)).toBe("over");
  });
});
