# Head-to-head: Nexo vs Fin, Chatbase, Tidio (Lyro)

Tests the claim in `COMPETITORS.md` that Nexo's resolution numbers hold up against the
products a small SaaS team would compare it to. The point is not a leaderboard. It is to
learn how Nexo's answers hold up on a corpus we did not write, since the only rate measured so
far came from invented demo conversations and has been withdrawn.

## The corpus

**Plausible Analytics docs, `https://plausible.io/docs`.** A real SaaS whose customer docs cover
billing, trials, cancellation, teams, invoices and data export, which is the traffic a support
bot gets. Questions in `questions.json` were written from the public `plausible/docs` repo
(commit `c54d139`, 2026-10-09), then each unanswerable topic was grepped across all 135 pages
to confirm it is absent. The docs are CC BY-SA 4.0; this repo holds our questions, not their text.

Two things to check before running:

- **The live site can differ from the repo.** Open each answerable question's `source_url` and
  confirm the page still says what `expected` says. Fix `expected` if it drifted, before any
  product sees a question.
- **Page cap.** The docs have 135 pages and Nexo's crawler stops at 100 by default
  (`DEFAULT_MAX_PAGES` in `packages/server/src/connectors/helpCenter.ts`). Check the source's
  page count in Knowledge and confirm every `source_url` was ingested. If pages are missing,
  that is a real finding about Nexo (record it in `observations.md`), not something to quietly
  work around. Give the competitors the same page set Nexo got, or note the difference.

## Fairness rules

1. **One corpus.** The Plausible docs above, ingested by all four products from the same URL.
   Never the Meridian demo, which Nexo's thresholds were tuned on.
2. **Questions fixed before anyone runs anything.** Fill and commit `questions.json` first.
3. **Fresh conversation per question**, default settings, no prompt tuning on any product.
4. **A person grades every row, blind to product if you can manage it.** Hide the product
   column and shuffle before grading.
5. **Write down plan and version** for each competitor (trial vs paid changes the model).

## The 20 questions

`questions.json` is already written for the Plausible corpus. `questions.template.json` is the
blank version for a second corpus, which you should run before quoting any number. Quotas are
fixed, and the runner refuses an incomplete file:

| Slots | Category | How to write it |
| --- | --- | --- |
| q01-q12 | `answerable` | A question one article answers clearly. Put the article in `source_url` and the facts a correct answer must contain in `expected`. Phrase it like a customer, not like the article title. Include 2-3 that need a number, a plan limit or a step order. |
| q13-q16 | `partial` | The help center answers half. A good reply gives the covered half and does not guess the rest. In `expected`, say what is covered and what is not. |
| q17-q20 | `unanswerable` | A plausible customer question the help center does not answer (account-specific, policy edge case, a feature that does not exist). Right behaviour is a handoff. Leave `source_url` empty and describe in `expected` what a made-up answer would look like. |

Confirm each `unanswerable` question by searching the help center, not by assuming.

## Get ready (about an hour, once)

You need: Node 20 or newer, Docker, an **Anthropic** API key and an **OpenAI** API key (Nexo uses
OpenAI only to turn text into search vectors). Set a low spend cap on both accounts, such as
US$10, until you have seen a real bill. Indexing a docs site and asking 20 questions should cost
well under that, and the cost report below will tell you exactly.

1. **Install and start the database.** From the repo root:
   ```bash
   npm install
   docker compose up -d        # Postgres with pgvector; wait until it reports healthy
   ```
2. **Create the server settings file.** It must be `packages/server/.env`, not the repo root.
   ```bash
   cp .env.example packages/server/.env      # PowerShell: Copy-Item .env.example packages/server/.env
   ```
   Open it and set these four things (leave the rest alone):
   - `JWT_SECRET`: any 32+ character random string. Generate one anywhere with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `AI_PROVIDER=cloud`
   - `ANTHROPIC_API_KEY=...`
   - `OPENAI_API_KEY=...`

   Local Ollama results do not count (`structured-plan.md`, Launch/Infra step 3). Never commit this
   file; it is already git-ignored.
