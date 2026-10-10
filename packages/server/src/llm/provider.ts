export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GroundedContext {
  id: string;
  sourceName: string;
  content: string;
}

/**
 * What one model call consumed, as the provider reported it. Recorded so cost
 * per conversation is measured; never used to decide what a customer sees.
 */
export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Zero today: Nexo does not use prompt caching. Kept so turning it on needs no schema change. */
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ChatResponse {
  answer: string;
  /** Model's self-assessed confidence, 0-1, that `answer` correctly and
   *  fully resolves the user's question using only the provided context. */
  confidence: number;
  usedSourceIds: string[];
  /** Absent when the provider does not report token counts. */
  usage?: TokenUsage;
}

export interface GenerateParams {
  history: ChatTurn[];
  message: string;
  context: GroundedContext[];
}

/**
 * Kept provider-swappable per the project brief. Model quality/pricing
 * shifts often and the orchestrator shouldn't hardcode a vendor.
 */
export interface ChatProvider {
  generateResponse(params: GenerateParams): Promise<ChatResponse>;
}
