# Deployment readiness

**Status:** nothing is deployed. Audited 2026-09-07 against `64e1f0b`, and the
code changes it asked for were made on 2026-09-12.

The plan is staged deliberately, because spend follows demand rather than
leading it:

| Phase | What goes live | Cost | Trigger |
| --- | --- | --- | --- |
| 0 | The landing page alone, on free static hosting. Signup closed, the page collects interest | nothing | now |
| 1 | The platform: this server, the console it serves, and a database | free tier, or about C$5 a month to remove the cold starts | a real prospect says yes |
| 2 | Stripe live mode, tax registration, the legal pages | accountant's time | someone is ready to pay |

Phase 1 is **code-ready**: the production image was built and driven end to end
on 2026-09-12, including a real login, and every item in section 3 is fixed. What
remains for it is an account with a card on file, not engineering.

---

## 1. The cost floor

Deploying is not free, and no amount of engineering changes that.

The server holds long-lived SSE connections, runs a realtime bus in process, and
runs `recoverInterruptedSources` at boot. Every free tier that would otherwise
fit scales to zero, which breaks all three. Fly's free trial is two machine
hours or seven days, whichever comes first, and trial machines stop after five
minutes of runtime, so it demonstrates an app rather than hosts one.

The realistic floor is a `shared-cpu-1x` machine with 1GB of memory, which is
about five US dollars a month, plus a database.

Databases worth knowing about, given the Canadian residency argument:

| Option | Canadian region | Free tier | Notes |
| --- | --- | --- | --- |
| Fly Managed Postgres | yes, `yyz` | no | Same region as the app, private networking, `pgvector` supported |
| Supabase | yes, `ca-central-1` | yes | Free tier pauses on inactivity; `pgvector` built in |
| Neon | **no** | yes | Ten regions, none Canadian |

**Decision, 2026-09-12: Supabase free in `ca-central-1`**, because the budget
for phase 1 is zero. It keeps the data in Canada, includes pgvector, and its
pause-on-inactivity only bites after about a week with no traffic, which will
not happen while a pilot is running. Fly Managed Postgres in `yyz` is the
upgrade to take the moment five dollars a month is worth removing that risk.

Neon was the original choice and is the wrong one. It publishes ten regions and
none of them are in Canada, so the app would run in Toronto while every customer
record sat in Virginia. That is the specific claim the `yyz` choice, the CAD
pricing, and the Law 25 argument were built on.

`flyctl platform regions` confirms Toronto is available for Managed Postgres:

```
 NAME                         │ CODE │ MPG
 Toronto, Canada              │ yyz  │ ✓
```

---

## 2. The domain gate, and how to remove it

`routes/auth.ts:76` sets the session cookie with `sameSite: "lax"`, and the
comment above it says so deliberately: the console and the API must share a
registrable domain. Both `fly.dev` and `vercel.app` are on the Public Suffix
List, so `nexo-api.fly.dev` and `nexo.vercel.app` are permanently cross-site.
Login would appear to succeed and every request after it would return 401.

Two ways out.

**Buy a domain.** `api.example.ca` and `app.example.ca` share a site, so
`SameSite=lax` works with no code change. `nexo.*` is taken across com, ca, ai,
io, app and dev. `trynexo.ca`, `nexosupport.ca` and `nexohq.ca` were available
when this was written. A `.ca` requires meeting CIRA's Canadian presence
requirement, which suits the positioning.

**Serve the console from the API origin.** The Fastify server already serves
`/widget.js` from the compiled output (`app.ts:100-105`); serving the built admin
bundle the same way makes console and API the same origin. That removes the
cross-site problem, the CORS configuration, and the need for an admin SPA
rewrite, and it works on a bare `*.fly.dev` hostname with no domain at all. The
landing site is public marketing with no auth, so it stays a separate static
deploy. A custom domain remains possible later; it just stops being a
prerequisite.

The second option is cheaper and strictly simpler. It is the recommendation.

---

## 3. Code changes needed before a first deploy

**All of these are done** (2026-09-12), along with two that the audit did not
find because only running the image surfaces them:

- **The API's own CSP blocked the console it now serves.** `default-src 'none'`
  is right for a JSON API and refuses the console's bundle, stylesheet and
  fonts. The console's responses get their own policy, and the hash for the
  theme bootstrap is computed from the shipped `index.html` at boot rather than
  written down, so editing it cannot silently blank the console.
- **That hash has to be taken over LF.** The HTML parser normalises newlines
  before the browser hashes the script, so a file written with CRLF hashes to
  something no browser ever computes.

| Issue | Where | Effect |
| --- | --- | --- |
| No `trustProxy` | `app.ts:60` | Behind Fly's proxy `req.ip` is the proxy, so all three rate-limit buckets collapse into one global counter and audit rows record the wrong address |
| `CORS_ORIGIN` has no production guard | `config/env.ts` | Unlike `APP_URL` and `SMTP_URL` it silently keeps its localhost default, so the server boots healthy while the console is blocked on every request. Moot if the console is served same-origin |
| No SPA rewrite config | neither frontend | Deep links 404 on a static host: the Stripe checkout return, password-reset links, invite links |
| `.dockerignore` misses `**/.env` | `.dockerignore:8` | The `.env` pattern only matches the context root, so `packages/server/.env`, holding live Anthropic, OpenAI and Stripe keys plus `JWT_SECRET`, is uploaded to the builder and lands in a builder layer. `node_modules` on the line above already uses the `**/` form |
| `EMBEDDING_DIMENSIONS` comments are wrong | `config/env.ts:186-190`, `.env:12` | Both instruct setting it to 1536 for the cloud provider. Following that instruction makes every embedding write fail. See section 5 |
| `pino-pretty` is unconditional | `app.ts:61` | A production log drain receives ANSI-coloured text rather than JSON |
| Nothing pins the app to one machine | `fly.toml` | The in-process realtime bus makes single-machine operation a correctness requirement, currently enforced only by a comment |
| Checkout returns to the wrong tab | billing | `/settings?billing=done` opens Workspace, not Billing, so a customer who just paid does not land on the card showing what they bought |

