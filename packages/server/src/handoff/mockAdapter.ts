import type { HandoffAdapter, HandoffPayload, HandoffResult } from "./adapter.js";

/**
 * Default handoff adapter: no real helpdesk wired up yet. Logs the
 * handoff and returns it as-is so it can be persisted on the Escalation
 * row. Swap for a ZendeskHandoffAdapter/etc. implementing the same
 * interface once a design partner's helpdesk is known.
 */
export const mockHandoffAdapter: HandoffAdapter = {
  async createTicket(payload: HandoffPayload): Promise<HandoffResult> {
    console.log("[mockHandoffAdapter] Escalation created (no real helpdesk connected):", {
      conversationId: payload.conversationId,
      reason: payload.reason,
    });
    return { externalTicketId: null, raw: { ...payload } };
  },
};
