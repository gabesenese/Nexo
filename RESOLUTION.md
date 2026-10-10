# What "resolved" means at Nexo

> One definition, used by the product, the docs and the website. If a number about resolutions
> appears anywhere, it follows this file. Code: `packages/server/src/routes/impact.ts`. Screen: the
> Impact page in the console.

## Why this exists

In this industry "resolved" is whatever the vendor says it is. A customer who stops replying can be
counted as resolved. Vendors quote 65-86% resolution; production evidence clusters at 40-70%. That
gap is mostly definitions (`COMPETITORS.md` section 3). Nexo does not bill per resolution, so no
invoice depends on this definition, which is exactly why it can afford to be strict. It exists so the
number a workspace sees is one it can check against its own conversations.

## The four outcomes

Every conversation is in exactly one of these at any moment.

| Outcome | It means | Counts as a resolution? |
| --- | --- | --- |
| **Resolved by Nexo** | The conversation is marked resolved, Nexo never handed it off, and nobody on the team wrote to the customer. | Yes |
| **Resolved with your team** | Marked resolved after a person wrote to the customer or took a handoff. | Yes, but not credited to Nexo |
| **Answered, not confirmed** | Nexo answered, never handed it off, and nobody has marked it resolved. | **No** |
| **Waiting on your team** | Handed off and not yet resolved. | No |

## The rules behind that table

1. **Silence is not a resolution.** A customer going quiet after an answer tells us nothing about
   whether they were helped. Those conversations are "answered, not confirmed" and are never added to
   the resolved count, however many there are.
2. **A handoff is never credited to Nexo.** If Nexo handed a conversation to a person, it is "resolved
   with your team" when closed, even if nobody typed a reply (the customer may have simply left).
3. **Resolved means resolved now.** If the customer writes again within the reopen window (72 hours by
   default, `REOPEN_WINDOW_HOURS`), the thread reopens and stops counting as resolved until it is
   closed again. A resolution that does not hold is not a resolution.
4. **The automation rate is a share of all conversations.** It is "Resolved by Nexo" divided by every
   conversation started in the window, so conversations that were answered but never confirmed pull
   it down instead of being left out of the denominator.

## What it can and cannot tell you today

- **Today only a person can mark a conversation resolved.** There is no "did this solve your
  problem?" signal from the customer yet, so "Resolved by Nexo" means *someone on the workspace's team
  looked at it and closed it with no handoff*. That is a stricter test than silence, and a weaker one
  than the customer saying so.
- **A workspace that never closes conversations will see everything as "answered, not confirmed".**
  That is by design. It is better than quietly counting those as wins.
- **The "workload avoided" figure** applies the workspace's own handle-time and hourly-cost figures to
  "Resolved by Nexo" only. It never uses the unconfirmed bucket.

## Not built yet

- A customer-side confirmation ("Did that solve it?") in the widget, which would let a resolution
  stand on the customer's word. It is the natural next step for this definition, and the part of it
  that would most clearly set Nexo apart. It waits for buyers to confirm they care (see
  `MARKET-VALIDATION.md`) and for the scope freeze in `structured-plan.md` to lift.

## Rules for anything we publish

- Never quote a resolution rate unless it was measured on a real workspace using this definition, and
  state the sample size, the period and what the content was.
- A rate measured on invented or seeded conversations is a development figure, not a claim.
- Say "resolved" only for the first two rows of the table. For the third, say "answered".
