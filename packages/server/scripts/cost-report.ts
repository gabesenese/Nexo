import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { aiMargin, sumCostUsd } from "../src/billing/cost.js";

/**
 * What serving each workspace cost this month against what it pays.
 *
 *   npm run cost:report --workspace=@nexo/server
 *   npm run cost:report --workspace=@nexo/server -- --month 2026-10 --usd-cad 1.39
 *
 * The margin is AI inference only. It leaves out hosting, payment fees, tax and
 * the time spent supporting the customer, so the real margin is lower; read it
 * as the ceiling. Run it after the head-to-head test (`eval/head-to-head`) to
 * see what 20 real questions cost.
 */

/** Keep in step with `packages/landing/src/pricing.ts`, which is where prices are set. */
const PLAN_PRICE_CAD: Record<string, number> = { essentials: 249, professional: 899, growth: 2499 };

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function periodBounds(month: string | undefined) {
  const now = new Date();
  const [y, m] = month ? month.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  if (!y || !m || m < 1 || m > 12) throw new Error(`--month must look like 2026-10, got "${month}"`);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)), label: `${y}-${String(m).padStart(2, "0")}` };
}

const money = (n: number, digits = 2) => n.toLocaleString("en-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits });

async function main() {
  const usdToCad = Number(arg("usd-cad") ?? 1.39);
  const { from, to, label } = periodBounds(arg("month"));

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, plan: true } });
  console.log(`AI cost report for ${label} (1 USD = ${usdToCad} CAD)\n`);

  let anyUnpriced = false;
  let printed = 0;
  for (const org of orgs) {
    const [rows, conversations] = await Promise.all([
      prisma.aiUsage.findMany({ where: { organizationId: org.id, createdAt: { gte: from, lt: to } } }),
      prisma.conversation.count({ where: { organizationId: org.id, createdAt: { gte: from, lt: to } } }),
    ]);
    if (rows.length === 0 && conversations === 0) continue;
    printed += 1;

    const { costUsd, unpricedCalls } = sumCostUsd(rows);
    anyUnpriced ||= unpricedCalls > 0;
    const price = PLAN_PRICE_CAD[org.plan] ?? 0;
    const margin = aiMargin(price, costUsd, usdToCad);
    const answers = rows.filter((r) => r.kind === "answer").length;
    const drafts = rows.filter((r) => r.kind === "draft").length;
    const input = rows.reduce((n, r) => n + r.inputTokens, 0);
    const output = rows.reduce((n, r) => n + r.outputTokens, 0);
    const models = [...new Set(rows.map((r) => r.model))].join(", ") || "-";

    console.log(`${org.name}  (${org.plan}, C$${money(price, 0)}/mo)`);
    console.log(`  conversations        ${conversations}`);
    console.log(`  model calls          ${answers} answers, ${drafts} drafts   (${models})`);
    console.log(`  tokens               ${input.toLocaleString()} in, ${output.toLocaleString()} out`);
    console.log(`  AI cost              US$${money(costUsd, 4)}  =  C$${money(margin.costCad, 4)}${unpricedCalls ? `   (floor: ${unpricedCalls} call(s) on an unpriced model)` : ""}`);
    if (conversations > 0) {
      console.log(`  cost per conversation  C$${money(margin.costCad / conversations, 4)}`);
    }
    if (price > 0) {
      console.log(`  margin on inference  C$${money(margin.marginCad)}${margin.marginPercent === null ? "" : `  (${money(margin.marginPercent, 1)}%)`}`);
    }
    console.log("");
  }

  if (printed === 0) console.log("No conversations or model calls recorded for that month.");
  if (anyUnpriced) {
    console.log("Some calls used a model with no price in billing/cost.ts. Add it there; the totals above are a floor until you do.");
  }
  console.log("Margin counts AI inference only: not hosting, payment fees, tax or support time. Embeddings are not recorded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
