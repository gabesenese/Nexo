# Nexo — Reality Check

> Written 2026-10-10, at the founder's request for the unsoftened version. This is an
> assessment, not a verdict: it rests on the repo, the research in `COMPETITORS.md` and
> `MARKET-VALIDATION.md`, and what is *not* known, which is listed at the end. Where a number is a
> hypothetical, it says so. If this file and `PHILOSOPHY.md` disagree, read this one first, then
> decide which of the two is wrong.

## The short version

Nexo is a well-built product with no evidence yet that anyone wants it, in a category where its
current feature set is the *cheap, copyable layer*. None of that is fatal. It means the next
90 days should be spent finding out, not building. The code is ahead of the business by roughly
the length of the project.

## What is actually strong (keep and lean on)

- **The engineering is real.** About 19,000 lines of TypeScript, 25 test files, CI, a
  state machine that makes "every path ends in an answer or an escalation" a code guarantee
  instead of a prompt hope, tenant isolation tests, signed webhooks, Stripe wired in. Most
  first-time founders have a demo; you have a product that could take a stranger's money.
- **It is cheap to run.** About C$5 a month to host, per `DEPLOYMENT.md`. You can survive a long time
  before the product costs real money, which is the best thing a solo founder can have.
- **The positioning is coherent.** "Every answer has an exit" lines up with what customers say they
  want (Gartner: 87% call a route to a human essential) and with a real complaint about the category:
  nobody can check what "resolved" means.
- **You are honest in your own documents.** `PHILOSOPHY.md` §18 admits resolution memory and
  evaluation do not exist. Most founders hide that. Keep the habit.

## The hard truths

### 1. Zero evidence of demand, after 19,000 lines
Nothing is deployed, nothing is live in Stripe, and no buyer has been spoken to. The plan's own
"Phase A: 3-5 real companies" has not started. Every week spent building before that conversation
raises the cost of hearing "no", and the 102 commits since August 9 are weighted heavily to
design passes and billing. The biggest risk to this company is not technical.

### 2. What is built is the commodity layer
Retrieval over a help center, cited answers, a confidence threshold and a handoff button are what
Fin, Zendesk AI, Chatbase and Lyro already do, and the cheap ones cost about $40 a month. Anyone
can add a confidence gate in a sprint. The things `PHILOSOPHY.md` calls the moat (resolution memory,
evaluation, trust tiers, customer context) are the unbuilt ones. Today there is no moat, and the
model underneath is the same one every competitor can rent.

### 3. The unit economics are unknown, and the pricing has a hole
- Nothing in the server records tokens or cost per conversation, so gross margin cannot be
  computed. That is the first thing a SaaS company must know.
- The default model is `claude-sonnet-5`, a top-tier model, used on every answer.
- Conversations are never capped (a design choice, `plans.ts`), and the price is flat. So a
  customer who gets traffic costs you more and pays you the same. Your critique of per-resolution
  pricing, "the bill grows when the product works", has a mirror: your *cost* grows when it works,
  and your revenue does not.

The sensitivity, using a **hypothetical** all-in cost per conversation against Essentials
(C$249 for 1,500 conversations):

| Cost per conversation (hypothetical) | Cost at 1,500 | Gross margin |
| --- | --- | --- |
| C$0.02 | C$30 | 88% |
| C$0.05 | C$75 | 70% |
| C$0.10 | C$150 | 40% |
| C$0.25 | C$375 | negative |

Multi-turn conversations, long retrieved context and a top-tier model push toward the bottom
rows. Measure before launching; do not assume the top row.

### 4. Self-serve SMB at C$249 is a hard distribution problem
Revenue arithmetic, all-Essentials for simplicity: C$1M a year needs about 335 customers
(C$2,988 each per year); the C$5-15M in `project-brief.md` needs roughly 1,700-5,000. With a
**hypothetical** 5% monthly churn you must win about 5% of your customer base *every month* just
to stay level. Small-business buyers churn, and you have no brand, no domain and no audience.
The product is not what limits you; getting 335 strangers to find, trust and keep it is.

### 5. Your target buyer already has an AI toggle
Small SaaS support teams mostly run on Intercom, Zendesk or Freshdesk, and those vendors sell
AI as a switch inside the tool they already use. Nexo sits *beside* the helpdesk with a
generic webhook handoff, not inside it. "Why add another vendor with a webhook?" is the question
every prospect will ask. Price and verifiability are possible answers. Neither is proven.

