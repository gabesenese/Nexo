import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import type { ChatProvider, ChatResponse, GenerateParams } from "./provider.js";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set (required for the Anthropic chat provider)");
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const RESPOND_TOOL: Anthropic.Tool = {
  name: "respond",
  description:
    "Return the answer to the user's support question, grounded only in the provided context, plus a self-assessed confidence.",
  input_schema: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description: "The answer to give the user, in plain prose. If the context doesn't cover the question, say so briefly.",
      },
      confidence: {
        type: "number",
        description:
          "0-1 confidence that this answer fully and correctly resolves the user's question using ONLY the given context. Use a low score (<0.4) if the context is irrelevant, incomplete, or contradictory.",
      },
      usedSourceIds: {
        type: "array",
        items: { type: "string" },
        description: "IDs of the context chunks actually used to construct the answer.",
      },
    },
    required: ["answer", "confidence", "usedSourceIds"],
  },
};

const SYSTEM_PROMPT = `You are Nexo, an AI customer support agent. Answer ONLY using the provided context chunks.
Never fabricate information not present in the context. If the context is insufficient, irrelevant, or
contradictory, say so and give a low confidence score rather than guessing; a human agent will take over
in that case. Always cite which context chunks you used via usedSourceIds. Keep answers concise and direct.`;

/**
 * `max_tokens` is a ceiling on thinking *plus* visible output, not a reservation,
 * so raising it costs nothing and only widens the margin before a truncated
 * response. Thinking is turned off explicitly because current models run it by
 * default when the field is omitted: on a forced single tool call it buys
 * nothing (the answer is already in the retrieved context), it is billed at the
 * output rate, and it puts seconds of latency in front of a customer waiting in
 * a live chat widget. Left on under the old 1024 ceiling it could consume the
 * budget before `respond` was emitted, and the tool-call lookup below would then
 * throw on a perfectly healthy response.
 */
const MAX_TOKENS = 2048;

export function buildRequest({
  history,
  message,
  context,
}: GenerateParams): Anthropic.MessageCreateParamsNonStreaming {
  const contextBlock = context.length
    ? context.map((c) => `[${c.id}] (source: ${c.sourceName})\n${c.content}`).join("\n\n---\n\n")
    : "(no relevant context found)";

  return {
    model: env.ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    tools: [RESPOND_TOOL],
    tool_choice: { type: "tool", name: "respond" },
    messages: [
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      {
        role: "user" as const,
        content: `Context:\n${contextBlock}\n\nQuestion: ${message}`,
      },
    ],
  };
}

export const anthropicChatProvider: ChatProvider = {
  async generateResponse(params: GenerateParams): Promise<ChatResponse> {
    const res = await getClient().messages.create(buildRequest(params));

    const toolUse = res.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Anthropic response did not include the expected tool call");
    }

    const input = toolUse.input as { answer: string; confidence: number; usedSourceIds: string[] };
    return {
      answer: input.answer,
      confidence: Math.max(0, Math.min(1, input.confidence)),
      usedSourceIds: input.usedSourceIds ?? [],
    };
  },
};
