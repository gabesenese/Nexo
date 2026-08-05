# Nexo — Structured Project Plan
### AI Support Agent for Mid-Market Canada/North America

**Working name: Nexo** (subject to trademark clearance — see note below)

---

## 1. Executive Summary

Ada (ada.cx) dominates AI customer support but only serves enterprise: 300,000+ conversations/year minimum, $30K–$300K+/year pricing, opaque quotes, 8–16 week implementations. This leaves the mid-market segment (1,000–50,000 conversations/month) underserved, especially in Canada, where no strong Canadian-headquartered challenger exists.

The plan: build a focused AI support agent — not a bundle — that wins on transparent pricing, broader knowledge ingestion, escalation-first design, and helpdesk flexibility. Target $5–15M ARR in Canada + US mid-market within 3–5 years as the realistic base case; treat anything larger as upside, not the plan.

---

## 2. Vision & Positioning

**Positioning statement:**
"The AI support agent for companies too small for Ada, too serious for a basic chatbot."

**Target customer:** Canadian/North American SMB and low-mid-market companies, 1,000–50,000 support conversations/month, on any major helpdesk.

**Core differentiators (in priority order):**
1. Transparent, self-serve pricing — no sales-call-to-see-a-number
2. Full knowledge ingestion on day one — tickets, PDFs, Notion, Confluence, Slack, Drive
3. Escalation-first — human handoff always one click away, full context passed
4. Helpdesk-agnostic — Zendesk, Freshdesk, Gorgias, Intercom, HubSpot
5. Days-to-launch, not months
6. Canadian data residency (secondary wedge for regulated buyers)

---

## 3. Phased Roadmap

### Phase 0 — Validation (Weeks 1–6)
**Goal:** Confirm the problem and pricing tolerance before writing production code.
- Interview 20–30 support/CX leaders at Canadian mid-market companies (target: current Zendesk/Freshdesk/Intercom users, 1K–50K conversations/month)
- Validate: Is pricing opacity/enterprise-floor actually a blocker for them? Would they switch off an existing tool, or is this net-new spend?
- Recruit 3–5 design partners willing to pilot a pre-product version
- Deliverable: a one-page validation summary — go/no-go decision point

