// Shared helpers for the head-to-head kit. No dependencies, Node 20+.
import { readFileSync, writeFileSync } from "node:fs";

export const CATEGORIES = { answerable: 12, partial: 4, unanswerable: 4 };
export const GRADES = ["correct", "wrong", "handoff"];
export const COLUMNS = [
  "product", "id", "category", "question", "answer", "sources_cited",
  "auto_handoff", "grade", "citation_ok", "notes",
];

export function loadQuestions(path) {
  const questions = JSON.parse(readFileSync(path, "utf8")).questions;
  const problems = [];
  const counts = {};
  for (const q of questions) {
    counts[q.category] = (counts[q.category] ?? 0) + 1;
    if (!q.question?.trim()) problems.push(`${q.id}: question is empty`);
    if (q.category !== "unanswerable" && !q.expected?.trim()) problems.push(`${q.id}: expected answer is empty`);
    if (q.category !== "unanswerable" && !q.source_url?.trim()) problems.push(`${q.id}: source_url is empty`);
  }
  for (const [cat, n] of Object.entries(CATEGORIES)) {
    if (counts[cat] !== n) problems.push(`expected ${n} "${cat}" questions, found ${counts[cat] ?? 0}`);
  }
  if (problems.length) {
    throw new Error(`questions file is not ready:\n  - ${problems.join("\n  - ")}`);
  }
  return questions;
}

export function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function readResults(path) {
  return parseCsv(readFileSync(path, "utf8"));
}
export function writeResults(path, rows) {
  writeFileSync(path, toCsv(rows));
}
