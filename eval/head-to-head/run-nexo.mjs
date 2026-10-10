// Asks Nexo every question through its public chat API and fills the nexo rows
// in results.csv. Each question gets a fresh session, so no answer leans on an
// earlier one. Grades are never filled in here; a person grades every product.
//   NEXO_WIDGET_KEY=... [NEXO_URL=http://localhost:4000] node run-nexo.mjs [--delay 1500]
import { randomUUID } from "node:crypto";
import { loadQuestions, readResults, writeResults } from "./lib.mjs";

const base = process.env.NEXO_URL ?? "http://localhost:4000";
const orgKey = process.env.NEXO_WIDGET_KEY;
if (!orgKey) throw new Error("Set NEXO_WIDGET_KEY to the widget key of the workspace holding the corpus.");
const delayIdx = process.argv.indexOf("--delay");
const delay = delayIdx > -1 ? Number(process.argv[delayIdx + 1]) : 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(message, attempt = 0) {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: randomUUID(), orgKey, message }),
  });
  if (res.status === 429 && attempt < 3) {
    await sleep(5000 * (attempt + 1));
    return ask(message, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const resultsUrl = new URL("./results.csv", import.meta.url);
const questions = loadQuestions(new URL("./questions.json", import.meta.url));
const rows = readResults(resultsUrl);

for (const q of questions) {
  const row = rows.find((r) => r.product === "nexo" && r.id === q.id);
  if (!row) throw new Error(`No nexo row for ${q.id}. Run init-sheet.mjs first.`);
  const out = await ask(q.question);
  row.answer = out.answer;
  row.sources_cited = (out.citations ?? []).map((c) => `${c.sourceName} > ${(c.headingPath ?? []).join(" > ")}`).join(" | ");
  row.auto_handoff = out.escalated ? "yes" : "no";
  row.notes = out.confidence == null ? "" : `confidence=${out.confidence}`;
  console.log(`${q.id} ${out.escalated ? "HANDOFF" : "answered"} conf=${out.confidence}`);
  writeResults(resultsUrl, rows);
  await sleep(delay);
}
