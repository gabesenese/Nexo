// Creates results.csv with one blank row per product per question, so every
// product is graded on the same rows. Usage:
//   node init-sheet.mjs [products...]   (default: nexo fin chatbase tidio)
import { loadQuestions, writeResults } from "./lib.mjs";

const products = process.argv.slice(2);
if (!products.length) products.push("nexo", "fin", "chatbase", "tidio");

const questions = loadQuestions(new URL("./questions.json", import.meta.url));
const rows = products.flatMap((product) =>
  questions.map((q) => ({ product, id: q.id, category: q.category, question: q.question })),
);
writeResults(new URL("./results.csv", import.meta.url), rows);
console.log(`results.csv: ${rows.length} rows (${products.join(", ")} x ${questions.length} questions)`);
