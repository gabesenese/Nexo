# Nexo — Structured Project Plan
### AI Support Agent for Mid-Market Canada/North America

**Working name: Nexo** (subject to trademark clearance — see note below)

> This document is the single source of truth for **project status and sequencing**.
> `PHILOSOPHY.md` holds the durable company thesis (why Nexo exists, what it refuses to
> become). `project-brief.md` holds the durable why/what (market, positioning, architecture).
> `README.md` holds the how (as-built architecture, setup). When those disagree with
> this file on *what comes next*, this file wins; when this file conflicts with
> `PHILOSOPHY.md` on strategic direction, `PHILOSOPHY.md` wins.

---

## 0. The Roadmap at a Glance

We build Nexo in **vertical slices**, one milestone at a time. A milestone is a complete
customer journey (UI → API → DB → visible result), never an isolated layer. It is done only
when a brand-new real customer can complete it end-to-end, with nothing mocked.

Each milestone is named for the customer outcome it unlocks:

| Milestone | Outcome |
|---|---|
| M1 — Marketing | A visitor understands Nexo. |
| M2 — Customer Identity | A visitor becomes a customer. |
| M3 — Knowledge Import | A customer teaches Nexo. |
| M4 — Widget Deployment | Nexo answers real questions. |
| M5 — Support Operations | The support team uses Nexo daily. |
| M6 — Billing & Readiness | A customer pays and stays. |

**We optimize for learning, not for shipping milestones.** Each slice's value is what it lets
us observe about real users (M2's value is watching a real signup; M3's is learning whether
users understand how to teach Nexo), not the feature itself. If a piece of work doesn't move
one of the six outcomes forward, we ask why we're building it.

**CTO rule:** Never build an isolated layer. Build complete user journeys.

(Milestone names are how we discuss progress internally; a milestone can still be tagged a
release like v0.2.0 when it ships.)

### Current status (updated 2026-08-06)

**Active milestone: M2 — Customer Identity.** M1 is done. M3–M5 have real backend pieces
built ahead of their slice, but none is customer-complete yet, so none counts as done under
the rule above.

Done as backend, not yet a complete slice:
- Ingestion → hybrid retrieval → local LLM (Ollama, free/on-machine) → confidence-based
  escalation, proven end-to-end against real content (belongs to M3/M4).
- Webhook handoff on escalation, proven with HMAC signature + fail-safe delivery (belongs to M5).
- Onboarding wizard UI prototype, not wired to a backend (belongs to M2–M4).

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

## 3. Milestone Roadmap

Ordered by customer journey. Each milestone is a vertical slice; sub-slices keep each one
thin enough to finish and learn from. GitHub Milestones mirror this list; every issue belongs
to one.

### M1 — Marketing ✅ done
**Outcome:** A visitor understands Nexo.
Landing page, positioning, pricing, philosophy, lead capture. Locked unless customer feedback
says otherwise.

### M2 — Customer Identity ← ACTIVE
**Outcome:** A visitor becomes a customer. A real company can create an account and enter its
own workspace. (We are building a customer, not "multi-tenancy.") Covers issue #2.
- **M2a — Account Creation.** Signup, login, session, empty workspace.
  *Done when:* a completely new user can sign up and arrive inside their own workspace.
- **M2b — Workspace Ownership.** Organization model, workspace, ownership, org settings.
  *Done when:* everything belongs to an organization.
- **M2c — Tenant Isolation.** organizationId everywhere, scoped queries, authorization, tests.
  *Done when:* two organizations cannot see each other's data.

### M3 — Knowledge Import
**Outcome:** A customer teaches Nexo. *Learning goal:* do users understand how to teach it?
Upload a PDF, connect a help center, watch it index, see the source list, delete a source.
Backend (ingestion + embeddings, local via Ollama) is already proven; this milestone builds
the customer-facing path on top of it.
*Done when:* a customer can upload documentation and see it become searchable knowledge.

