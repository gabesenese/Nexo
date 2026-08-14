import { env } from "../config/env.js";
import type { ChatTurn } from "../llm/provider.js";

interface HistoryMessage {
  role: string;
  content: string;
}

/**
 * Turns stored messages into the turns sent to the model, keeping only the most
 * recent `CHAT_HISTORY_MESSAGES`. The window is what stops a long thread
 * costing tokens quadratically in its own length; see the note on that setting.
 *
 * Anything that is not a customer message is presented as `assistant`, so an
 * operator's reply and the AI's own answer read as one voice. That is
 * deliberate: the customer experienced a single support conversation, and
 * telling the model otherwise invites it to comment on the handover.
 */
export function toHistory(messages: HistoryMessage[]): ChatTurn[] {
  return messages
    .slice(-env.CHAT_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
}
