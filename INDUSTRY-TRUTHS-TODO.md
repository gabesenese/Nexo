# Industry Hard Truths → To-Do Lists

> Written 2026-10-10. These are truths about the **AI customer-support industry**, not about
> Nexo specifically (`REALITY-CHECK.md` covers the project). Each truth has evidence, what it means
> for a small new entrant, and a to-do list. Truths run from most to least urgent, and so do the
> tasks inside each. Urgency: **P0** this week, **P1** next 2-4 weeks, **P2** within 90 days,
> **P3** watch and revisit.
>
> **Evidence quality.** Most sources are vendor blogs and secondary write-ups that repeat each
> other. Primary surveys (Gartner, Verdantix) are marked. Re-check any figure before putting it in
> front of a customer or investor.

## Do-first list (all P0, in order)

- [x] 1. Add cost-per-conversation tracking (tokens in and out, per turn, per workspace). *Done 2026-10-10: `AiUsage` table and `npm run cost:report`. Needs a real run to produce numbers.*
- [x] 2. Write down what "resolved" means for Nexo, in one paragraph, and use only that definition. *Done: `RESOLUTION.md`, used by the Impact page and the website.*
- [x] 3. Take the 66% resolution figure off every public page until it is measured on real data. *Done: landing page and `PHILOSOPHY.md`.*
- [ ] 4. Decide the name and run the trademark search; register a domain.
- [ ] 5. Book the first 5 buyer conversations, and ask each what AI their helpdesk already offers.

---

## Truth 1 — P0: The incumbents bundle AI and keep cutting its price

