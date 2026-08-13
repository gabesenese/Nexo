import { describe, expect, it } from "vitest";
import { buildRequest } from "../src/llm/anthropic.js";

const context = [{ id: "chunk-1", sourceName: "Help centre", content: "Refunds take 5 days." }];

describe("buildRequest", () => {
  /**
   * The production failure this exists to catch: current models think by default
   * when `thinking` is omitted, and `max_tokens` bounds thinking and output
   * together. Reasoning could then consume the budget before the forced
   * `respond` call was emitted, leaving no tool_use block, and the provider
   * would throw on a response the API considered successful. The customer sees
   * a broken chat, and nothing in the error names the real cause.
   */
  it("turns thinking off so it cannot consume the tool call's token budget", () => {
    expect(buildRequest({ history: [], message: "Do you refund?", context }).thinking).toEqual({
      type: "disabled",
    });
  });

  it("leaves headroom above the answer a support reply needs", () => {
    expect(buildRequest({ history: [], message: "Do you refund?", context }).max_tokens).toBeGreaterThan(1024);
  });

  it("forces the respond tool so the answer is always structured", () => {
    const req = buildRequest({ history: [], message: "Do you refund?", context });
    expect(req.tool_choice).toEqual({ type: "tool", name: "respond" });
    expect(req.tools?.map((t) => t.name)).toEqual(["respond"]);
  });

  it("keeps prior turns in order and puts the new question last", () => {
    const req = buildRequest({
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ],
      message: "Do you refund?",
      context,
    });
    expect(req.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(req.messages.at(-1)?.content).toContain("Question: Do you refund?");
  });

  it("labels each chunk with the id the model must cite back", () => {
    const req = buildRequest({ history: [], message: "Do you refund?", context });
    expect(req.messages.at(-1)?.content).toContain("[chunk-1]");
  });

  it("tells the model plainly when retrieval found nothing", () => {
    const req = buildRequest({ history: [], message: "Do you refund?", context: [] });
    expect(req.messages.at(-1)?.content).toContain("(no relevant context found)");
  });
});
