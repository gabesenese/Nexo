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
