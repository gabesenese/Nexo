export interface AnswerGate {
  modelConfidence: number;
  retrievedCount: number;
}

/**
 * Whether this answer goes to a human instead of to the customer.
 *
 * Retrieving nothing escalates on its own, whatever the model says about
 * itself, because there was no grounding to answer from. That used to be an
 * emergent side effect of the threshold happening to sit above 0.5, so lowering
 * `CONFIDENCE_THRESHOLD` would have silently removed it. It is a separate rule
 * now.
 *
 * Otherwise the model's self-assessment decides, and there is deliberately no
 * retrieval-quality term beside it. One used to cap confidence at
 * `0.5 + topRetrievalScore * 0.5`, but `hybridSearch` min-max normalises within
 * its own result set: the top hit lands at 0.6 or above whether the corpus
 * answered the question perfectly or holds nothing related at all, so the cap
 * could never fire. Worse, a result set whose scores all tie normalises every
 * row to 0, which forced an escalation on every question in a workspace with a
 * single chunk.
 *
 * A real grounding floor needs absolute cosine similarity against a cutoff
 * measured per embedding model, the way `knowledge/gaps.ts` does it. That
 * cutoff cannot be measured until the corpus is embedded with the production
 * model, so it waits for the cloud cutover rather than shipping calibrated
 * against the local one. The model's own judgement covers the case in the
 * meantime, and unlike the cap it is measured: see `CONFIDENCE_THRESHOLD`.
 */
export function shouldEscalate({ modelConfidence, retrievedCount }: AnswerGate, threshold: number): boolean {
  if (retrievedCount === 0) return true;
  return modelConfidence < threshold;
}
