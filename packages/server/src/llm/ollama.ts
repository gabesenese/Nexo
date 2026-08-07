import OpenAI from "openai";
import { env } from "../config/env.js";
import type { ChatProvider, ChatResponse, GenerateParams } from "./provider.js";

const client = new OpenAI({ baseURL: env.OLLAMA_BASE_URL, apiKey: "ollama" });

const SYSTEM_PROMPT = `You are Nexo, an AI customer support agent. Answer ONLY using the provided context chunks.
Never fabricate information not present in the context. If the context is insufficient, irrelevant, or
contradictory, say so and give a low confidence score rather than guessing; a human agent will take over
in that case.

Respond with a single JSON object and nothing else, matching exactly this shape:
{
  "answer": string,        // the answer in plain prose; if context does not cover it, say so briefly
  "confidence": number,    // 0-1 that this answer fully and correctly resolves the question using ONLY the given context; use <0.4 when context is irrelevant, incomplete, or contradictory
  "usedSourceIds": string[] // the [id] values of the context chunks you actually used
}`;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const ollamaChatProvider: ChatProvider = {
  async generateResponse({ history, message, context }: GenerateParams): Promise<ChatResponse> {
    const contextBlock = context.length
      ? context.map((c) => `[${c.id}] (source: ${c.sourceName})\n${c.content}`).join("\n\n---\n\n")
      : "(no relevant context found)";

    const res = await client.chat.completions.create({
      model: env.OLLAMA_CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user", content: `Context:\n${contextBlock}\n\nQuestion: ${message}` },
      ],
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Ollama response did not include any content");
    }

    let parsed: { answer?: unknown; confidence?: unknown; usedSourceIds?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Ollama response was not valid JSON: ${raw.slice(0, 200)}`);
    }

    const usedSourceIds = Array.isArray(parsed.usedSourceIds)
      ? parsed.usedSourceIds.filter((id): id is string => typeof id === "string")
      : [];

    return {
      answer: typeof parsed.answer === "string" ? parsed.answer : "",
      confidence: clamp01(typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence)),
      usedSourceIds,
    };
  },
};
