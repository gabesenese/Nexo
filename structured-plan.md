# Nexo — Structured Project Plan
### AI Support Agent for Mid-Market Canada/North America

**Working name: Nexo** (subject to trademark clearance — see note below)

> This document is the single source of truth for **project status and sequencing**.
> `PHILOSOPHY.md` holds the durable company thesis (why Nexo exists, what it refuses to
> become). `project-brief.md` holds the durable why/what (market, positioning, architecture).
> `README.md` holds the how (as-built architecture, setup). When those disagree with
> this file on *what comes next*, this file wins; when this file conflicts with
> `PHILOSOPHY.md` on strategic direction, `PHILOSOPHY.md` wins.
>
> **Last reconciled against the code: 2026-08-13.** This file spent a week claiming the active
> milestone was M2 after M2 had merged, which is exactly the failure mode a source-of-truth
> document has. If the date above is stale, verify against git before trusting the status.

---

## 0. The Roadmap at a Glance

We build Nexo in **vertical slices**, one milestone at a time. A milestone is a complete
customer journey (UI → API → DB → visible result), never an isolated layer. It is done only
when a brand-new real customer can complete it end-to-end, with nothing mocked.

Each milestone is named for the customer outcome it unlocks:

| Milestone | Outcome | State |
|---|---|---|
| M1 — Understanding | A visitor understands Nexo. | shipped |
| M2 — Customer Identity | A visitor becomes a customer. | shipped |
| M3 — Resolution | A customer gets the right answer. | shipped |
| M4 — Deployment | A customer puts Nexo in front of their customers. | shipped |
| M5 — Operations | A support team runs Nexo daily. | shipped |
| M6 — Async Indexing | Ingestion runs in the background, not in the request. | shipped |
| M7 — Commercial Validation | The value is worth paying money for. | M7a/M7b shipped, M7c parked |
| **Launch** | **Nexo exists on the internet and a stranger can buy it.** | **active** |

**Launch is deliberately not "M8".** It is a different kind of work from the outcome
milestones, and the M-numbering has already meant different things in different revisions of
this file. Naming it separately stops the collision from recurring.

**We optimize for learning, not for shipping milestones.** Each slice's value is what it lets
us observe about real users, not the feature itself. If a piece of work doesn't move one of
these outcomes forward, we ask why we're building it.

**CTO rule:** Never build an isolated layer. Build complete user journeys.

### Current status (updated 2026-08-13)

**Active: Launch.** M1 through M6 are shipped and merged. M7a (impact statement) and M7b (plan
model and limits) are shipped; M7c (Stripe checkout) is committed on a branch and parked until
we are close to actually selling.

**The honest position: Nexo is a working product that is not yet a business.** It runs only on
a development machine, against a local Ollama model, with no way for anyone to pay. Every
milestone above was verified end to end, and none of that is reachable by a person who is not
us. Launch closes that gap.

The two things this file previously got wrong, corrected here so they do not recur:

