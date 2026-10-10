import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Before running the head-to-head, checks that the workspace actually indexed
 * the pages the questions depend on. The crawler stops at 100 pages and the
 * Plausible docs have more, so a question can fail for a reason that has
 * nothing to do with answer quality: the page was never read.
 *
 *   NEXO_WIDGET_KEY=<workspace widget key> npm run eval:coverage --workspace=@nexo/server
 *
 * Chunks do not store the page they came from, so each answerable and partial
 * question carries a short `check_phrase` that should appear in the text if its
 * page was crawled. That is a check on the whole workspace, not on one page, so a
 * hit means "probably there" and a miss means "almost certainly not".
 */

const prisma = new PrismaClient();
const questionsUrl = new URL("../../../eval/head-to-head/questions.json", import.meta.url);

async function main() {
  const widgetKey = process.env.NEXO_WIDGET_KEY;
  if (!widgetKey) throw new Error("Set NEXO_WIDGET_KEY to the widget key of the workspace holding the corpus (console, Settings).");

  const org = await prisma.organization.findUnique({ where: { widgetKey }, select: { id: true, name: true } });
  if (!org) throw new Error("No workspace has that widget key. Copy it again from Settings in the console.");

  const sources = await prisma.source.findMany({
    where: { organizationId: org.id },
    select: { name: true, origin: true, status: true, pageCount: true, truncated: true, totalChunks: true, notice: true },
  });
  console.log(`Workspace: ${org.name}\n`);
  if (sources.length === 0) {
    console.log("No sources yet. Add the help center in the console (Knowledge) and wait for it to be ready.");
    process.exitCode = 1;
    return;
  }
  for (const s of sources) {
    console.log(`Source: ${s.origin}`);
    console.log(`  status ${s.status}, ${s.pageCount ?? "?"} pages, ${s.totalChunks ?? "?"} chunks${s.truncated ? "  ** CRAWL HIT ITS PAGE CAP **" : ""}`);
    if (s.notice) console.log(`  note: ${s.notice}`);
  }
  const notReady = sources.filter((s) => s.status !== "ready");
  if (notReady.length) console.log(`\n${notReady.length} source(s) are not ready yet. Wait for indexing to finish, then run this again.`);

  const { questions } = JSON.parse(readFileSync(questionsUrl, "utf8")) as {
    questions: { id: string; category: string; check_phrase?: string; source_url?: string }[];
  };
  const checked = questions.filter((q) => q.check_phrase);
  console.log(`\nChecking ${checked.length} question(s) for the text their page should have supplied:\n`);

  let missing = 0;
  for (const q of checked) {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM "Chunk" c
      JOIN "Source" s ON s.id = c."sourceId"
      WHERE s."organizationId" = ${org.id} AND c.content ILIKE ${`%${q.check_phrase}%`}`;
    const hits = rows[0]?.n ?? 0;
    if (hits === 0) missing += 1;
    console.log(`  ${q.id}  ${hits > 0 ? "found  " : "MISSING"}  "${q.check_phrase}"${hits > 0 ? `  (${hits} chunk${hits === 1 ? "" : "s"})` : `   expected from ${q.source_url ?? "its page"}`}`);
  }

  if (missing) {
    console.log(`\n${missing} of ${checked.length} are missing. The pages that answer them were probably not crawled.`);
    console.log("A question on a page Nexo never read tests the crawler, not the answers. Record this in observations.md,");
    console.log("then either leave those questions out of the comparison for every product or give every product the same pages.");
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${checked.length} found. The corpus covers what the questions need.`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
