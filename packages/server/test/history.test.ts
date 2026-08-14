import { describe, expect, it } from "vitest";
import { toHistory } from "../src/orchestrator/history.js";
import { env } from "../src/config/env.js";

function thread(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i}`,
  }));
}

describe("toHistory", () => {
  /**
   * The cost bug this exists to catch: every turn resends the history, so an
   * uncapped thread pays for its own past again on each new question and the
   * bill grows quadratically in conversation length. The expensive case is not
   * the typical two-turn thread, it is the customer going round after round
   * before escalating.
   */
  it("sends only the most recent window of a long thread", () => {
    const out = toHistory(thread(40));
    expect(out).toHaveLength(env.CHAT_HISTORY_MESSAGES);
    expect(out.at(-1)?.content).toBe("message 39");
    expect(out.at(0)?.content).toBe(`message ${40 - env.CHAT_HISTORY_MESSAGES}`);
  });

  it("keeps a short thread whole", () => {
    expect(toHistory(thread(3)).map((t) => t.content)).toEqual(["message 0", "message 1", "message 2"]);
  });

  it("preserves order oldest to newest", () => {
    const out = toHistory(thread(4));
    expect(out.map((t) => t.content)).toEqual(["message 0", "message 1", "message 2", "message 3"]);
  });

  it("handles an empty thread", () => {
    expect(toHistory([])).toEqual([]);
  });

  /**
   * An operator's reply is stored with role "agent", not "assistant". Mapping
   * it to anything the provider does not accept would be rejected by the API,
   * and presenting it as a third voice invites the model to narrate the
   * handover instead of answering.
   */
  it("presents operator replies in the same voice as the AI's own", () => {
    const out = toHistory([
      { role: "user", content: "hi" },
      { role: "agent", content: "an operator wrote this" },
      { role: "assistant", content: "the AI wrote this" },
    ]);
    expect(out.map((t) => t.role)).toEqual(["user", "assistant", "assistant"]);
  });
});