Real, but not blocking a first deploy:

- No `ivfflat` or `hnsw` index on `Chunk.embedding`, so every retrieval is a
  sequential scan. Irrelevant at zero customers, a problem with real data.
- The Dockerfile pins `node:20-slim`, and Node 20 left maintenance on
  2026-04-30.
- Graceful shutdown allows 10 seconds; Fly's default `kill_timeout` is 5.

---

## 4. Owner actions, none of them code

- A Fly account with a payment method. The CLI is installed and authenticated as
  `gabrielsenese6@gmail.com`, personal org.
- Stripe live activation: `charges_enabled` and `payouts_enabled` are both
  false. Live keys, the three products and prices recreated in live mode, and a
  live webhook endpoint pointing at the deployed URL.
- Stripe tax settings: a head office address, then per-province registrations.
  `automatic_tax` is enabled in code and Stripe rejects the session without a
  valid address. The product tax code is a decision for a tax advisor.
- An SMTP provider. `EMAIL_TRANSPORT=smtp` and `SMTP_URL` are mandatory in
  production, and `EMAIL_FROM` defaults to an unroutable address that nothing
  validates.
- Terms of service, privacy policy and a refund policy, which both Stripe
  activation and charging a subscription assume exist.

Note that the Neon and Vercel CLIs on this machine are authenticated as
`contato@rhact.com.br` under the RHACT organisation, which is a different
business. Nexo's production resources should not be created there.

---

## 5. Claims that were investigated and are false

Three findings from the audit did not survive checking. Recorded so they are not
rediscovered and chased later.

**Password reset tokens are not written to production logs.** Only
`logEmailProvider` prints message bodies (`email/provider.ts:56`), and
`config/env.ts:150` refuses to boot a production process unless
`EMAIL_TRANSPORT=smtp`, which selects the SMTP provider instead. The residue is
minor: `provider.ts:76` logs the recipient address when a send fails.

**The 768 versus 1536 embedding mismatch does not exist.**
`ingestion/embeddings.ts:58` passes `dimensions: EMBEDDING_DIMENSIONS` to OpenAI
explicitly, and the comment above it explains why: the `text-embedding-3` family
keeps its useful properties when shortened, so requesting 768 makes the cloud
cutover a re-embed rather than a re-embed plus a column migration on every chunk
and escalation. The columns stay `vector(768)`. The bug is the two comments in
section 3 that say otherwise.

**`pgvector` is created by the migrations.**
`20260805045045_init/migration.sql:5` runs `CREATE EXTENSION IF NOT EXISTS
"vector"`, alongside `pg_trgm`, so `migrate deploy` against a fresh database
works provided the role may create extensions.

---

## 6. Order of work

Steps 1 to 3 are done. What is left is step 4, which needs an account rather
than a change.

1. ~~Serve the console from the API origin, which removes the domain gate.~~
   Done. The image builds the console with `VITE_API_URL=same-origin`, so every
   call it makes is relative and one image runs on any hostname. The server
   serves the bundle and falls back to the shell for deep links, while API
   misses stay JSON.
2. ~~The code changes in section 3.~~ Done.
3. ~~Build the production image and drive a real login through it.~~ Done on
   2026-09-12: eleven checks against `nexo-server:readiness` running with
   `NODE_ENV=production` against a local pgvector container. Health, the console
   shell, hashed assets, a deep link, an API miss staying JSON, `/widget.js`, a
   real login, the session cookie arriving `Secure` and `SameSite=Lax`, the
   billing deep link, an absolute embed snippet, and no console errors.
4. Provision, deploy, re-embed on the live database, then re-measure the
   thresholds. Never nudge the measured constants.

### Phase 0: the landing page, now, for nothing

The page holds no customer data, sets no cookies and talks to no database, so it
can go on free static hosting today. Cloudflare Pages is the recommendation: the
free tier needs an account but no card, and it gives a custom domain later
without changing anything here.

```bash
# One of these two is required, or the build refuses: the request form has to
# have somewhere to send what it collects.
VITE_CONTACT_EMAIL=hello@yourdomain.ca   npm run build --workspace=@nexo/landing

npx wrangler pages deploy packages/landing/dist --project-name nexo-landing
```

`VITE_SIGNUP_OPEN` stays unset until phase 1 is live. With it unset every start
button opens the interest form, no sign-in link is rendered, and nothing on the
page promises a trial that cannot be started yet. The day the console is
deployed, the same build with `VITE_SIGNUP_OPEN=true`, `VITE_APP_URL` and
`VITE_API_URL` turns the page back into a signup funnel.

### The deploy itself, when phase 1 arrives

```bash
# The image carries the console. Build it once, run it anywhere.
docker build -t nexo-server .

# Required at runtime: DATABASE_URL, JWT_SECRET, APP_URL (https), SMTP_URL,
# ANTHROPIC_API_KEY, OPENAI_API_KEY, and the Stripe keys once phase 2 starts.
# CORS_ORIGIN is not needed while the console ships in the image.
```

`APP_URL` must be the deployed origin and must be https, or the server refuses
to boot: the session cookie cannot be marked `Secure` otherwise.