1. It reported the active milestone as **M2 — Customer Identity** long after M2 merged
   (PRs #13, #15, #16), and described the onboarding wizard as an unwired prototype and the
   webhook handoff as unbuilt. Both shipped (the handoff in PR #56).
2. Its milestone numbering disagreed with the numbering used everywhere else, so **M6 named
   both billing and the indexing pipeline**. The table above is now the only numbering.

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
2. Escalation-first — human handoff always one click away, full context passed
3. Days-to-launch, not months
4. Canadian data residency and CAD billing (a real wedge for regulated buyers)

Two differentiators were removed here rather than left aspirational. "Full knowledge ingestion
on day one — tickets, Notion, Confluence, Slack, Drive" and "helpdesk-agnostic across five
named vendors" both describe integration breadth that does not exist, and `PHILOSOPHY.md` §7
explicitly refuses to chase it before PMF. What exists is help-center crawling, PDF upload, and
a vendor-neutral signed webhook handoff that covers any helpdesk plus Zapier-class tools.

---

## 3. Milestone Roadmap

Ordered by customer journey. Each milestone is a vertical slice; sub-slices keep each one
thin enough to finish and learn from. GitHub Milestones mirror this list; every issue belongs
to one.

### M1 — Understanding ✅ shipped
Landing page, positioning, pricing, philosophy, lead capture.

### M2 — Customer Identity ✅ shipped
Signup, login, session, workspace ownership, and tenant isolation with cross-tenant tests.
Delivered as M2a account creation, M2b workspace ownership, M2c tenant isolation.

### M3 — Resolution ✅ shipped
The first true product proof: a customer gets the right answer.
- **M3a Knowledge.** Help-center crawl and PDF ingestion, hybrid retrieval, source attribution.
- **M3b AI Resolution.** Question → retrieval → answer → confidence → persisted conversation.
- **M3c Human Resolution.** Low-confidence escalation → agent replies → the customer sees it.

### M4 — Deployment ✅ shipped
- **M4a** widget configuration and branding. **M4b** a deployable bundle served from the API
  with an embed snippet that works on an external site. **M4c** an opaque, rotatable widget key.

### M5 — Operations ✅ shipped
Needs-attention queue, reopen semantics, assignment and ownership, notifications, realtime SSE,
the Inbox operator workflow, knowledge gaps, and the Overview command centre.

### M6 — Async Indexing ✅ shipped
Ingestion moved out of the request: queued → fetching → chunking → embedding → ready or failed,
with live progress, re-index, and crash recovery on boot.

### M7 — Commercial Validation
- **M7a Impact statement** ✅ shipped. Human hours and cost avoided, from customer-supplied
  inputs, with no industry-average defaults.
- **M7b Plan model and limits** ✅ shipped. Sources hard-capped, conversations never capped,
  because the person on the other end is the customer's customer.
- **M7c Stripe checkout.** Committed on a branch, parked. Unparks inside Launch/Money below.

---

## 3a. Launch ← ACTIVE

**Outcome: Nexo exists on the internet and a stranger can sign up, use it, and pay for it.**

No milestone previously owned this. M4 covered deploying the *widget* to a customer's site;
nothing covered deploying *Nexo*. Three tracks:

### Launch/Infra — Nexo exists on the internet
1. **Production hardening.** The session cookie hardcodes `secure: false` and cannot be served
   safely over HTTPS as written. Also: a deliberate CORS split (public widget and chat routes
   reflect any origin, admin and auth routes take an allowlist), rate limiting on auth and chat,
   and security headers.
2. **Transactional email.** There is none today, so a customer who forgets their password is
   locked out permanently and invites are a token you copy by hand.
3. **Cloud AI cutover**, paired with the deploy below rather than done ahead of it. The default
   provider is a local Ollama model, which cannot serve a real customer and cannot realistically
   run inside the deploy target either. Moving to the cloud provider changes the embedding space,
   so it is not a config flip: `dimensions: 768` on the OpenAI embedding call keeps both pgvector
   columns as they are, and `npm run db:reembed` rewrites every vector. **Re-measure the tuned
   constants with `npm run measure:thresholds`, never nudge them:** the coverage and
   gap-similarity thresholds in `knowledge/gaps.ts` were measured against `nomic-embed-text`, and
   `CONFIDENCE_THRESHOLD` is calibrated against `llama3.1:8b`'s self-assessment rather than a
   frontier model's.

   **Sequenced here on purpose (decided 2026-08-13).** It was originally step 1, on the reasoning
   that it gates everything. It does not: development continues perfectly well on Ollama, and
   paying for cloud inference before anything is deployed buys nothing. The tooling and the
   Ollama baseline measurements are already in place, so the cutover is short when it arrives.
4. **Deploy.** Server as a container on Fly.io in `yyz`, Postgres on Neon with pgvector, admin
   and landing as static builds. The server holds long-lived SSE connections and runs ingestion
   in process with crash recovery on boot, so it needs a long-running container rather than
   serverless functions.

### Launch/Money — a stranger can buy it
5. **Unpark M7c.** Stripe Checkout, Stripe Tax, webhooks, and a plan that actually changes on
   payment. Until this lands the trial expires into a dead end.

### Launch/Trust — a team can operate it safely
6. **Agent and Viewer roles** behind one policy, rather than a `roleOf` check copy-pasted into
   each handler.
7. **Audit events** on sensitive actions. `PHILOSOPHY.md` §9 calls the audit trail architecture,
   not an afterthought.
8. **Retention, export, and deletion**, which is where the privacy wedge stops being a claim.

### What Launch deliberately does not include

`PHILOSOPHY.md` §8 names **Resolution Memory** (item 5) and **Evaluation** (item 6) as the moat,
and neither exists: there is no `Resolution` model, and the core object in the schema is still
`Conversation → Message → Escalation`. That is a known gap, not drift.

They come after Launch on purpose. Resolution memory is a learning system, and it has nothing to
learn from until real humans resolve real customer problems inside Nexo. Building it now would
mean building it against seeded demo fixtures, which is the same mistake M5d correctly refused
when it deferred the analytics charts for lack of real data. Ship the ability to acquire a
customer first, then build the memory on top of what they actually resolve.

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

## 4. Technical Architecture (as built)

`README.md` holds the full as-built detail. Summary, with what is real separated from what is not:

- **Ingestion:** connector per source (help-center crawl, PDF), semantic chunking, a per-source
  chunk cap, and background indexing with crash recovery.
- **Vector store:** Postgres with pgvector. Chunk embeddings and escalation question embeddings
  are both `vector(768)`.
- **Retrieval:** hybrid dense plus keyword.
- **LLM:** provider-swappable interface. **Defaults to a local Ollama model**, with a cloud
  provider behind the same interface. The cutover is Launch/Infra step 1.
- **Orchestration:** explicit state machine, so escalation is a code-level guarantee rather than
  a prompt hope.
- **Handoff:** a vendor-neutral signed webhook (HMAC over timestamp and body) with scheduled,
  never-awaited delivery and a delivery audit trail. A named helpdesk adapter drops into the
  same interface once a design partner makes the choice real.
- **Realtime:** server-sent events over an **in-process** bus that carries change signals rather
  than records. Single instance only; more than one instance needs a shared broker.
- **Analytics:** per-conversation logging and embedding-based clustering for knowledge gaps.
  Time-series operational metrics stay deferred until there is real traffic to plot.
- **Hosting:** Fly.io `yyz` plus Neon, decided 2026-08-13. **Not yet deployed.** The earlier
  "AWS ca-central-1 from day one" line described an intention, never a deployment.

---

## 5. Team & Hiring Plan

Timed to the business track, not the build milestones. Keep the team lean until retention with
design partners is proven; the goal is learning, not headcount.

| Stage | Roles needed |
|---|---|
| Early (through M1–M7, where we are) | Founder(s) + 1 full-stack engineer (you may already cover this) |
| Pilot (design partners) | + 1 engineer (retrieval/ML-leaning), + 1 design-partner success/support hire (part-time ok) |
| Launch (live and self-serve) | + 1 growth/marketing hire, + 1 more engineer |
| Scale (US expansion) | + sales hire(s), + customer success team |

---

## 6. Success Metrics

**Primary: the milestone outcomes** (§0). A milestone is a success when a real customer can
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

## 8. Scaffolding prompt (removed)

This section held a prompt for scaffolding the codebase from nothing. The codebase exists, so
the prompt was actively misleading in a document that claims authority over what comes next.
`README.md` holds the as-built architecture and setup.

---

## 9. Immediate Next Actions

**Build (active: Launch):**
1. **Launch/Infra step 1, the cloud AI cutover.** It gates everything else, and the threshold
   re-measurement is far cheaper to do now, against the demo corpus, than after real customer
   traffic depends on those numbers.
2. Then production hardening, then deploy, then email.

**Business track (in parallel, not blocking the build):**
3. Run a proper trademark search (CIPO for Canada, USPTO for US) before committing long-term.
   "Nexo" is already used by a major crypto platform (Nexo.io). Register the domain once
   cleared. **This blocks Launch**, since deploying means choosing a domain.
4. Recruit the 3 to 5 design partners `PHILOSOPHY.md` §14 Phase A calls for. Launch exists to
   make them possible; it does not replace them.
5. Decide bootstrapped vs. fundraising path — affects hiring pace and runway.