**Evidence.** Fin set the reference price at $0.99 per resolution. HubSpot reportedly cut its agent
to $0.50 in April 2026; Zendesk lists $1.50-$2.00. Helpdesks bundle AI into their suites and
offer free tiers (HubSpot Service Hub free for 2 users, Freshdesk free for 10 agents). Pricing is
moving toward labour-style per-outcome billing. ([Twig market map](https://www.twig.so/blog/customer-service-ai-market-map-2026), [Drag: state of AI support pricing](https://www.dragapp.com/blog/state-of-ai-support-pricing/), [Fin pricing comparison](https://fin.ai/learn/ai-customer-service-agent-pricing-comparison); vendor sources.)

**What it means.** A standalone bot at C$249 a month is competing with "turn on the AI in the helpdesk
you already pay for." Price alone is a weak reason to switch because the price is falling toward
zero. The reason has to be something the bundled AI does not give.

- [ ] **P0** In every buyer conversation, ask: "What AI does your helpdesk already offer, have you
      turned it on, and what stopped you?" Done when 10 answers are logged.
- [ ] **P0** Build a one-page price comparison for a 1,500, 8,000 and 50,000 conversation month
      against Fin ($0.99), HubSpot ($0.50) and Zendesk ($1.50-2.00), using your real resolution rate.
      Done when it replaces the single-competitor table in `packages/landing/src/pricing.ts`.
- [ ] **P1** Write the one-sentence reason to buy Nexo *instead of* the bundled AI. If you cannot
      write it without the word "cheaper", the interviews are not finished.
- [ ] **P1** List the 5 helpdesks your interviewees use and how each prices AI. Done when you can
      say which two cover most of your leads.
- [ ] **P2** Test a price below C$249 for Essentials with 3 prospects; learn whether price is the
      objection or not.

---

## Truth 2 — P0: AI-native software has much lower margins than classic SaaS

**Evidence.** Secondary reports citing ICONIQ put AI-native gross margin near 52% (up from about 41%
in 2024) against 75-85% for classic SaaS, with inference near 23% of revenue at scaling companies.
The fastest-growing AI startups reportedly run near 25% margin. Token prices have fallen sharply
(one estimate 10-100x from 2023 to 2026), but several sources say the problem is the pricing model
more than the efficiency. ([SoftwareSeni](https://www.softwareseni.com/why-ai-gross-margins-are-so-much-lower-than-saas-and-what-that-means-for-your-business/), [Monetizely](https://www.getmonetizely.com/blogs/the-economics-of-ai-first-b2b-saas-in-2026); secondary sources, no primary report found.)

**What it means.** Per-resolution pricing exists because cost scales with use. A flat price with
uncapped conversations carries the whole usage risk. You cannot know if the business works until
you can see cost per conversation.

- [x] **P0** Log input tokens, output tokens, model and embedding calls for every turn. *(Chat tokens only; embeddings are not recorded, see `billing/cost.ts`.)* Done when
      you can read cost per conversation and per workspace.
- [ ] **P0** Compute gross margin per plan from real runs of the head-to-head questions. Done when
      the table in `REALITY-CHECK.md` is replaced with measured numbers.
- [x] **P0** Add a fair-use rule: a soft conversation ceiling with an overage or upgrade path. *(Built as a ceiling that hands new conversations to the customer's own team; no overage billing.)* Done
      when no workspace can cost more than it pays without you being told.
- [ ] **P1** Benchmark a cheaper model (and cached retrieval) against the current default on the 20
      questions. Done when you know the quality loss, in points, per dollar saved.
- [ ] **P2** Decide whether per-resolution, flat or hybrid billing fits your measured cost.

---

## Truth 3 — P0: "Resolved" is defined by whoever sells it, and the claims do not survive production

**Evidence.** Vendors claim 65-86% resolution; production evidence clusters at 40-70%, Fin's own
case studies at 42-50%. A customer who simply stops replying can count as resolved. Two vendors at
$0.99 can bill very differently. ([Dragapp audit](https://www.dragapp.com/blog/ai-support-agent-resolution-rates/), [Drag pricing](https://www.dragapp.com/blog/state-of-ai-support-pricing/); vendor-adjacent sources.)

**What it means.** Buyers cannot compare vendors, which is your opening. It also means your own
number will be doubted: a 66% from invented data is the same kind of claim you criticise.

- [x] **P0** Write Nexo's definition of "resolved" and "handed off", in plain words. Done when the
      same words appear in the product, the docs and the landing page.
- [x] **P0** Remove or qualify the 66% figure everywhere public until it is measured on real data.
- [ ] **P1** Run the Plausible head-to-head (`eval/head-to-head/`). Done when the scorecard and
      `observations.md` are filled in for Nexo and at least one competitor.
- [ ] **P1** In interviews ask: "How do you know your current AI resolved something?" Done when you
      know if the pain exists *as buyers describe it*.
- [ ] **P2** Prototype a verified-resolution status (resolved by AI, by a human, abandoned) from
      existing conversation records. Done when one real conversation shows its evidence.
- [ ] **P2** Publish the method and the result of the benchmark, including where Nexo lost.

---

## Truth 4 — P1: Customers accept AI only with an exit, and trust is lost fast

**Evidence.** 87% of 3,566 customers say a path to a human is essential (Gartner, primary).
Customers are about 3x more likely to use third-party GenAI than a company's own chatbot (Gartner,
primary). Only 27% would retry a chatbot after a bad experience (secondary). Gartner predicts half
of companies that cut service staff citing AI will rehire by 2027; only 20% of leaders had
reduced staffing for AI. ([Gartner 87%](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0), [Gartner third-party GenAI](https://gcom.pdo.aws.gartner.com/en/newsroom/press-releases/2026-07-08-gartner-survey-finds-customers-are-three-times-more-likely-to-use-third-party-genai-than-company-provided-chatbots-for-customer-service), [TechRepublic on rehiring](https://www.techrepublic.com/article/gartner-ai-customer-service-rehire-2027/).)

**What it means.** "Replace your support team" is a losing pitch and "AI plus a human exit" is
a winning one, which fits Nexo. The risk is that a first bad answer ends a customer's trust.

- [ ] **P1** Audit the landing page and onboarding for any language that implies replacing staff.
      Done when none remains.
- [ ] **P1** Test the handoff end to end as a stranger would: time to reach a human, what the human
      receives. Done when it is timed and written down for Nexo and one competitor.
- [ ] **P1** Make the "hand off rather than guess" rate visible to the operator (how often Nexo
      declined, and why). Done when the dashboard shows it.
- [ ] **P2** Collect a one-tap "was this helpful?" on every answer. Done when you have a satisfaction
      signal that is not just your confidence score.
- [ ] **P3** Track Gartner and similar surveys twice a year; update the claims you rely on.

---

## Truth 5 — P1: The helpdesk is the system of record, and AI is sold inside it

**Evidence.** Zendesk builds AI agents into its Suite; Freshworks sells Freddy inside Freshdesk;
HubSpot and Intercom bundle theirs. Buyers rank integration and security among their top agent
criteria (Verdantix, primary, enterprise IT sample). ([Verdantix 2026](https://www.verdantix.com/insights/report/global-corporate-survey-2026--ai-budgets--priorities-and-tech-preferences), [Twig](https://www.twig.so/blog/customer-service-ai-market-map-2026).)

**What it means.** A bot with only a generic webhook handoff will meet "does it work with our
helpdesk?" in every sales call. The integration is part of the product, but only one at a time.

- [ ] **P1** From interviews, count which helpdesk each lead uses. Done when you can name the one
      with the most leads.
- [ ] **P1** Build or scope exactly one adapter for that helpdesk, not five. Done when a test ticket
      arrives in a real sandbox with the transcript and sources attached.
- [ ] **P2** Decide whether Nexo is the front line, a QA layer over their existing AI, or both.
      Done when an interviewee has told you which they would pay for.
- [ ] **P3** Revisit other adapters only when a signed customer needs one.

---

## Truth 6 — P1: Consolidation is underway, and a small independent can be squeezed or bought

**Evidence.** Salesforce reportedly completed its acquisition of Fin (formerly Intercom), though
sources disagree on the close date and one guide still called it pending; Zendesk acquired
Forethought; NICE reportedly paid about $955M for Cognigy. The market is also still fragmented:
the top four vendors held under 51% in one January 2026 map. ([Twig market map](https://www.twig.so/blog/customer-service-ai-market-map-2026), [Cadenflow field report](https://cadenflow.com/industry-research/2026/07/state-of-ai-customer-support); secondary sources.)

**What it means.** Big vendors are buying capability, so a differentiated small product can be
acquired; a me-too one is squeezed. The earlier flag in this repo that the Salesforce-Fin deal was
single-sourced is now two secondary sources, which is better but still not primary.

- [ ] **P1** Confirm the Salesforce-Fin deal in a primary source (press release or filing) before
      keeping it in `PHILOSOPHY.md`. Done when a link to the primary source replaces the claim.
- [ ] **P2** Make a list of 10 likely acquirers and partners and what each lacks that Nexo has.
      Done when each has a one-line rationale.
- [ ] **P2** Check how Fin's price, plans or support changed after the deal; log buyer reactions.
      Done when you know if existing Fin customers are looking around.
- [ ] **P3** Review the map every quarter for new entrants and deals.

---

## Truth 7 — P2: Pricing models are still in flux

**Evidence.** About five pricing models coexist (per resolution, per conversation, seat plus meter,
flat-included, credits). One report says 37% of AI companies plan to change their pricing model
in the next 12 months. Buyer complaints are about predictability and definitions, not about outcome
pricing as such. ([Drag](https://www.dragapp.com/blog/state-of-ai-support-pricing/), [Monetizely](https://www.getmonetizely.com/blogs/the-economics-of-ai-first-b2b-saas-in-2026); no survey of buyer reaction found.)

**What it means.** Nobody has found the stable price. Predictable pricing is a real selling point
only if you can survive its costs (see Truth 2).

- [ ] **P2** Show three pricing frames to interviewees (flat, per resolution, hybrid) and record
      which they pick and why. Done when 10 have chosen.
- [ ] **P2** Put a price-change policy in writing (notice period, grandfathering). Done when it is on
      the pricing page.
- [ ] **P3** Review pricing every quarter against the do-first list's cost data.

---

## Truth 8 — P2: Liability, privacy and procurement decide enterprise deals

**Evidence.** Canadian law does not generally require Canadian-only storage but requires
comparable protection, disclosure of transfers and, in Quebec, an impact assessment before data
leaves the province. Buyers ask for the sub-processor list, data-flow diagram and no-training
terms. Most AI support vendors do not publish a Canadian region. ([Fini guide](https://www.usefini.com/guides/best-ai-support-vendors-canadian-data-residency-pipeda), [Lorikeet guide](https://www.lorikeetcx.ai/articles/ai-support-canadian-data-residency-guide); vendor sources, not legal advice.)

**What it means.** A small vendor can win trust by being precise and documented. A vague claim
loses it.

- [x] **P1** Rewrite the "Canadian data residency" claims on the landing page to say exactly what
      is stored where and what is processed by whom. Done when counsel has read it.
- [ ] **P2** Publish a sub-processor list and a short data-flow diagram. Done when both are public.
- [ ] **P2** Have a lawyer review the terms of service and privacy policy for an AI product that
      gives customers wrong answers. Done when they are signed off.
- [ ] **P2** Research which Canadian-hosted model options exist before promising any.
- [ ] **P3** Pursue formal certifications only when a signed customer requires one.

---

## Truth 9 — P3: Nobody owns the category, so the fight is over a narrow niche

**Evidence.** The leading vendor holds under 20% share and the top four under 51% in one map; the
market is described as fragmented ("no one owns it"). ([Twig](https://www.twig.so/blog/customer-service-ai-market-map-2026), secondary.)

**What it means.** There is room, but only for a vendor that is clearly the best at something
narrow. Breadth loses.

- [ ] **P2** After 20 interviews, pick one narrow segment and write down why Nexo wins there.
      Done when the segment fits on a line.
- [ ] **P3** Re-check the segment against new entrants each quarter.

---

## What I could not verify

- Churn and retention figures for AI support products: none found.
- Whether buyers have actually reacted against per-resolution pricing: descriptions of risk only.
- The Air Canada chatbot liability case and Klarna's reversal were not found in these searches.
  Look them up directly before citing either.
- Any primary ICONIQ or Bessemer report; the margin figures are repeated by secondary sites.
