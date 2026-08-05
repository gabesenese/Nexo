# Nexo — AI Support Agent for Mid-Market Canada/North America

## 1. The Opportunity

Ada (ada.cx), the dominant AI customer-support platform, is built exclusively for enterprise:
- Requires 300,000+ annual conversations to qualify
- Pricing starts ~$30K/year, median ~$70K/year, enterprise deals reach $300K+/year
- No published pricing — requires a sales call and multi-month procurement
- 8–16 week implementation despite "no-code" marketing

This structurally excludes the SMB and low-mid-market segment (roughly 1,000–50,000 conversations/month) — a large, underserved market with no strong Canadian-headquartered player.

Beyond pricing, Ada has documented product weaknesses we can build against directly:
- **Context loss / looping**: end-user reviews (Trustpilot 2.0/5) cite conversations losing context and getting stuck, despite admin-side reviews (G2 4.6/5) being positive — a real product gap, not just a pricing gap.
- **Narrow ingestion**: cannot natively ingest past tickets, PDFs, Confluence, Notion, or Google Docs — works best with formal help-center content only.
- **Platform lock-in**: full features require Zendesk or Salesforce; other helpdesks get reduced functionality.
- **Playbook rigidity**: users report getting "stuck" in structured flows with no easy exit.
- **Shallow reporting**: admins want more detailed analytics than Ada currently provides.

## 2. Positioning

**"The AI support agent for companies too small for Ada, too serious for a basic chatbot."**

Target customer: Canadian/North American SMB and low-mid-market companies doing 1,000–50,000 support conversations/month, on any major helpdesk (not just Zendesk/Salesforce).

Differentiators to lead with:
1. Transparent, self-serve pricing — no $30K floor, no sales call required to see a number
2. Ingests everything on day one — tickets, PDFs, Notion, Confluence, Slack, Drive
3. Escalation-first — a human is always one click away, full context handed off
4. Days to launch, not months
5. Canadian data residency (relevant for healthcare, fintech, public sector buyers)

## 3. MVP Scope

### In scope (v1)
| Component | Description |
|---|---|
| Ingestion layer | Connectors: help center, PDFs, Notion, Confluence, Google Drive, Slack, historical tickets (Zendesk/Freshdesk export). Auto-sync on content changes. |
| Chat agent | Retrieval-grounded answers with visible source citations. Full session memory across turns. Confidence-based escalation instead of guessing/looping. |
| Escalation | Always-visible "talk to a human" option. Full context handoff (transcript + sources + issue summary) to human agent. |
| Flow builder | Lightweight visual builder for 5–10 common structured flows (refunds, order status, password reset, etc.), each with a built-in exit to human or free-form Q&A. |
| Analytics | Resolution rate, escalation rate, deflection savings, and a "confusion report" surfacing repeated failure points. |
| Billing | Transparent tiered or per-resolved-conversation pricing, self-serve signup, free tier for low volume. |

### Explicitly out of scope (v1)
- Voice agents (v2 — adds telephony/ASR/latency complexity)
- LMS/education product, sales-agent marketplace (resist bundling until core product has paying customers)
- Deep enterprise compliance certs (SOC 2 Type II, HIPAA) — document strong practices early, pursue full certs once enterprise demand justifies the cost

## 4. Technical Architecture

### High-level components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Ingestion       │────▶│  Vector store /   │────▶│  Retrieval +     │
│  connectors      │     │  knowledge index  │     │  reasoning layer │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                            │
┌─────────────────┐     ┌──────────────────┐              ▼
│  Analytics /     │◀────│  Conversation     │◀────┌─────────────────┐
│  confusion report│     │  orchestrator     │      │  Chat widget /   │
└─────────────────┘     │  (state, memory,  │      │  helpdesk plugin │
                         │  escalation logic)│      └─────────────────┘
                         └────────┬─────────┘
                                  ▼
                         ┌──────────────────┐
                         │  Human handoff    │
                         │  (helpdesk API)   │
                         └──────────────────┘
