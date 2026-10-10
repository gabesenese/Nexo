// Reads the graded results.csv and prints one scorecard per product.
//   node summarize.mjs
//
// Grades (set by a person, per row):
//   correct  - answered, and the answer matches the expected answer
//   wrong    - answered, but wrong, invented, or contradicting the source
//   handoff  - declined and offered a person instead of answering
// citation_ok (y/n) - the cited source really supports the answer.
import { GRADES, readResults } from "./lib.mjs";

const rows = readResults(new URL("./results.csv", import.meta.url));
const ungraded = rows.filter((r) => !GRADES.includes(r.grade));
if (ungraded.length) {
  console.log(`Warning: ${ungraded.length} rows have no valid grade and are excluded.\n`);
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}% (${n}/${d})` : "n/a");

for (const product of [...new Set(rows.map((r) => r.product))]) {
  const mine = rows.filter((r) => r.product === product && GRADES.includes(r.grade));
  const by = (cat) => mine.filter((r) => r.category === cat);
  const count = (list, grade) => list.filter((r) => r.grade === grade).length;
  const ans = by("answerable"), part = by("partial"), none = by("unanswerable");
  const answered = mine.filter((r) => r.grade !== "handoff");
  const cited = answered.filter((r) => r.citation_ok === "y" || r.citation_ok === "n");

  const good = count(ans, "correct") + count(part, "correct") + count(part, "handoff") + count(none, "handoff");
  console.log(`== ${product}  (${mine.length} graded)`);
  console.log(`  Overall safe-and-useful     ${pct(good, mine.length)}`);
  console.log(`  Answerable: correct         ${pct(count(ans, "correct"), ans.length)}`);
  console.log(`  Answerable: needless handoff ${pct(count(ans, "handoff"), ans.length)}`);
  console.log(`  Partial: not invented       ${pct(count(part, "correct") + count(part, "handoff"), part.length)}`);
  console.log(`  Unanswerable: handed off    ${pct(count(none, "handoff"), none.length)}`);
  console.log(`  Wrong answers (any kind)    ${pct(count(mine, "wrong"), mine.length)}`);
  console.log(`  Citations that hold up      ${pct(cited.filter((r) => r.citation_ok === "y").length, cited.length)}\n`);
}
