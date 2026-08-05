import OpenAI from "openai";
import { env, EMBEDDING_DIMENSIONS } from "../config/env.js";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Default embedding provider. Kept behind the EmbeddingProvider interface
 * so a different vendor (or a Canadian/regional-hosted alternative, for
 * the data-residency wedge) can be swapped in without touching callers.
 */
export const openAiEmbeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: texts,
    });
    return res.data
      .sort((a, b) => a.index - b.index)
      .map((item) => {
        if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embedding model returned ${item.embedding.length} dims, expected ${EMBEDDING_DIMENSIONS}`,
          );
        }
        return item.embedding;
      });
  },
};

export const embeddingProvider = openAiEmbeddingProvider;