### 6. Several public claims outrun the evidence
- **"Canadian data residency by default."** Text goes to Anthropic and OpenAI for answers and
  embeddings. `DEPLOYMENT.md` itself notes Neon has no Canadian region while `structured-plan.md`
  still names Neon. Fix the wording or the architecture before a regulated buyer asks.
- **66% automatic resolution.** Measured on a corpus you invented. Independent figures for
  the category are 38-50%. The head-to-head test in `eval/head-to-head/` exists to settle this.
- **"Days to launch."** Not yet demonstrated by a stranger.
- **The name.** `structured-plan.md` already flags a clash with Nexo.io and says it blocks launch.
  There is no domain. Do this before spending on branding.

### 7. The vision is ahead of the company
`PHILOSOPHY.md` is 380 lines of strategy for a company with no customers: resolution
intelligence, a 2028 trajectory, "the intelligence layer between businesses and their customers".
Vision documents feel like progress and are not. Do not write another one until a customer has
paid. The rule you wrote yourself in §14 is the right one: prove the wedge with 3-5 real companies.

## What to cut or freeze now

| Freeze | Why |
| --- | --- |
| New design passes on landing and admin | Both are good enough; no buyer has seen either. |
| Resolution memory build | Needs real resolutions to learn from; `PHILOSOPHY.md` §18 already agrees. |
| More vision and strategy documents | See above. |
| Overview and analytics depth | You have no traffic to analyze. |
| New integrations "to be ready" | Pick one only after a design partner names it. |
| Any public claim you cannot prove | Residency and resolution rate first. |

## What a SaaS company measures, and what is missing

| Metric | Why it matters | Status in Nexo |
| --- | --- | --- |
| Cost per conversation, gross margin | Whether the pricing works | **Not instrumented** |
| Time to first correct answer (activation) | The "days to launch" claim | Not measured |
| Resolution and handoff rate on real data | The product's core claim | Demo data only |
| Trial to paid conversion | Whether the page sells | No traffic yet |
| Monthly churn and net revenue retention | Whether the business is a leaky bucket | No customers |
| CAC and payback | Whether growth can be paid for | No spend yet |

## The foundation: 90 days, in order

**Weeks 1-2: remove the blockers that cost nothing.**
1. Decide the name; run the CIPO/USPTO search; register a domain.
2. Instrument cost: log input and output tokens per turn, compute cost per conversation, show it
   internally. Choose a model by cost *and* quality (the head-to-head kit can test both).
3. Fix the residency claim to what is true.
4. Decide a fair-use rule for conversations (a soft ceiling plus overage, or a higher tier). Not
   unlimited at a flat price.

**Weeks 2-6: find out whether anyone wants it.** Run the plan in `MARKET-VALIDATION.md`: 20
conversations with support leads at SaaS companies of 2-20 support staff, and run the Plausible
head-to-head for real. Deploy Phase 1 (about C$5 a month) only when a prospect says yes, as
`DEPLOYMENT.md` already plans.

**Weeks 6-12: three paid design partners, or stop and rethink.** Offer a 30-day paid pilot.
Pick the single helpdesk adapter your partners actually use. Measure resolution on *their* data
and publish the real number to yourself, whatever it is.

**Day 90: choose with evidence.** Kill criteria: fewer than 5 of 20 conversations leading to a
paid pilot means change the buyer or the promise, not the features.

## Pivots worth testing in the interviews (hypotheses, not recommendations)

1. **The verification layer, not the bot.** The broken thing in this category is that nobody can
   audit "resolved". Companies already running Fin or Zendesk AI have the problem *and* a budget,
   and do not have to rip anything out. A product that audits their AI's answers against their docs
   and flags wrong ones competes with nobody's core product. Ask interviewees whether they would
   pay for this before assuming it is a worse business than the bot.
2. **A regulated niche, with real residency.** Fintech and health teams in Canada are the buyers
   for whom a true Canadian-processing answer is worth paying for. This needs a Canadian-hosted
   model option, which should be researched before it is promised.
3. **Service-led start.** Do the first five customers by hand (set up their docs, tune thresholds
   yourself) at a setup fee. You learn what they need and get paid while learning.

## What I do not know

- Runway. How many months can you work on this without income? It sets every deadline above.
- Whether anyone outside this project has seen the product.
- The actual cost per conversation, the real resolution rate, or how Fin, Chatbase and Tidio
  behave on the same questions. All are measurable in the next two weeks.
- Whether your target segment would rather buy the bot or the verification. Only buyers can
  answer that.