### Phase 1 — MVP Build (Months 2–4)
**Goal:** Working product with one design partner live.
- Ingestion: help center + PDFs + one of (Notion/Confluence/Slack) — don't build all connectors before one works well
- Retrieval + chat agent with citation display and confidence-based escalation
- One helpdesk integration (chosen based on design partner's actual stack)
- Basic embeddable chat widget
- No billing system yet — manual invoicing for design partners
- Deliverable: 1 design partner live in production, handling real conversations

### Phase 2 — Pilot & Iterate (Months 4–7)
**Goal:** Prove retention and resolution quality across multiple customers.
- Expand to 3–5 design partners across different verticals (retail, fintech/SaaS, services)
- Build flow builder for top 5 structured use cases
- Build analytics dashboard + confusion report
- Track resolution rate, escalation rate, and — critically — whether design partners would pay full price and renew
- Deliverable: documented case studies, resolution-rate benchmarks, renewal commitments

### Phase 3 — Public Launch (Months 7–10)
**Goal:** Self-serve acquisition begins.
- Self-serve billing, public pricing page, signup flow
- Second and third helpdesk integrations
- Canadian hosting/data residency formalized
- Basic SOC 2 Type I process started
- Deliverable: public launch, first cohort of self-serve customers outside design partners

### Phase 4 — Scale (Months 10–24)
**Goal:** Repeatable growth engine, US expansion.
- Expand helpdesk integrations to cover 90%+ of target market
- Add voice channel (v2) — build vs. buy decision (Vapi/Bland/Retell vs. in-house)
- Begin US mid-market go-to-market
- SOC 2 Type II if enterprise pull justifies it
- Deliverable: repeatable CAC/LTV model, first US customers, Series A readiness (if VC path) or profitability path (if bootstrapped)

---

## 4. Technical Architecture (Summary)

*(Full detail in prior project-brief.md — key points below)*

- **Ingestion:** connector-per-source, semantic chunking, webhook sync where available
- **Vector store:** pgvector (MVP, low infra overhead) → dedicated vector DB if scale demands
- **Retrieval:** hybrid (dense + keyword) + re-ranking before LLM call
- **LLM:** provider-swappable interface (Claude/GPT-class), not hardcoded
- **Orchestration:** explicit state machine for conversations — escalation and "ask something else" are code-level guarantees, not prompt hopes
- **Handoff:** helpdesk API integration with full transcript + sources + summary
- **Analytics:** per-conversation logging, embedding-based clustering for confusion reports
- **Hosting:** Canada-capable region (e.g. AWS ca-central-1) from day one

---

## 5. Team & Hiring Plan

| Stage | Roles needed |
|---|---|
| Phase 0–1 | Founder(s) + 1 full-stack engineer (you may already cover this) |
| Phase 2 | + 1 engineer (retrieval/ML-leaning), + 1 design-partner success/support hire (part-time ok) |
| Phase 3 | + 1 growth/marketing hire, + 1 more engineer |
| Phase 4 | + sales hire(s) for US expansion, + customer success team |

Keep the team lean through Phase 2 — the goal is proving retention with design partners, not headcount.

---

## 6. Success Metrics (by phase)

- **Phase 0:** 20+ interviews completed, 3+ design partners signed
- **Phase 1:** 1 design partner live, resolution rate baseline established
- **Phase 2:** 3–5 design partners, 60%+ resolution rate, verbal renewal commitments
- **Phase 3:** 10+ paying self-serve customers, published pricing converting at a sane rate
- **Phase 4:** $1M+ ARR, positive unit economics (CAC payback under 12 months), first US logos

---

## 7. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Crowded competitive field (Voiceflow, SiteGPT, eesel, My AskAI, Intercom Fin already attacking Ada) | Win on Canadian-specific wedge + genuinely better escalation/ingestion, not just price |
| Resolution quality doesn't beat incumbents | Treat confidence-based escalation as non-negotiable; don't ship an agent that loops |
| Canada-only market is too small | Plan US expansion from Phase 4, don't treat Canada as the whole plan |
| Long sales cycles even at mid-market | Self-serve motion + design partner referrals to shorten cycle |
| Knowledge base quality varies wildly by customer | Build onboarding tooling that audits/flags weak knowledge sources early |

---

## 8. Builder Prompt (for Claude Code or an engineering AI assistant)

Use this as a starting prompt when you're ready to scaffold the actual codebase:

```
I'm building an AI customer support agent product (a Canadian mid-market
alternative to Ada/ada.cx). Help me scaffold the MVP with this architecture:

CORE REQUIREMENTS:
- Ingestion connectors for: help center articles, PDF uploads, and one of
  (Notion API / Confluence API / Slack export) — start with help center + PDF only
- Semantic chunking (200-500 tokens, overlap, split on headings)
- Vector storage using Postgres + pgvector
- Hybrid retrieval: dense vector search + keyword/BM25, with a re-ranking step
- Conversation orchestrator built as an explicit state machine (not just a
  prompt loop) — every conversation node must have an escalation exit and a
  "start over" exit, enforced in code
- Confidence-based escalation: if retrieval score or model self-assessed
  confidence is below a threshold, escalate to human instead of answering
- Embeddable chat widget (React) with visible source citations on every
  AI-generated answer
- Helpdesk integration: start with [Zendesk/Freshdesk/Intercom — pick one
  based on design partner], create/update a ticket on escalation with full
  transcript + retrieved sources + a generated summary
- Basic admin dashboard: resolution rate, escalation rate, and a "confusion
  report" that clusters unresolved conversations by topic

STACK:
- Backend: [Node.js/TypeScript or Python/FastAPI — pick one]
- DB: Postgres + pgvector
- Frontend: React (widget + admin dashboard)
- LLM calls behind a provider-agnostic interface (support swapping between
  Claude and GPT-class models without rewriting call sites)
- Hosted on [AWS ca-central-1 / your choice] for Canadian data residency

START WITH:
1. Project scaffolding (backend + frontend + DB schema for chunks, sources,
   conversations, escalations)
2. Ingestion pipeline for help-center + PDF sources
3. Retrieval + chat endpoint with citation support
4. Chat widget that can be embedded via a script tag

Ask me clarifying questions about design partner's specific helpdesk and
any missing requirements before generating code.
```

---

## 9. Immediate Next Actions (this week)

1. ~~Pick a working name~~ — using **Nexo** as working name. Run a proper trademark search (CIPO for Canada, USPTO for US) before committing long-term — "Nexo" is already used by a major crypto platform (Nexo.io), which could cause confusion or trademark friction. Register domain (.com + .ca) once cleared, or hold with a placeholder.
2. Draft the 20-question interview script for Phase 0 validation calls
3. List 30 target companies for outreach (mid-market Canadian companies on Zendesk/Freshdesk/Intercom)
4. Set up the repo using the builder prompt above once you're ready to code
5. Decide bootstrapped vs. fundraising path — this affects hiring pace and runway planning
