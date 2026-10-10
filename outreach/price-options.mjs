import { readFileSync } from "node:fs";

const PRICING_TS = new URL("../packages/landing/src/pricing.ts", import.meta.url);
const ROW = /\{\s*name:\s*"([^"]+)",\s*conversations:\s*(\d+),\s*price:\s*(\d+)\s*\}/g;
const plans = [...readFileSync(PRICING_TS, "utf8").matchAll(ROW)]
  .map(([, name, chats, price]) => ({ name, chats: Number(chats), price: Number(price) }))
  .sort((a, b) => a.chats - b.chats);
if (!plans.length) throw new Error("Could not read the plans from packages/landing/src/pricing.ts.");

const DESIGN_SHARE_IN_TEN = 4;
const BASE_SHARE = 0.4;
const CAP_FACTOR = 1.4;
const SCENARIOS_IN_TEN = [2, 4, 6];

const whole = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chats = Number(process.argv[2]);
if (!Number.isInteger(chats) || chats <= 0) {
  console.log("Usage: node price-options.mjs <chats a month>, for example: node price-options.mjs 2400");
  process.exit(1);
}
const plan = plans.find((p) => chats <= p.chats);
if (!plan) {
  console.log(`${whole.format(chats)} chats a month is more than the largest plan covers (${whole.format(plans.at(-1).chats)}). Price it by hand.`);
  process.exit(1);
}
const money = (n) => `C$${whole.format(Math.round(n))}`;
const rate = (n) => `C$${cents.format(n)}`;
const toCents = (n) => Math.round(n * 100) / 100;

const confirmedAtDesign = (chats * DESIGN_SHARE_IN_TEN) / 10;
const perResolution = toCents(plan.price / confirmedAtDesign);
const base = Math.round(plan.price * BASE_SHARE);
const perConfirmed = toCents((plan.price - base) / confirmedAtDesign);
const cap = Math.round(plan.price * CAP_FACTOR);

const options = [
  { label: "1. Flat", bill: () => plan.price },
  { label: "2. Per resolution", bill: (confirmed) => perResolution * confirmed },
  { label: "3. Base plus", bill: (confirmed) => Math.min(base + perConfirmed * confirmed, cap) },
];
const col = (s, width) => s.padEnd(width);

console.log(`At ${whole.format(chats)} chats a month (${plan.name}, up to ${whole.format(plan.chats)}):\n`);
console.log(`  ${col(options[0].label, 20)}${money(plan.price)} a month, the same whatever the AI resolves.`);
console.log(`  ${col(options[1].label, 20)}${rate(perResolution)} for each chat their customer confirms was solved.`);
console.log(`  ${col("", 20)}Nothing for chats handed to their team or never confirmed.`);
console.log(`  ${col(options[2].label, 20)}${money(base)} a month plus ${rate(perConfirmed)} per confirmed chat, never more than ${money(cap)}.\n`);
console.log("What each would cost if 2, 4 or 6 in 10 chats were confirmed solved.");
console.log("These are scenarios, not a forecast: nobody knows the share until a pilot measures it.\n");
console.log(`  ${col("", 20)}${SCENARIOS_IN_TEN.map((n) => col(`${n} in 10`, 11)).join("")}`.trimEnd());
for (const option of options) {
  const row = SCENARIOS_IN_TEN.map((n) => col(money(option.bill((chats * n) / 10)), 11)).join("");
  console.log(`  ${col(option.label, 20)}${row}`.trimEnd());
}
console.log("\nAsk: which would you pick, and why? Log flat, per_resolution or base_plus in price_pick.");
console.log("Only option 1 can be sold today. Options 2 and 3 need the chat to ask the customer");
console.log('"Did that solve it?", which is not built yet (RESOLUTION.md).');
