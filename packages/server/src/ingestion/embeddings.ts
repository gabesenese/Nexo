import OpenAI from "openai";
import { env, EMBEDDING_DIMENSIONS } from "../config/env.js";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * The last line of defence against a silently mismatched embedding space.
 * Both pgvector columns are a fixed width, so a provider returning a different
 * one is not a degraded result, it is a write that will either fail or, worse,
 * succeed against a column that happens to match while meaning something
 * entirely different from every vector already stored.
 */
export function orderAndValidate(data: { index: number; embedding: number[] }[]): number[][] {
  return data
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Embedding model returned ${item.embedding.length} dims, expected ${EMBEDDING_DIMENSIONS}`,
        );
      }
      return item.embedding;
    });
}

let openAiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (required for the OpenAI embedding provider)");
  }
  openAiClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openAiClient;
}

/**
 * Cloud embedding provider. Kept behind the EmbeddingProvider interface so a
 * different vendor can be swapped in without touching callers.
 *
 * `dimensions` is requested explicitly rather than taking the model default.
 * text-embedding-3-small returns 1536 by default, and both pgvector columns in
 * the schema are vector(768), sized for the local nomic-embed-text model. The
 * text-embedding-3 family is trained so a shortened vector keeps its useful
 * properties, so asking for 768 turns the move to the cloud into a re-embed
 * rather than a re-embed plus a column migration on every chunk and escalation.
 *
 * This parameter only exists on text-embedding-3 and newer. An older model such
 * as text-embedding-ada-002 rejects it, which is the correct outcome: that model
 * cannot produce 768 dimensions and would silently fail the length check below.
 */
export const openAiEmbeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await getOpenAiClient().embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return orderAndValidate(res.data);
  },
};

/**
 * Local embedding provider via Ollama's OpenAI-compatible API. No API key or
 * external network call, which doubles as the data-residency wedge from the
 * brief. Default model is nomic-embed-text (768 dims).
 */
const ollamaClient = new OpenAI({ baseURL: env.OLLAMA_BASE_URL, apiKey: "ollama" });

export const ollamaEmbeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await ollamaClient.embeddings.create({
      model: env.OLLAMA_EMBEDDING_MODEL,
      input: texts,
    });
    return orderAndValidate(res.data);
  },
};

export const embeddingProvider: EmbeddingProvider =
  env.AI_PROVIDER === "cloud" ? openAiEmbeddingProvider : ollamaEmbeddingProvider;
