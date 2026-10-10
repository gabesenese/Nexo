// Prints where the calling experiment stands. Usage: node summary.mjs
import { readFileSync, existsSync } from "node:fs";
import { parseCsv } from "../eval/head-to-head/lib.mjs";

const path = new URL("./call-log.csv", import.meta.url);
if (!existsSync(path)) {
  console.log("No call-log.csv yet. Copy call-log.template.csv to call-log.csv and start logging.");
  process.exit(0);
}
const rows = parseCsv(readFileSync(path, "utf8"));
const STOP_AFTER = 30;
const count = (o) => rows.filter((r) => r.outcome === o).length;
const talked = count("talked");
const agreed = count("agreed_to_talk");
const pct = (n) => (rows.length ? `${Math.round((100 * n) / rows.length)}%` : "n/a");

console.log(`Calls logged:            ${rows.length} (stop-and-review at ${STOP_AFTER})`);
console.log(`No answer:               ${count("no_answer")}`);
console.log(`Voicemail:               ${count("voicemail")}`);
console.log(`Gatekeeper only:         ${count("gatekeeper")}`);
console.log(`Declined:                ${count("declined")}`);
console.log(`Agreed to talk later:    ${agreed}`);
console.log(`Real conversations:      ${talked}  (${pct(talked)} of calls)`);
console.log(`Referrals received:      ${rows.filter((r) => r.referral.trim()).length}`);
console.log(`Do-not-call list:        ${rows.filter((r) => r.do_not_call.toLowerCase() === "yes").length}`);
if (rows.length >= STOP_AFTER) {
  console.log(`\nYou reached ${STOP_AFTER} calls. Stop and review: what did you learn? Change something before calling more.`);
}
