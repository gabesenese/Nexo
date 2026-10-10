# Head-to-head: Nexo vs Fin, Chatbase, Tidio (Lyro)

Tests the claim in `COMPETITORS.md` that Nexo's resolution numbers hold up against the
products a small SaaS team would compare it to. The point is not a leaderboard. It is to
learn whether Nexo's 66% on the invented demo corpus survives a corpus we did not write.

## Fairness rules

1. **One corpus.** A single public SaaS help center, ingested by all four products from the
   same URL. Never the Meridian demo, which Nexo's thresholds were tuned on.
2. **Questions fixed before anyone runs anything.** Fill and commit `questions.json` first.
3. **Fresh conversation per question**, default settings, no prompt tuning on any product.
4. **A person grades every row, blind to product if you can manage it.** Hide the product
   column and shuffle before grading.
5. **Write down plan and version** for each competitor (trial vs paid changes the model).

## The 20 questions

Fill `questions.template.json`, save as `questions.json`. The runner refuses an incomplete
file. Quotas are fixed:

| Slots | Category | How to write it |
| --- | --- | --- |
| q01-q12 | `answerable` | A question one article answers clearly. Put the article in `source_url` and the facts a correct answer must contain in `expected`. Phrase it like a customer, not like the article title. Include 2-3 that need a number, a plan limit or a step order. |
| q13-q16 | `partial` | The help center answers half. A good reply gives the covered half and does not guess the rest. In `expected`, say what is covered and what is not. |
| q17-q20 | `unanswerable` | A plausible customer question the help center does not answer (account-specific, policy edge case, a feature that does not exist). Right behaviour is a handoff. Leave `source_url` empty and describe in `expected` what a made-up answer would look like. |

Confirm each `unanswerable` question by searching the help center, not by assuming.

## Run it

```bash
cd eval/head-to-head
cp questions.template.json questions.json   # then fill it in
node init-sheet.mjs                         # results.csv, one row per product per question
```

**Nexo.** Ingest the help-center URL in a workspace (Knowledge > add source), wait for it to
be ready, then:

```bash
NEXO_WIDGET_KEY=<workspace widget key> node run-nexo.mjs
```

Needs the server running with a cloud AI provider. Local Ollama results do not count
(see `structured-plan.md`, Launch/Infra step 3).

**Fin, Chatbase, Tidio.** Create your own trial, point each at the same help-center URL, and
paste each question into a fresh chat. Paste the reply into `answer`, the sources it shows
into `sources_cited`, and set `auto_handoff` to `yes` if it offered a person.

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

## Reading the result

- Compare **wrong answers** first. A product that is right more often but also confidently
  wrong is worse for a support team than one that hands off.
- **Needless handoff** on answerable questions is the cost of Nexo's confidence gate. High
  is a tuning problem, not a failure.
- 20 questions is a smoke test, not a benchmark. Differences under ~10 points are noise.
  Repeat on a second help center before quoting any number publicly.
- Record results and the date in `COMPETITORS.md` section 5, replacing the unproven 66% note.
