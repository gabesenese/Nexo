# Nexo

AI customer-support agent for Canadian/North American SMB and low-mid-market companies, the Ada
alternative for teams too small for Ada's enterprise floor and too serious for a basic chatbot.
See `PHILOSOPHY.md` for the company thesis, and `project-brief.md` and `structured-plan.md` for
the full product/business plan.

> **CTO rule: never build an isolated layer. Build complete user journeys.**
> We ship Nexo in vertical slices, one milestone at a time. A milestone is done only when a
> brand-new real customer can complete the whole journey end-to-end (UI → API → DB → result),
> nothing mocked. `structured-plan.md` is the single roadmap; GitHub Milestones mirror it.

**Status: M2 — Customer Identity (active).** M1 (Marketing) is done. The ingestion → retrieval →
local-LLM answer → escalation → webhook-handoff core is proven as backend, but its customer-facing
slices (M3–M5) are not complete yet. See `structured-plan.md` §0 for the full status map.

## Architecture

```
packages/
  server/    Fastify + TypeScript API: ingestion, hybrid retrieval, LLM orchestration, handoff
  widget/    Embeddable chat widget (React, built as a single script-tag bundle)
  admin/     Admin dashboard (React): sources, conversations, analytics
  landing/   Public marketing site (static): product pitch + pricing
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
docker compose up -d                    # Postgres + pgvector
cp .env.example packages/server/.env    # fill in ANTHROPIC_API_KEY and OPENAI_API_KEY
npm run db:migrate --workspace=@nexo/server
npm run dev                             # server :4000, admin :5173, widget dev demo :5174, landing :5175
```

`.env` must live in `packages/server/`, not the repo root: both the Prisma CLI and the server's
`dotenv/config` loader resolve `.env` relative to the workspace's working directory, which is
`packages/server` when npm runs a workspace script.

Open http://localhost:5175 for the marketing landing page, http://localhost:5173 for the admin
dashboard (add a help-center URL or upload a PDF under **Knowledge**), then http://localhost:5174
to try the chat widget against that content.

The landing page reads these at **build time**, in `packages/landing/.env`. Vite inlines them, so
whatever is set when `vite build` runs is what ships:

| Variable | Dev default | Required in production | Purpose |
| --- | --- | --- | --- |
| `VITE_APP_URL` | `http://localhost:5173` | yes | Admin app, behind every sign-in and onboarding CTA. |
| `VITE_WIDGET_ORG_KEY` | unset | no | Widget key of the workspace the landing page should chat with. Without it, no widget is loaded at all. |
| `VITE_WIDGET_SCRIPT_URL` | `http://localhost:5174/dist/widget.js` | only with a widget key | Where `widget.js` is served from. |
| `VITE_API_URL` | `http://localhost:4000` | yes | API the "Talk to us" lead form posts to, and the widget calls. |

A production build (`npm run build --workspace=@nexo/landing`) **fails** if a required variable is
missing or still points at localhost. Without that guard the build would succeed and every call to
action on the page would silently link to the visitor's own machine.

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

## Deploying

The API server, its SSE streams and `/widget.js` all ship as one container
(`Dockerfile`), because `app.ts` resolves the widget bundle relative to the
compiled server. `fly.toml` targets Fly.io in `yyz`, with Postgres on a managed
provider that has `pgvector`.

```bash
docker build -t nexo-server .
fly deploy
```

Migrations run as the release step, so a failed migration fails the deploy
instead of releasing a version that does not match its schema.

**Two constraints that are easy to get wrong and expensive to discover late.**

*The console and the API must share a registrable domain.* The session cookie is
`SameSite=lax`, so `app.example.com` and `api.example.com` work, while a console
on one provider's domain and an API on another's would silently stop sending the
cookie. The fix that suggests itself, `SameSite=None`, reopens what the CORS
split in `http/security.ts` closes.

*One machine, for now.* The realtime bus is in memory and ingestion runs in
process, so two machines would mean a widget and its operator's dashboard never
seeing each other's events. Scaling past one needs a shared broker first, and
`auto_stop_machines` stays off because a stopped machine drops both a crawl in
progress and every open event stream.

Required secrets beyond `.env.example`: `DATABASE_URL`, `JWT_SECRET`, `APP_URL`
(https, or the server refuses to boot), `CORS_ORIGIN`, `SMTP_URL`, and the AI
provider keys.

The browser bundles need their own, at build time rather than at runtime, because
Vite inlines them: the landing build needs `VITE_APP_URL` and `VITE_API_URL`, and
the admin build needs `VITE_API_URL`. Both refuse to build for production without
them, rather than shipping a bundle that points at localhost and fails silently.
CI builds both and asserts no `localhost` survives into either.

## Explicitly out of scope in this pass

These land in later milestones (see `structured-plan.md` §3) or are open decisions pending
design-partner input, not forgotten, deliberately deferred:

- Additional connectors: Notion, Confluence, Slack, historical ticket import
- Real helpdesk integrations (Zendesk/Freshdesk/Intercom/Gorgias/HubSpot); `HandoffAdapter` is
  ready for one, none chosen yet
- Flow builder for structured use cases (refunds, order status, password reset, ...)
- Confusion-report clustering (embedding-based clustering of unresolved conversations by topic)
- Cross-encoder/Cohere re-ranking step on top of hybrid retrieval
- Self-serve billing, public pricing page
- BullMQ/queue infra for ingestion sync (currently runs in-process)
- SOC 2 process, Canadian hosting formalization
