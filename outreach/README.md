# Outreach

Phone research with local software and SaaS companies, to learn how small teams handle repeat
customer questions. Plan and hypotheses: `../MARKET-VALIDATION.md`. Operating rhythm:
`../CEO-PLAYBOOK.md`.

## Privacy: this repo is public

`companies.csv`, `call-log.csv` and everything in `notes/` (except `_template.md`) are
git-ignored on purpose: they hold real people's names, numbers and words. Never commit them or
paste them into a public issue. Back them up somewhere private.

## Setup (once)

```bash
cd outreach
cp companies.template.csv companies.csv
cp call-log.template.csv call-log.csv
```

## Building the list

Aim for 60 companies to reach 30 calls. Good sources: Google and Google Maps searches for
software and SaaS companies in your area, local startup directories, incubator and accelerator
portfolio pages, and each company's own "Contact" and "Support" pages. Add one row per company in
`companies.csv`. Prefer companies with a public help center or docs page, because you will want
to look at it before you call.

`type`: `saas`, `software` or `other`. `status`: `to_call`, `called`, `done`, `do_not_call`.

## Kitchener-Waterloo seed list

`kw-seed-companies.csv` holds 12 starting companies found in public sources (company-level
facts only, no people, so it is safe in this public repo). Copy the rows into your private
`companies.csv`. Every row needs checking: the search results were thin, "fit" is unverified,
and several domains are from memory. Before calling a company, open its site and look for a
help center and a Contact page. Drop the ones with no customer-facing support.

The file name still says "kw" but it now holds Ontario companies: the first 12 are Kitchener-Waterloo,
the rest come from Toronto, Ottawa, Hamilton, Guelph and Mississauga search results. Rows with
status `unverified` are directory listings with no confirmation they have customer-facing support.

Lists to copy from (open these yourself, I could not reach them from the build environment):
Latka's Ontario (about 919 SaaS companies), Toronto (about 597) and Kitchener (about 44) pages at
getlatka.com; RevenueBase's Canadian B2B software lists at revenuebase.ai; Gregslist's Toronto
B2B SaaS list; Scott's Directories' software publishers for Hamilton and Guelph; Built In Toronto
and Built In Ottawa; the Communitech member directory; and Deloitte's Technology Fast 50 winners page.

To grow it to about 60: the Latka list of Kitchener SaaS companies, the Communitech member
directory (communitech.ca), Waterloo EDC's Deloitte Technology Fast 50 pages, Google Maps
searches ("software company Kitchener", "Waterloo SaaS"), and local startup and incubator
portfolio pages. Prefer companies where support is a team of 2-20, not one person and not 100.

Calls go to Eastern Time offices. Lunch (12:00-13:00) and 17:00-18:00 are usually the best windows.

## Find who has a chat widget (run on your own computer)

```bash
cd outreach
node detect-widgets.mjs kw-seed-companies.csv     # or companies.csv once you have it
```

It loads each homepage once, looks for the scripts of about 20 common chat and support widgets
(Intercom, Zendesk, HubSpot, Drift, Crisp, Help Scout, Ada, Chatbase and others), prints a table and
writes `widget-scan.csv`. Rows with no website are skipped, so fill those in first.

Treat it as a hint. "None detected" can be wrong: a widget loaded through Google Tag Manager,
after a cookie banner, or only on a Help page does not appear in the homepage HTML (the script
tells you when Tag Manager is present). A named vendor also does not say whether the bot is AI.
Open the site and look at it yourself before trusting either result.

## Check their support first, then pick who to call

Having an AI chat does not rule a company out. A bot that is not doing its job is a reason to
buy something better. Rank companies by **evidence that support is struggling**, not by whether a
bot exists:

1. **Their public chat** (`bot-checks.md`): ask 3-5 ordinary questions. Did it answer wrongly or
   vaguely, loop, or make it hard to reach a person?
2. **Customer reviews** on review sites (G2, Capterra, Software Advice and similar): read the cons
   and any review that mentions support. Record a short quote, the date and the link.
3. Fill `support_widget`, `ai_agent_seen` and `support_complaints_seen` in `companies.csv`.

Call first the companies with the strongest signs of a struggling support experience. Use the
"already has an AI assistant" opener when they have a bot. Do not quote a review back at someone
on a call; use it to choose your questions.

## Columns that decide who you call

- `potential_client`: `yes` or `no`, your judgement after checking their support. Blank means not checked yet.
- `contacted`: `yes` or `no`. Flip it to `yes` the day you call or write.
- `contact_role`: the role to ask for (a support lead), not a person. Fill `contact_name` yourself
  once you learn it on the call.
- `phone`: a main public line. Numbers from directories are marked "verify" in `notes`; confirm
  on the company's own site before dialling.

## Calling

Follow `call-script.md`. Call in your own time, from your own phone. After every call, add a row
to `call-log.csv` and, if you spoke to someone, a file in `notes/` (copy `notes/_template.md`).

`outcome` values: `no_answer`, `voicemail`, `gatekeeper`, `declined`, `agreed_to_talk`, `talked`.

## Stop rule

After 30 calls (or two weeks, whichever comes first), run:

```bash
node summary.mjs
```

Then decide: what did you learn, who actually answered, what changes? If it produced no useful
conversation, stop calling and change something rather than calling more.

## Respect

One attempt, one voicemail, one follow-up email at most. If someone declines or asks you to stop,
log them as `do_not_call` and move on. Keep calls to the time you asked for.