### M4 — Widget Deployment
**Outcome:** Nexo answers real questions, and the customer goes live.
Test the AI, widget customization, real install snippet, domain verification, embedded widget
on their site. Escalation + webhook handoff backend already proven.
*Done when:* a customer can install the widget and it answers a real question on their site.
Covers issue #9 (flip the landing CTA to onboarding once this is genuinely self-serve).

### M5 — Support Operations
**Outcome:** The support team uses Nexo daily.
Conversations view, escalations, analytics, source management. The dashboard emerges here
naturally, because now there is real data to manage, not because "we need a dashboard."
*Done when:* a support manager can run their day inside Nexo.

### M6 — Billing & Readiness
**Outcome:** A customer pays and stays.
Self-serve billing, public pricing conversion, plan limits, Canadian data-residency
formalization, SOC 2 process.
*Done when:* a customer can subscribe and keep using Nexo without our help.

---

### Business track (runs in parallel, not a second roadmap)

These are ongoing business activities that inform the milestones above; they are not build
work and do not block a milestone from shipping:
- **Validation & design partners:** interview mid-market CX leaders, recruit 3–5 design
  partners, learn whether pricing opacity is a real blocker. Feeds M2–M5 priorities.
- **A real helpdesk handoff:** the current handoff is a generic webhook (works for anyone).
  A specific Zendesk/Freshdesk/etc. adapter drops into the same interface once a design
  partner's stack makes the choice real.
- **Beyond v1.0:** voice channel (build vs. buy: Vapi/Bland/Retell), US expansion, SOC 2
  Type II if enterprise pull justifies it.

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

Timed to the business track, not the build milestones. Keep the team lean until retention with
design partners is proven; the goal is learning, not headcount.

| Stage | Roles needed |
|---|---|
| Early (through M2–M3) | Founder(s) + 1 full-stack engineer (you may already cover this) |
| Pilot (design partners) | + 1 engineer (retrieval/ML-leaning), + 1 design-partner success/support hire (part-time ok) |
| Launch (M6 + self-serve) | + 1 growth/marketing hire, + 1 more engineer |
| Scale (US expansion) | + sales hire(s), + customer success team |

---

## 6. Success Metrics

**Primary: the six milestone outcomes** (§0). A milestone is a success when a real customer can
complete it end-to-end, and we learn something from watching them do it.

**Business KPIs (the business track):**
- Validation: 20+ CX-leader interviews, 3+ design partners signed
- First customer live: resolution-rate baseline established
- Pilot: 3–5 design partners, 60%+ resolution rate, verbal renewal commitments
- Launch: 10+ paying self-serve customers, public pricing converting at a sane rate
- Scale: $1M+ ARR, positive unit economics (CAC payback under 12 months), first US logos

---

## 7. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Crowded competitive field (Voiceflow, SiteGPT, eesel, My AskAI, Intercom Fin already attacking Ada) | Win on Canadian-specific wedge + genuinely better escalation/ingestion, not just price |
| Resolution quality doesn't beat incumbents | Treat confidence-based escalation as non-negotiable; don't ship an agent that loops |
| Canada-only market is too small | Plan US expansion for the scale stage, don't treat Canada as the whole plan |
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

## 9. Immediate Next Actions

**Build (active milestone M2 — Customer Identity):**
1. M2a — Account Creation as a complete vertical slice: signup → login → session → land in
   your own empty workspace. Real DB, nothing mocked. Done when a brand-new user can do this
   unaided.

**Business track (in parallel, not blocking the build):**
2. ~~Pick a working name~~ — using **Nexo**. Run a proper trademark search (CIPO for Canada,
   USPTO for US) before committing long-term — "Nexo" is already used by a major crypto
   platform (Nexo.io). Register domain (.com + .ca) once cleared, or hold with a placeholder.
3. Draft the 20-question interview script and list 30 target mid-market Canadian companies
   (Zendesk/Freshdesk/Intercom users) for validation calls.
4. Decide bootstrapped vs. fundraising path — affects hiring pace and runway.
