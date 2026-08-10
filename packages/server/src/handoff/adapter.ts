export interface HandoffTranscriptEntry {
  role: "user" | "assistant";
  content: string;
}

export interface HandoffPayload {
  conversationId: string;
  organizationId: string;
  reason: string;
  summary: string;
  transcript: HandoffTranscriptEntry[];
  sources: { id: string; sourceName: string }[];
}

export interface HandoffResult {
  externalTicketId: string | null;
  raw: Record<string, unknown>;
}

/**
 * Every target helpdesk (Zendesk, Freshdesk, Gorgias, Intercom, HubSpot)
 * implements this same interface. Helpdesk-agnostic handoff is a
 * deliberate differentiator vs. Ada's Zendesk/Salesforce-only full
 * functionality. Which one to build first is a design-partner decision
 * (Phase 0), not guessed. MockHandoffAdapter is the default until then.
 */
export interface HandoffAdapter {
  createTicket(payload: HandoffPayload): Promise<HandoffResult>;
}
