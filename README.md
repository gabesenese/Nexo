# Nexo

AI customer-support agent for Canadian/North American SMB and low-mid-market companies, the Ada
alternative for teams too small for Ada's enterprise floor and too serious for a basic chatbot.
See `project-brief.md` and `structured-plan.md` for the full product/business plan.

This repo is the MVP slice from the plan's Build Sequence step 1: **ingestion (help center + PDF) +
retrieval + a demoable embeddable chat widget**, plus the confidence-based escalation orchestrator
and a mock/generic human-handoff adapter. No real helpdesk is chosen yet; that's a design-partner
decision per Phase 0 of the plan.

## Architecture

```
packages/
  server/    Fastify + TypeScript API: ingestion, hybrid retrieval, LLM orchestration, handoff
  widget/    Embeddable chat widget (React, built as a single script-tag bundle)
  admin/     Admin dashboard (React): sources, conversations, analytics
```

- **DB**: Postgres + pgvector (via Prisma; `Chunk.embedding` is an `Unsupported("vector(1536)")`
  column written via raw SQL, since Prisma doesn't model pgvector natively)
- **Embeddings**: OpenAI `text-embedding-3-small`, behind an `EmbeddingProvider` interface
- **Reasoning LLM**: Anthropic Claude (`claude-sonnet-5`), behind a `ChatProvider` interface,
  swappable without touching call sites
- **Retrieval**: hybrid dense (pgvector cosine) + keyword (Postgres full-text search), merged by
  weighted normalized score
- **Orchestrator**: explicit conversation state machine (`packages/server/src/orchestrator`).
  Every path ends in either an answer or an escalation, never a stuck loop. Confidence is a
  combination of the model's self-assessed confidence and the top retrieval score, so a confident
  answer built on weak context still gets capped and escalated.
- **Handoff**: `HandoffAdapter` interface with a logging `mockHandoffAdapter` default; implement the
  same interface for Zendesk/Freshdesk/Intercom/etc. once a design partner's helpdesk is known.

## Setup

```bash
npm install
docker compose up -d          # Postgres + pgvector
cp .env.example .env          # fill in ANTHROPIC_API_KEY and OPENAI_API_KEY
npm run db:migrate --workspace=server
npm run dev                   # server :4000, admin :5173, widget dev demo :5174
```

Open http://localhost:5173 for the admin dashboard (add a help-center URL or upload a PDF under
**Sources**), then http://localhost:5174 to try the chat widget against that content.

To try the widget the way an actual customer would embed it (a single `<script>` tag):

```bash
npm run build --workspace=@nexo/widget
npx serve packages/widget      # then open the served demo.html
```

## Tests

```bash
npm test --workspace=server
```

Covers the pure logic worth locking down early: chunking token bounds/overlap
(`test/chunking.test.ts`) and the confidence-threshold escalation decision
(`test/confidence.test.ts`).

## Explicitly out of scope in this pass

These are called out in the plan as Phase 2+ or open decisions pending design-partner input, not
forgotten, deliberately deferred:

- Additional connectors: Notion, Confluence, Slack, historical ticket import
- Real helpdesk integrations (Zendesk/Freshdesk/Intercom/Gorgias/HubSpot); `HandoffAdapter` is
  ready for one, none chosen yet
- Flow builder for structured use cases (refunds, order status, password reset, ...)
- Confusion-report clustering (embedding-based clustering of unresolved conversations by topic)
- Cross-encoder/Cohere re-ranking step on top of hybrid retrieval
- Self-serve billing, public pricing page
- BullMQ/queue infra for ingestion sync (currently runs in-process)
- SOC 2 process, Canadian hosting formalization
