export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GroundedContext {
  id: string;
  sourceName: string;
  content: string;
}

export interface ChatResponse {
  answer: string;
  /** Model's self-assessed confidence, 0-1, that `answer` correctly and
   *  fully resolves the user's question using only the provided context. */
  confidence: number;
  usedSourceIds: string[];
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
