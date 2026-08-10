# Nexo — Company Philosophy

> This document is the durable **why we exist and what we refuse to become**. `project-brief.md`
> holds the product/market plan; `structured-plan.md` holds sequencing. This file holds the
> thesis those two serve. When a roadmap decision conflicts with this document, this document wins.

---

## North Star

**Nexo turns customer problems into verified resolutions, combining AI, human expertise, and
business context into one continuous resolution system.**

Nexo is not:
- An AI chatbot.
- AI customer support.
- An AI agent builder.
- A helpdesk with AI bolted on.

Those positions are commoditized and shrinking. Zendesk and Intercom already ship AI agents that
act across messaging, email, and web, integrate with external helpdesks, and charge on outcomes.
Intercom alone reportedly reached ~$400M ARR before its acquisition by Salesforce (~$3.6B, per
WSJ). Competing on "better chatbot" is a race against incumbents who will copy anything that
matters. We don't run that race.

---

## 1. The Core Object Is a Resolution, Not a Conversation

```
CUSTOMER PROBLEM → UNDERSTAND → INVESTIGATE → AI RESOLUTION or HUMAN RESOLUTION
                                                       ↓
                                                    VERIFY → OUTCOME → LEARNING
```

The conversation is just the interface. The unit Nexo is built around, measured on, and sold on
is the resolution: a customer problem that was understood, resolved, and verified.

---

## 2. The Moat Is Business Context and Resolution History, Not the Model

Foundation models get cheaper and better every quarter. GPT/Claude/Gemini are not Nexo's moat —
they're interchangeable inputs. The defensible layer is everything wrapped around the model:

- **Business context**: the company's rules, policies, products, customers, prior interactions,
  workflows, permissions, and internal knowledge.
- **Resolution history**: which resolutions actually worked for which problems, drawn from real
  outcomes rather than a well-tuned prompt.

