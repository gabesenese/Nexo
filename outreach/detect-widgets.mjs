// Checks each company's homepage for the scripts of common chat / support widgets.
//   node detect-widgets.mjs [companies.csv] [--delay 1500]
// Writes widget-scan.csv and prints a table. One GET of the homepage per company, one at a time.
//
// Read the result as a hint, not a verdict:
//   - "none detected" can be wrong. Widgets loaded through Google Tag Manager, after a cookie
//     banner, or only on the Help / Contact page do not appear in the homepage HTML.
//   - A named vendor does not tell you whether the bot is AI-powered. Check by eye (bot-checks.md).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseCsv } from "../eval/head-to-head/lib.mjs";

const SIGNATURES = [
  ["Intercom (may be Fin AI)", /widget\.intercom\.io|intercomSettings|intercom-frame|js\.intercomcdn\.com/i],
  ["Zendesk", /static\.zdassets\.com|zE\(|zopim/i],
  ["HubSpot chat", /js\.usemessages\.com|hs-scripts\.com\/\d+|HubSpotConversations/i],
  ["Drift", /js\.driftt\.com|drift\.com\/include|driftt/i],
  ["Freshchat / Freshworks", /wchat\.freshchat\.com|freshchat|freshworks.*widget/i],
  ["Crisp", /client\.crisp\.chat|\$crisp/i],
  ["LiveChat", /cdn\.livechatinc\.com|__lc\.license/i],
  ["Tidio (Lyro AI)", /code\.tidio\.co|tidiochat/i],
  ["Help Scout Beacon", /beacon-v2\.helpscout\.net|helpscout.*beacon|window\.Beacon/i],
  ["Front chat", /chat-assets\.frontapp\.com/i],
  ["Gorgias", /config\.gorgias\.chat|gorgias-chat/i],
  ["Ada (AI)", /static\.ada\.support|adaEmbed|ada\.cx/i],
  ["Chatbase (AI)", /chatbase\.co\/embed|chatbase\.co\/chatbot-iframe/i],
  ["Botpress (AI)", /cdn\.botpress\.cloud|botpress\.cloud\/webchat/i],
  ["Tawk.to", /embed\.tawk\.to/i],
  ["Salesforce chat", /embeddedservice|service\.force\.com\/embeddedservice/i],
  ["Olark", /static\.olark\.com/i],
  ["Userlike", /userlike-cdn-widgets|userlike\.com/i],
  ["Pylon", /usepylon\.com|widget\.usepylon/i],
  ["Kommunicate", /kommunicate\.io|widget\.kommunicate/i],
];
const TAG_MANAGER = /googletagmanager\.com\/gtm\.js/i;

const args = process.argv.slice(2);
const delayIdx = args.indexOf("--delay");
const delay = delayIdx > -1 ? Number(args[delayIdx + 1]) : 1500;
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--delay") ?? "companies.csv";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const path = new URL(file, import.meta.url);
if (!existsSync(path)) {
  console.error(`${file} not found. Copy companies.template.csv to companies.csv (or kw-seed-companies.csv) first.`);
  process.exit(1);
}

const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const rows = parseCsv(readFileSync(path, "utf8")).filter((r) => r.website?.trim());
const out = [["company", "website", "status", "widgets_detected", "note"]];

for (const r of rows) {
  const site = r.website.trim();
  const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  let status = "ok", widgets = [], note = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; support-widget-check; one request)" },
    });
    status = String(res.status);
    const html = (await res.text()).slice(0, 3_000_000);
    widgets = SIGNATURES.filter(([, re]) => re.test(html)).map(([name]) => name);
    if (!widgets.length) {
      note = TAG_MANAGER.test(html)
        ? "none in HTML, but Google Tag Manager is present and may load one. Check by eye."
        : "none detected on homepage. Check the Help / Contact page and by eye.";
    }
  } catch (e) {
    status = "error";
    note = `could not load: ${e.message}`;
  }
  out.push([r.company, site, status, widgets.join(" | "), note]);
  console.log(`${r.company.padEnd(24)} ${status.padEnd(6)} ${widgets.join(", ") || "-"}${note ? `   (${note})` : ""}`);
  await sleep(delay);
}
writeFileSync(new URL("widget-scan.csv", import.meta.url), out.map((row) => row.map(esc).join(",")).join("\n") + "\n");
console.log("\nWrote widget-scan.csv. Copy findings into the support_widget column, then check by eye.");
