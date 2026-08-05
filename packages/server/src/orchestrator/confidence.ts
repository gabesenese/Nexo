/**
 * Combines the model's self-assessed confidence with the top retrieval
 * score so a confident-sounding answer grounded in weak/irrelevant
 * context still gets capped low. Retrieval score acts as a ceiling,
 * not just an input the model can be persuaded past.
 */
export function computeCombinedConfidence(modelConfidence: number, topRetrievalScore: number): number {
  return Math.min(modelConfidence, 0.5 + topRetrievalScore * 0.5);
}

export function shouldEscalate(combinedConfidence: number, threshold: number): boolean {
  return combinedConfidence < threshold;
}