3. **Create the tables.**
   ```bash
   npm run db:migrate --workspace=@nexo/server
   ```
4. **Start everything.** In a terminal at the repo root: `npm run dev`. The console is at
   http://localhost:5173 and the API at http://localhost:4000.
5. **Make a workspace and index the corpus.** Open http://localhost:5173/signup, create an account,
   and in the setup steps add the help center URL `https://plausible.io/docs`. Wait until the source
   shows **ready**; this takes a few minutes.
6. **Read the Sources page.** Note the page count. The crawler stops at 100 pages and the docs
   have about 135, so it will probably say the crawl was cut short. That is expected and is itself
   a finding about Nexo: write it in `observations.md`.
7. **Copy the widget key** from Settings in the console, then set it in your terminal:
   ```bash
   export NEXO_WIDGET_KEY=<key>              # PowerShell: $env:NEXO_WIDGET_KEY = "<key>"
   ```
8. **Check the corpus covers the questions.**
   ```bash
   npm run eval:coverage --workspace=@nexo/server
   ```
   It lists each question's page as found or missing, using a short phrase that should be in the
   text. A missing page means a question would test the crawler, not the answer. If several are
   missing, tell whoever is running the comparison, and either drop those questions for every
   product or give every product the same pages. A "found" is a good sign, not proof.
9. **Re-check the expected answers against the live site.** Open each `source_url` in
   `questions.json` (16 pages) and confirm the page still says what `expected` says. Fix `expected`
   if it drifted. Do this before any product sees a question.

## Run it

```bash
cd eval/head-to-head
node init-sheet.mjs        # results.csv: one row per product per question
node run-nexo.mjs          # asks Nexo all 20, one fresh session each (about two minutes)
```

The runner pauses between questions to stay under the chat rate limit (30 a minute). If it ever
reports a 402, the workspace's trial has ended. If a conversation comes back as handed to a person
without an answer, check the workspace is below its fair-use ceiling.

Then see what it cost:

```bash
npm run cost:report --workspace=@nexo/server
```

**Fin, Chatbase, Tidio.** For each, in its own account, on the same help center URL:
- Note the plan, version and date in `observations.md` before you start, because a trial and a paid
  plan can behave differently. Read each product's current pricing page for what the trial includes;
  do not enter a card unless you must, and set a reminder to cancel.
- Point it at `https://plausible.io/docs` and note how long indexing took, how it did it, and any
  cap or limit it told you about.
- Use default settings. Do not tune prompts or train it on the questions.
- Ask each of the 20 questions in a **fresh chat**, word for word. Paste the answer into `answer`,
  any sources it shows into `sources_cited`, and set `auto_handoff` to `yes` if it offered a person.
- Write down in `observations.md` what you notice as you go (see the template there).

## Grade it

For every row set `grade` to one of `correct`, `wrong`, `handoff`, and `citation_ok` to `y`
or `n` where a source was shown.

- `correct`: matches `expected`. For `partial`, covers the documented half without inventing the rest.
- `wrong`: wrong, invented, or contradicts the source. A confident answer to an `unanswerable`
  question is always `wrong`.
- `handoff`: declined and offered a human instead of answering.

```bash
node summarize.mjs
```

## Record observations while you run it

Open `observations.md` and fill one section per product as you go. The scorecard shows who is
right; the observations show what each competitor does that Nexo should copy, and what they
do badly that Nexo can beat. That second list is the point of the exercise.

## Reading the result

- Compare **wrong answers** first. A product that is right more often but also confidently
  wrong is worse for a support team than one that hands off.
- **Needless handoff** on answerable questions is the cost of Nexo's confidence gate. High
  is a tuning problem, not a failure.
- 20 questions is a smoke test, not a benchmark. Differences under ~10 points are noise.
  Repeat on a second help center before quoting any number publicly.
- Record results and the date in `COMPETITORS.md` section 5, replacing the "unproven headline number" note.