This matches what production research (e.g. Nubank's public writeups on support AI) shows:
outcomes depend on context engineering, evaluation, human-in-the-loop iteration, and online
measurement — not the underlying LLM.

**Nexo learns from humans.** When AI can't resolve a problem, it escalates. When a human resolves
it, Nexo records problem → investigation → resolution → evidence. The next occurrence of that
problem, Nexo already knows the pattern. At scale this becomes a standing signal to the business:

```
Nexo learned a new resolution pattern
Duplicate billing charge — 18 cases, 17 successful human resolutions
Suggested AI automation: Yes
```

The business approves automation; Nexo gets better through its own customers' employees, not
just through model upgrades.

---

## 3. Human-in-the-Loop Is a Feature, Not a Failure

We reject the implicit pitch of "our AI doesn't need humans" — it reads as untrustworthy and it's
strategically wrong for Nexo. Our message:

**AI handles what it knows. Humans handle what requires judgment. Nexo connects the two.**

The AI's only two valid states are "I can resolve this" and "I need help." Never "I'll make
something up." This is also where the market is heading — Gartner's 2026 research frames AI
adoption in terms of evolving human-agent responsibility split, not human elimination.

---

## 4. Trust Is a Product Feature

Every AI answer carries an explicit confidence structure, configurable by the business:

- 🟢 **Green — high confidence**: authoritative source found, customer context verified, action
  permitted → AI resolves.
- 🟡 **Yellow — moderate confidence**: relevant information exists but ambiguity remains → AI
  answers carefully or asks a clarifying question.
- 🔴 **Red — low confidence / sensitive**: insufficient evidence, policy conflict, financial/legal
  consequence, or unusual request → human escalation.

The product should let a business say "I know why Nexo made this decision," never "the AI seemed
confident."

---

## 5. Sell ROI, Not AI

Don't sell "$99/month AI chatbot." Sell measurable business impact:

```
This month: 8,421 requests — 5,102 resolved automatically, 1,842 with human
assistance, 1,477 escalated.

Business impact: 61% automated resolution, 34% reduction in human workload,
2,814 employee hours avoided, $18,420 estimated support cost avoided.
```

That's what a CFO buys. This mirrors where Zendesk and Intercom are already pushing
(resolution/outcome as the economic unit) — but we should not copy their pricing blindly.
Usage-based per-resolution billing is already drawing customer complaints about unpredictability
at scale. A more predictable tiered model (base resolutions + agents + overage) is the current
hypothesis.

### Pricing basis (decided 2026-08-09)

This section previously held pricing open until customer interviews. That is superseded:
pricing is set from **competitive benchmarking**, which is market evidence rather than
invention from first principles. Interviews remain worth running, but they are no longer a
gate on shipping a price.

The market splits into outcome-priced products and flat-fee tooling. Intercom Fin publishes
$0.99 per resolution, Zendesk bills roughly $1.50 to $2.00 per automated resolution on top of
per-agent Suite fees, and Ada adds a platform fee to a similar per-resolution rate. Freshdesk
Freddy is the cheapest credible product comparable at roughly $0.10 per chat session. Botpress
and Voiceflow look cheap at $60 to $495 because the customer builds the agent themselves.

Normalised to our tiers at a 50% resolution rate, a Canadian buyer pays about C$1,035/month to
Intercom at 1,500 conversations and about C$34,500 at 50,000. Our original C$149 to C$1,500
sat below every product competitor including the cheapest, and only at parity with self-build
toolkits, so it was raised to **C$249 / C$899 / C$2,499**. That still undercuts Intercom by
roughly four to fourteen times while pricing above the toolkits, which is where a finished
product belongs.

**We stay flat-rate, not per-resolution.** Ada moved away from outcome pricing because buyers
wanted predictable bills, and per-resolution billing charges the customer more precisely when
the product works better. Our demo corpus resolves 66% automatically; at that rate an
incumbent's bill goes up while ours does not. "Your bill does not grow when the AI gets
better" is a real difference, not a slogan.

---

## 6. ICP: Narrow, Not "Businesses" or "SMBs"

Both of those are meaningless targeting. The filter:

1. High customer volume
2. Repetitive questions
3. Answers require business context
4. Human support is expensive
5. Documentation already exists
6. Customers expect fast responses
7. Financial benefit is measurable

**First wedge: SaaS companies** (500–20,000 customers, 1,000+ monthly support interactions,
2–20 support employees, existing helpdesk, repetitive support questions, CRM/customer data,
willingness to experiment with AI). SaaS support is digital-problem → digital-answer →
digital-system: plan checks, account checks, billing checks, and authorized actions are all
addressable without leaving software. It's the best available environment for agentic support.

**This wedge is not a permanent ceiling.** The architecture stays horizontal; the go-to-market
stays vertical:

```
Nexo platform (generic resolution infrastructure)
  → Nexo SaaS (first vertical)
  → Nexo Commerce (e-commerce)
  → Nexo Services (professional services)
  → ...
```

---

## 7. What We Will Not Build (near-term)

- Generic chatbot builder — crowded.
- "ChatGPT for customer support" positioning — weak.
- Dozens of AI personas — marketing fluff.
- Excessive customization — implementation hell.
- Broad integration coverage before PMF — we die from integration complexity if we chase every
  "does it integrate with X." Phase 1 is 3–5 integrations chosen deliberately (SaaS candidates:
  Stripe, HubSpot, Zendesk, Intercom, Slack), built on an excellent integration architecture, not
  a long tail.
- A massive analytics suite before there are customers to analyze.
- Voice AI immediately — different operational problem, later phase.
- Full enterprise compliance (SOC 2 Type II, HIPAA, etc.) immediately — document strong practices
  early, pursue certs once enterprise demand justifies the cost.
- Autonomous AI acting everywhere without guardrails.
- "Replace your support team" positioning — bad trust signal, and false.

## 8. What We Will Build (core, in order)

1. **Business Knowledge** — Nexo understands the company.
2. **Customer Context** — Nexo understands the customer.
3. **Resolution Engine** — Nexo decides how to resolve.
4. **Human Escalation** — Nexo knows when it needs help.
5. **Resolution Memory** — Nexo learns from successful human resolutions.
6. **Evaluation** — Nexo constantly measures whether it is actually correct.
7. **Deployment** — website first, email/other channels later.
8. **Command Center** — the business sees what's happening.

Before building anything outside this list, ask: *does this increase resolution rate, resolution
quality, human efficiency, customer satisfaction, deployment speed, retention, or revenue?* If
not, it doesn't get built yet. This is Nexo's proof-before-expansion rule.

---

## 9. Liability Is the Real Enterprise Problem

"Yes, you're eligible for a refund" when the policy says no. "Your payment has been refunded"
when it wasn't. "Your account has been cancelled" when it wasn't. These aren't funny chatbot
mistakes — they're business and legal exposure. This means the following are architecture, not
afterthoughts:

- **Permissions** — what Nexo is allowed to do.
- **Evidence** — why Nexo decided what it decided.
- **Guardrails** — what Nexo is not allowed to do.
- **Audit trail** — who or what performed each action.
- **Human approval** — when approval is required before acting.

---

## 10. Competitive Positioning

| | Old world (human support) | Incomplete new world (AI chatbot) | Nexo |
|---|---|---|---|
| | Expensive, slow, inconsistent, doesn't scale, knowledge trapped in employees | Fast, cheap, but unreliable, limited context, can't handle exceptions, bad handoffs | AI handles predictable work, humans handle judgment, Nexo connects the two, every resolution improves the system |

There's also a real market opening, not a saturated one: only ~16% of SMBs reportedly use AI
agents today (2026), with complexity and lack of tailored tooling cited as the barrier. The
market isn't "everyone already has this" — it's "everyone is being told they need this and
doesn't know how to operationalize it." Nexo's job is to make Connect → Teach → Deploy →
Monitor → Improve ridiculously simple.

---

## 11. The Command Center Is a Management System, Not a Chart Wall

The admin dashboard should answer "what does my business need to know right now," not "here are
47 charts." Target shape:

```
Today: 2,381 requests, 1,732 resolved, 73% automation, 94% satisfaction

Attention required: 🔴 18 unresolved · 🟡 42 low-confidence interactions · 🔵 7 emerging issues

Nexo learned: 3 new recurring customer problems
Business opportunities: 14 customers asked about upgrading
System health: all integrations operational
```

## 12. Resolution Intelligence Is the Long-Term Moat

Every business today throws its richest signal away into Zendesk, email, Slack, CRMs,
spreadsheets, and people's memories: what customers want, why they struggle, what the company
does, and what actually resolves the problem. Nexo's long-term product is turning every
interaction into structured intelligence:

```
Customers are struggling with: Billing 18% · Onboarding 14% · Integrations 11%
Emerging issue: OAuth errors started 3 hours ago
Knowledge gap: 31% of this week's escalations involved info missing from the knowledge base
Automation opportunity: 217 human-resolved conversations could likely be automated
Product problem: 9.2% of users asking about feature X subsequently abandon onboarding
```

That's not customer support software anymore — it's customer intelligence.

---

## 13. The Flywheel

```
More customers → more interactions → more resolution data → better Nexo →
higher resolution rate → lower support cost → more ROI → more customers
```

The moat is resolution data + business context + workflow system + evaluation infrastructure,
compounding — not the LLM underneath it.

---

## 14. Go-to-Market Phases

- **Phase A — Prove the wedge.** 3–5 real companies, not 500. Learn what they actually ask, where
  AI fails, where humans intervene, which integrations matter, what they'll pay, what ROI looks
  like.
- **Phase B — Make one use case incredible.** One vertical/use case that produces a genuine "Nexo
  actually handles this" reaction, not a 40-feature product.
- **Phase C — Prove economics.** Support cost before Nexo vs. after Nexo, demonstrated
  consistently enough to say "Nexo costs you $X and saves you $Y."
- **Phase D — Productize deployment.** Self-serve onboarding, once we know what customers
  actually need.
- **Phase E — Expand.** More verticals, channels, integrations, analytics, enterprise, larger
  contracts — only after A–D are proven.

---

## 15. Company Thesis

**Nexo exists to make every customer problem resolvable.** It understands the customer,
understands the business, determines the appropriate resolution, executes when authorized,
brings humans in when necessary, and learns from every outcome. We don't optimize for
conversations. We optimize for resolutions.

Trajectory:

```
2026: AI-powered customer resolution
  → 2027: AI + human customer operations
    → 2028: customer-resolution infrastructure
      → long term: the intelligence layer between businesses and their customers
```

The end state: a customer doesn't decide "should I talk to Nexo or a human." They say "I have a
problem," and Nexo figures out the best way to solve it.

---

## 16. The Ruthless Test

Nexo has 12–18 months to prove this thesis commercially — not to become huge, but to prove:
someone outside our circle needs it, will pay for it, gets measurable operational value from it,
keeps using it, and expands usage. Consistent yes → pour fuel on it. "It's cool but..." → we
pivot the product around what customers actually value instead of adding features.

This reframes the milestone roadmap in `structured-plan.md` as a **commercial validation
roadmap**, not a feature list:

- M3 proved Nexo can create the AI → human → customer resolution loop.
- **M4 must prove a real company will deploy it.**
- **M5 must prove that company gets measurable operational value from it.**
- **M6 must prove that value is worth paying meaningful money for.**

If those three hold, this stops being an idea and starts being a company.

## 17. Next Strategic Exercise

Before adding another pile of features: design the ideal first Nexo customer, identify 3–5
specific industries/ICP variants, map their current support workflow and economics, and determine
exactly what Nexo needs to do on day one to make them say yes.