```

### 4.1 Ingestion layer
- **Connectors**: build with a common interface (`fetch`, `parse`, `chunk`, `sync`) so new sources are cheap to add.
  - Priority order: help center (Zendesk/Intercom articles), PDFs, Notion, Confluence, Google Drive, Slack export, historical tickets.
  - Use existing SDKs/APIs where available (Notion API, Confluence REST API, Google Drive API) rather than scraping.
- **Chunking**: semantic chunking (not fixed-length) — split on headings/sections, keep chunks 200–500 tokens with overlap.
- **Sync**: webhook-based where the source supports it (Notion, Slack); polling fallback (e.g. every 15–60 min) for sources without webhooks.
- **Metadata**: store source, last-updated timestamp, and permissions scope with each chunk — needed later for access control and for showing citations to end users.

### 4.2 Vector store / knowledge index
- Start with a managed vector DB to avoid infra overhead: **Pinecone**, **Weaviate Cloud**, or **pgvector** on Postgres if you want to keep infra simple and already run Postgres elsewhere.
- pgvector is a reasonable MVP choice if the team is already Postgres-heavy (fewer moving parts, one database to operate) — you can migrate to a dedicated vector DB later if scale demands it.
- Store both dense embeddings and raw text/metadata for citation display.
- Embedding model: OpenAI `text-embedding-3-large` or an open-weight alternative (e.g. BGE, Voyage) if cost or data residency is a concern — for Canadian data residency claims, this choice matters, so evaluate providers with Canadian/regional hosting options.

### 4.3 Retrieval + reasoning layer
- Hybrid retrieval (dense vector + keyword/BM25) tends to outperform pure vector search for support content full of exact terms (SKUs, error codes, product names).
- Re-ranking step (e.g. Cohere rerank or a cross-encoder) before passing top chunks to the LLM — meaningfully improves answer accuracy and is cheap relative to the LLM call.
- LLM: Claude or GPT-4-class model for reasoning/generation; keep this provider-swappable behind an internal interface rather than hardcoding one vendor, since model quality and pricing shift often.
- Confidence scoring: track retrieval score + a self-assessed confidence from the model; below threshold → escalate rather than answer speculatively. This is the single highest-leverage feature for avoiding Ada's #1 complaint (context loss / wrong answers).

### 4.4 Conversation orchestrator
- Owns session state, turn-by-turn memory, and escalation decisions.
- Design this as an explicit state machine, not just a prompt loop — makes the "always an exit" guarantee enforceable in code rather than hoping the LLM cooperates.
- Structured flows (flow builder) are defined as graphs with named nodes; every node has a default "escalate" and "ask something else" edge, so users can't be trapped in a broken path (directly fixes Ada's Playbook complaint).

### 4.5 Human handoff
- Integrate with target helpdesks' APIs (Zendesk, Freshdesk, Gorgias, Intercom, HubSpot) to create/update a ticket with full transcript + retrieved sources + a generated issue summary on escalation.
- Build helpdesk-agnostic from day one — this is a direct differentiator vs. Ada's Zendesk/Salesforce-only full functionality.

### 4.6 Analytics
- Log every conversation with: resolution outcome, escalation reason (if any), retrieval confidence, sources used.
- "Confusion report": cluster unresolved/escalated conversations by topic (embedding clustering) to surface recurring knowledge gaps — this is a genuinely differentiated feature vs. Ada's reported shallow reporting.

### 4.7 Stack suggestion (pragmatic, small-team friendly)
- Backend: Node.js/TypeScript or Python (FastAPI) — pick based on team's existing strength
- DB: Postgres (+ pgvector for MVP)
- Queue/jobs: for ingestion sync and analytics clustering (e.g. BullMQ or a managed queue)
- Frontend: React for both the embeddable chat widget and the admin dashboard
- Hosting: Canadian or Canada-capable region (e.g. AWS ca-central-1) to support the data-residency claim from day one

## 5. Build Sequence

1. Ingestion (help center + PDFs first) + retrieval + basic embeddable chat widget — get something demoable
2. Escalation flow + one helpdesk integration (pick the most common one among early design partners)
3. Flow builder for top 5 use cases
4. Analytics dashboard + confusion report
5. Self-serve billing + public pricing page
6. Pilot with 3–5 Canadian SMB design partners (retail, fintech, or SaaS) before public launch

## 6. Open Questions to Resolve Early
- Which helpdesk to integrate with first — should be driven by design partner conversations, not guessed
- Build vs. buy for voice (v2) — Vapi/Bland/Retell as infra vs. building in-house
- Pricing model specifics — per-resolved-conversation vs. tiered-by-volume vs. seat-based
- Data residency commitments — full Canadian hosting from day one, or as a paid enterprise add-on later
