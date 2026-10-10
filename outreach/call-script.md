# Call script

You are asking for a short conversation to learn. You are not selling. Say your name and why
you are calling in the first sentence, be brief, and leave when they say no.

## Opener (under 20 seconds)

> "Hi, I'm [name], an independent founder in [city]. I'm not selling anything. I'm trying to
> understand how small software companies handle repeat customer questions, and I'd like 15
> minutes of your time. Is that something you'd be open to?"

## If they already have an AI assistant (check their site first)

Use this opener instead. You are asking how it is going, not pitching a replacement:

> "Hi, I'm [name], an independent founder in Kitchener. I'm not selling anything. I noticed
> [company] has an AI assistant in its support chat. I'm researching how small software teams
> find those, what works and what doesn't. Could I ask you a few questions, 15 minutes?"

Questions: What does it handle well? What does it get wrong? When it is wrong, how do you find
out? Who checks its answers on pricing, refunds and contracts? What does it cost you? Would you
change anything about it? If you could change one thing, what would it be?

## If a gatekeeper answers

> "Who handles customer support there?" ... "Is there a good time to reach them, or a direct
> email I can write to?"

Do not pitch to the gatekeeper. If they say no, thank them and move on.

## If you get voicemail (20 seconds, once)

> "Hi, it's [name]. I'm an independent founder in [city] researching how small software
> companies handle customer support. I'd value 15 minutes of your time. My number is [number].
> Thanks."

Do not leave a second voicemail. If you have their email, send one short message the same day.

## If they say "what is it?"

Be plain and short:

> "It's an AI assistant for software companies that answers customer questions from your own
> help center, and hands the conversation to a person when it isn't sure. It's early. Right
> now I'm here to learn how you do this today, not to sell it."

## If they say no or "not interested"

> "No problem at all, thanks for your time."

Ask one question only if they sound willing: "What do you use for support today?" Then end the
call and log it. Add anyone who says to stop calling to your do-not-call list.

## Questions, if they agree to talk (ask about the past, not the future)

1. Walk me through the last time a customer wrote in with a question your docs already answered.
2. How many of those come in a week? Who handles them? What does that cost you?
3. Have you tried an AI bot or chatbot? What happened? What did you stop using, and why?
4. When one gave a wrong answer, what happened next? Did a customer notice?
5. What would you need to see before letting a bot talk to customers unsupervised?
6. What do you pay for support software today? Who decided, and how long did it take?
7. How do you decide whether something is working? What do you show your boss?
8. (Only now) If I could show you what it would say to 20 of your customers' real questions, using
   only your public help center, would that be useful?

## Pricing: three ways to pay (after question 8, only if the call is going well)

You are deciding how to price it, and their choice is the data. Ask how many support chats they
get in a month in total. Question 2 only counts the repeat questions, per week, so it is a floor,
not the total. Then, on your own screen, run:

```bash
node price-options.mjs <their chats a month>
```

Read them the three options it prints, at their volume, then ask: "Which of these would you pick,
and why?" Write down their exact words. Log `flat`, `per_resolution` or `base_plus` in
`price_pick` and their reason in `price_pick_why`.

- The three cost about the same when 4 in 10 chats are confirmed solved. They were built that way,
  so the choice shows how they want to pay, not which is cheapest. It is not a forecast: never tell
  them how many chats Nexo would solve. Nobody knows until a pilot measures it.
- Only the flat price can be sold today. The other two bill on chats their customer confirms were
  solved, which needs the chat to ask "Did that solve it?", and that is not built (`RESOLUTION.md`).
  If several people pick them, that is the evidence the feature is waiting for.

## The pilot (after the 20-question audit, if they want to try it)

Offer the flat price, not a discount. A discounted pilot only tells you they will take a discount.

- **Price:** the flat price `price-options.mjs` shows for their volume, the first month paid up front.
- **Setup:** you do it. Import their help center, put the widget on their site, and set up the
  handoff to their team.
- **Length:** 30 days from the day the widget goes live.
- **The bar, in writing before it starts:** ask what share of chats Nexo would have to resolve for
  the month to be worth the price to them. Their number is the bar. "Resolved" means what
  `RESOLUTION.md` says, which only works if their team closes conversations as they go, so agree
  that too, and go through the list together at day 30.
- **If it misses the bar:** refund the month in full.
- **After 30 days:** they carry on at the same price or stop. No contract.

## Close

> "Who else should I talk to?"  /  "Is it OK if I follow up in a few weeks?"

Thank them. Write notes within an hour, in `notes/`.

## Rules

- Never ask "would you use this?" People say yes to be polite.
- Do not argue, defend or explain. Listen and write down their exact words.
- One attempt, one voicemail, one follow-up email at most. Then move on.
- Keep every call under the time you asked for.
