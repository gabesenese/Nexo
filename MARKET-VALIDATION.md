# Nexo — Market Validation

> Written 2026-10-10. Part 1 is desk research: what public evidence says about demand. Part 2
> is the plan for the validation desk research cannot give: buyers choosing to pay. Competitors
> and the bet live in `COMPETITORS.md`; the thesis in `PHILOSOPHY.md`.
>
> **Desk research is not validation.** Reading surveys can show a market exists and which
> pains are real. Only a buyer spending time, money or reputation on Nexo shows that Nexo
> is wanted. Most sources below are vendor blogs; the primary surveys are marked.

---

## Part 1 — What the evidence says

| Signal | Finding | Strength |
| --- | --- | --- |
| Buyers are under pressure | 91% of 321 customer-service leaders said they were under pressure to implement AI in 2026 ([Gartner, Feb 2026](https://gcom.pdo.aws.gartner.com/en/newsroom/press-releases/2026-02-18-gartner-survey-finds-ninety-one-percent-of-customer-service-leaders-under-pressure-to-implement-ai-in-2026)). | Primary survey. Shows pressure, not that they buy from a small vendor. |
| Customers demand a human | 87% of 3,566 customers say a path to a human agent is essential when a company uses GenAI; 50% say GenAI makes interactions easier ([Gartner, Aug 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)). Among those unwilling to use AI, the top fix was being able to switch to a human. | Primary survey. Directly supports escalation-first. |
| Bad bots are not forgiven | Only 27% would try a chatbot again after a bad experience (reported via [Macha](https://www.getmacha.com/blog/customer-trust-ai-customer-service-statistics), secondary). Customers are about 3x more likely to use third-party GenAI than a company's own chatbot ([Gartner, Jul 2026](https://gcom.pdo.aws.gartner.com/en/newsroom/press-releases/2026-07-08-gartner-survey-finds-customers-are-three-times-more-likely-to-use-third-party-genai-than-company-provided-chatbots-for-customer-service)). | Mixed. Raises the bar for quality; also a risk. |
| Pricing predictability | Many vendors' AI pricing conflicts with buyers' "deep-set preference for cost predictability" ([Verdantix 2026](https://www.verdantix.com/insights/report/global-corporate-survey-2026--ai-budgets--priorities-and-tech-preferences), 306 enterprise IT/AI executives). | Primary survey, but not support buyers. Supports flat pricing as a hypothesis only. |
| Cost of the problem | Human-handled SaaS tickets are roughly $8-$35 each depending on complexity; AI-resolved $0.50-$2 (vendor-sourced; [Lorikeet](https://lorikeetcx.ai/articles/customer-service-cost-per-ticket), [Fin](https://fin.ai/learn/ai-customer-service-cost-savings-industry)). | Weak. Wide range, sellers' numbers. Use only for the ROI model, with the customer's own figures. |
| SMB adoption | Overall small-business AI use ranges from about 40% ([FRBSF](https://www.frbsf.org/research-and-insights/publications/community-development-research-briefs/2026/07/ai-adoption-in-small-businesses-2024-sbcs/), Fed survey) to 70% (vendor-run surveys). 78% of 1,400 support leaders use AI somewhere in the workflow ([Helply](https://helply.com/resources/state-of-ai-customer-support)). No reliable figure for SMB AI **support agents**. | Weak for our exact segment. This is a gap to fill by interviews. |

**What this supports:** the pain and the budget pressure are real, and "a human is always one click
away" is what customers say they want. **What it does not show:** that small SaaS support teams
will buy a new vendor, what they will pay, or that our resolution quality beats Fin's.

### Warnings from the research

1. **Our residency claim may be overstated.** The landing page FAQ says "Canadian data residency
   by default" and the footer repeats it. Canadian buyers are told to separate *storage* from
   *processing* and to ask about model providers as sub-processors
   ([guide](https://www.usefini.com/guides/best-ai-support-vendors-canadian-data-residency-pipeda),
   vendor source). Nexo stores in Fly `yyz` and Neon, but sends text to Anthropic for answers and
   to OpenAI for embeddings. Neither PIPEDA nor Quebec Law 25 mandates Canadian-only storage; they
   require comparable protection, disclosure and, for Quebec, a privacy impact assessment before
   data leaves the province. Before a regulated buyer reads it, either make the claim precise
   ("data stored in Canada; AI processing by named sub-processors, no training on your data") or
   remove it. Have counsel confirm; this file is not legal advice.
2. **Segment mismatch.** The brief says Canadian SMB broadly; `PHILOSOPHY.md` says SaaS companies
   with 2-20 support staff. Validation should target the second, narrower group. A claim in one
   unverified source that 82% of companies under 5 employees do not see AI as applicable is a
   reason not to go below ~2 dedicated support people.
3. **Customers prefer third-party GenAI to company chatbots.** Our product competes with a
   customer opening ChatGPT. The case has to rest on answers that are checkable and a way out.

---

## Part 2 — How to validate

### The hypotheses, stated so they can fail

| # | Hypothesis | Counts as true if | Counts as false if |
| --- | --- | --- | --- |
| H1 | Small SaaS support teams spend real time on repetitive questions their docs already answer. | Of 20 interviews, 12+ describe a specific recent week, with numbers, where this cost them. | Most say it is a minor annoyance. |
| H2 | They distrust AI answers they cannot check, and have been burned or fear it. | 10+ name a concrete failure or a refusal to deploy because of it. | They mostly say "it's fine, we'd just turn it on". |
| H3 | An auditable, flat-price offer is a reason to choose us over Fin/Chatbase. | 8+ prefer it when shown side by side, and say why in their own words. | They choose on price alone, or on Intercom bundling. |
| H4 | They will pay C$249-899/month. | 5+ agree to a paid pilot or sign a letter of intent. | Interest stays at "send me more info". |

### Who to talk to

SaaS companies, 500-20,000 customers, 2-20 support staff, an existing helpdesk, 1,000+ monthly
conversations. Target 20 conversations. Find them through Canadian SaaS founder and support
communities, LinkedIn searches for "Head of Support" / "Customer Support Manager" at that size,
and your own network. Talk to the person who reads the tickets, then the person who signs.

### Interview script (30 minutes, ask about the past, never pitch first)

1. Walk me through the last time a customer wrote in with a question your docs already answered.
2. How many of those a week? Who handles them? What does an hour of that cost you?
3. Have you tried an AI bot or chatbot? What happened? What did you stop using, and why?
4. When it gave a wrong answer, what happened next? Did a customer notice?
5. What would you need to see before you let a bot talk to customers unsupervised?
6. What are you paying now for support software? Who decided, and how long did it take?
7. How do you decide whether something is working? What numbers do you show your boss?
8. (Only now) Show the Nexo landing page and the Plausible head-to-head. What would stop you
   from trying it this month?

Record exact quotes. Never ask "would you use this?" (people say yes to be polite). Ask what they did
last time, what they pay today and who would have to approve.

### Cheap experiments, cheapest first

1. **Free docs audit.** Offer to run their public help center through Nexo with 20 of their real
   customer questions and send the result. Takes you an hour, shows you real-world resolution rates,
   and is a reason for a second conversation.
2. **Landing smoke test.** Send traffic to the existing page and measure trial-signup rate per
   visitor. Early access means a low number is expected; compare variants (flat price vs
   per-resolution framing, residency claim vs none).
3. **Paid pilot.** After the audit: a 30-day paid pilot at a discount, in writing. A pilot with money
   attached is the only signal in this document that cannot be faked.

### Decision rule

If, after 20 conversations and 5 audits, fewer than 5 teams have agreed to a paid pilot, do
not add features. Change who we sell to or what we promise, per `PHILOSOPHY.md` §16.

### Tracking

Keep a table (spreadsheet is fine): company, role, date, size, current tool, pain in their words,
H1-H4 yes/no, next step, pilot status. Review after every five conversations and update
`COMPETITORS.md` with anything they say about a competitor.

---

## Sources

- [Gartner: 91% of service leaders under AI pressure](https://gcom.pdo.aws.gartner.com/en/newsroom/press-releases/2026-02-18-gartner-survey-finds-ninety-one-percent-of-customer-service-leaders-under-pressure-to-implement-ai-in-2026)
- [Gartner: 87% say a human option is essential](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)
- [Gartner: customers use third-party GenAI 3x more](https://gcom.pdo.aws.gartner.com/en/newsroom/press-releases/2026-07-08-gartner-survey-finds-customers-are-three-times-more-likely-to-use-third-party-genai-than-company-provided-chatbots-for-customer-service)
- [Verdantix 2026 corporate AI survey](https://www.verdantix.com/insights/report/global-corporate-survey-2026--ai-budgets--priorities-and-tech-preferences)
- [FRBSF small business AI brief](https://www.frbsf.org/research-and-insights/publications/community-development-research-briefs/2026/07/ai-adoption-in-small-businesses-2024-sbcs/)
- [Helply 2026 support survey](https://helply.com/resources/state-of-ai-customer-support)
- [Macha: customer trust statistics](https://www.getmacha.com/blog/customer-trust-ai-customer-service-statistics)
- [Lorikeet: cost per ticket](https://lorikeetcx.ai/articles/customer-service-cost-per-ticket)
- [Fin: AI cost savings](https://fin.ai/learn/ai-customer-service-cost-savings-industry)
- [Fini: Canadian data residency guide](https://www.usefini.com/guides/best-ai-support-vendors-canadian-data-residency-pipeda)
