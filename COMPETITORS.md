# Nexo — Competitors

> What the real competitors do well, where the category is broken, and where Nexo should
> bet. Written 2026-10-09 from public web sources and this repo. `PHILOSOPHY.md` holds the
> thesis, `project-brief.md` the market, `structured-plan.md` the sequencing. If this file
> disagrees with them on strategy, `PHILOSOPHY.md` wins.
>
> **Source quality.** Most of what is public about these vendors comes from rival vendors'
> blogs and affiliate comparisons. Treat every number here as directional, and re-check pricing
> pages before quoting any figure on the landing page. Figures with a single source are marked.

---

## 1. Who actually competes with us

| Group | Who | Why it matters |
| --- | --- | --- |
| **Direct threat** | Intercom Fin, Botpress, Chatbase, Tidio (Lyro), eesel | Sold to the same 2–20 person support team at a price that team can pay. |
| **Price ceiling** | Ada, Decagon, Sierra, Zendesk AI | Show what a buyer pays if they don't choose us. They rarely sell down-market. |
| **Not competitors** | Coveo, Voiceflow, Heyday | Search, agent builder and ecommerce chat. Remove them from the main comparison. |

**Fin is the main competitor, not Ada.** It is priced per outcome, has self-serve entry, and is
the product a small SaaS team will compare us against first.

## 2. What each does well

- **Intercom Fin** — publishes a price (about $0.99 per outcome, plus seats of roughly $29–139
  per seat per month depending on the source and tier), handles multi-step work such as
  refunds, account changes and cancellations, and claims a 65%+ resolution rate.
- **Chatbase / Tidio Lyro** — live in an afternoon on your own content, from about $32–40 a
  month. Our "days to launch" claim has to beat that, not just beat Ada's months.
- **Botpress** — human handoff from its $89 Plus tier, with an SDK that hands off to Zendesk
  and Intercom. Builder, not a finished support product.
- **Decagon / Sierra** — sell outcomes (a saved cancellation, an upsell), not answers. Third-party
  estimates: Decagon $40K–$430K+ a year depending on source, Sierra $150K+ plus setup fees. Both unpublished.
- **eesel** — helpdesk-first, public tiers; little independent review data.

## 3. Where the category is broken

1. **"Resolved" is the vendor's own definition.** A customer who stops replying can count as
   resolved. Vendor claims run 65–76%; production evidence clusters at 40–70%, Fin's own case
   studies at 42–50%, and one small-business test landed at 38%. A buyer cannot check what they
   were billed for.
2. **Per-resolution pricing charges more when the product works better.** Reviewers say so
   repeatedly. Our flat rate answers it (`PHILOSOPHY.md` §5).
3. **Escalation is treated as a failure.** Some vendors bill for a handoff, and all of them
   present the bot as the product.
4. **The learning loop stops at a report.** Competitors show analytics; none surfaced here turn
   an escalation into a fix for the knowledge base.

## 4. The bet: an auditable resolution

Every outcome gets a status the customer can verify: **resolved by AI**, **resolved by a human**,
or **abandoned**, each with its evidence (sources cited, confidence, the human's final answer).
With flat pricing the pitch becomes: *our count of resolutions is one you can check, and your
bill doesn't depend on it.*

Incumbents can't copy this cheaply, because their revenue depends on the loose definition.

Already in the repo: confidence gate, cited sources, full-thread handoff, knowledge gaps from
escalations, audit log, Impact page. Missing: a `Resolution` model with a verified outcome.
`PHILOSOPHY.md` §18 sequences it after launch on purpose.

## 5. Gaps against the competition

- **No yellow tier** — one confidence threshold, so green and red only.
- **No named helpdesk integration** — handoff is a generic signed webhook.
- **Narrow ingestion** — help-center crawl and PDF only.
- **No customer-context actions** — Fin can issue a refund; Nexo can only answer.
- **The headline number is unproven** — the demo corpus resolves 66%; independent figures are
  38–50%. Real customers will probably land below 66%.
- **Unverified claim in `PHILOSOPHY.md`** — Intercom's acquisition by Salesforce (~$3.6B) was
  confirmed by only one source in this research. Verify before keeping it.

## 6. Next steps

1. Run the same 20 real SaaS help-center questions through Fin, Chatbase, Tidio and Nexo. Record
   answers, wrong answers and handoff quality. This tests the 66% claim cheaply.
2. Prototype the verified-resolution status on top of the existing conversation and escalation
   records before building any new feature.
3. Choose one helpdesk adapter (Zendesk or Intercom) once a design partner commits.

## Sources

- [Featurebase: Fin pricing](https://www.featurebase.app/blog/fin-ai-pricing)
- [AI support tools compared](https://superframeworks.com/articles/best-ai-customer-support-tools)
- [Enterprise AI support pricing](https://www.getmacha.com/blog/enterprise-ai-customer-support-pricing)
- [Dragapp: resolution rates, claimed vs production](https://www.dragapp.com/blog/ai-support-agent-resolution-rates/)
- [Botpress pricing](https://www.lindy.ai/blog/botpress-pricing)
- [Botpress human handoff docs](https://www.botpress.com/docs/get-started/manage-your-agent/human-handoff)
