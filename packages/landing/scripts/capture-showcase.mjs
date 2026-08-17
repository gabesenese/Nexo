/**
 * Regenerates the product screenshots the landing page ships, from the running
 * product against the demo workspace.
 *
 *   npm run showcase:capture --workspace=@nexo/landing
 *
 * Needs the dev stack up (`npm run dev`) and the demo workspace seeded
 * (`npm run db:seed:demo --workspace=@nexo/server`).
 *
 * ## Why these are small, focused crops rather than whole pages
 *
 * A screenshot is readable on the landing page only when the width it was
 * captured at is close to the width it is displayed at. The showcase frame is
 * roughly 540px wide, so a capture of a 2200px-wide admin page arrives scaled
 * to a quarter size and its 14px type renders at about 4px. That is exactly why
 * the previous whole-page captures could not be read: not resolution, not
 * pixel density, just ratio.
 *
 * So each shot is one card or one panel, captured at a 1000px viewport where
 * those elements lay out around 700px wide. Displayed at 540px that is a 0.77
 * scale, which keeps body text near 11px on screen. The pixel density is 2x on
 * top of that, so the result is sharp rather than merely large.
 *
 * ## Why it fails loudly
 *
 * Every shot declares what must be on screen before the shutter opens. A
 * missing element exits non-zero rather than republishing a broken page: the
 * previous screenshots were taken by hand and silently rotted as the console
 * changed, which is the problem this exists to end.
 */
import { createRequire } from "module";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire("C:/Users/Gabriel/Desktop/dev/Nexo/package.json");
const { chromium } = require("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../public/showcase");

const ADMIN = process.env.SHOWCASE_ADMIN_URL ?? "http://localhost:5173";
const API = process.env.SHOWCASE_API_URL ?? "http://localhost:4000";
const EMAIL = process.env.SHOWCASE_EMAIL ?? "demo@meridian.test";
const PASSWORD = process.env.SHOWCASE_PASSWORD ?? "demo-password";

/** Narrow enough that cards lay out near the width the landing page shows them at. */
const VIEWPORT = { width: 1000, height: 900 };
const SCALE = 2;

/** What the landing page's mock frame is roughly wide, used only to report the resulting scale. */
const FRAME_WIDTH = 540;

function fail(message) {
  console.error(`\n  FAILED  ${message}\n`);
  throw new Error(message);
}

/** A capture that races a 150ms ease differs run to run, so motion is off rather than waited out. */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  * { caret-color: transparent !important; }
`;

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  await page.waitForTimeout(250);
}

async function login(page) {
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForSelector("nav", { timeout: 20000 });
  } catch {
    fail(`could not sign in as ${EMAIL}. Is the dev stack up and the demo workspace seeded?`);
  }
}

/**
 * Chosen by what each shot has to prove rather than hardcoded, since the demo
 * seed regenerates ids. Sorted so a rerun picks the same conversation.
 */
async function pickConversations(page) {
  const rows = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/api/conversations`, { credentials: "include" });
    return res.ok ? res.json() : null;
  }, API);
  if (!rows) fail("GET /api/conversations did not return a list; is the API reachable?");

  const byId = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const messages = (c) => c.messages ?? [];
  const grounded = (c) =>
    messages(c).some((m) => m.role === "assistant" && m.citations?.length > 0 && m.confidence != null);
  const handedOver = (c) => c.status === "escalated" || (c.escalations ?? []).length > 0;

  const answered = byId.find((c) => !handedOver(c) && grounded(c));
  if (!answered) {
    fail("no conversation has an assistant answer with citations and a confidence score, which is what " +
      "`answer` exists to show. Reseed: npm run db:seed:demo --workspace=@nexo/server");
  }
  const escalated = byId.find(handedOver);
  if (!escalated) fail("no conversation was ever handed to a human, so `escalate` has nothing to show");

  return { answered: answered.id, escalated: escalated.id };
}

function shots({ answered, escalated }) {
  return [
    {
      name: "teach",
      what: "the sources Nexo answers from",
      path: "/sources",
      requires: ["text=Ingested sources"],
      frame: (page) => page.locator(".card").filter({ hasText: "Ingested sources" }).first(),
    },
    {
      name: "answer",
      what: "a grounded answer, cited and scored",
      path: `/conversations?id=${answered}`,
      requires: [".conv-transcript"],
      frame: (page) => page.locator(".conv-transcript"),
      maxHeight: 430,
    },
    {
      name: "escalate",
      what: "why Nexo handed this one over",
      path: `/conversations?id=${escalated}`,
      requires: [".conv-context"],
      frame: (page) => page.locator(".conv-context"),
    },
    {
      name: "operate",
      what: "the queue a team works from",
      path: "/",
      requires: [".status-strip", "text=Needs attention"],
      frame: (page) => page.locator(".card").filter({ hasText: "Needs attention" }).first(),
      maxHeight: 430,
    },
  ];
}

async function capture(page, shot) {
  await page.goto(`${ADMIN}${shot.path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: FREEZE_CSS });

  for (const selector of shot.requires) {
    try {
      await page.waitForSelector(selector, { state: "visible", timeout: 15000 });
    } catch {
      fail(`${shot.name}: required element \`${selector}\` never appeared on ${shot.path}. Either the UI ` +
        `moved and this shot needs updating, or the demo workspace is missing the data it depends on.`);
    }
  }

  await settle(page);

  const frame = shot.frame(page);
  if ((await frame.count()) === 0) fail(`${shot.name}: nothing matched the capture frame on ${shot.path}`);

  const box = await frame.boundingBox();
  if (!box || box.width < 240 || box.height < 100) {
    fail(`${shot.name}: frame is ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "not visible"}, ` +
      `too small to be the real UI`);
  }

  const file = path.join(OUT_DIR, `${shot.name}.png`);
  const height = shot.maxHeight ? Math.min(box.height, shot.maxHeight) : box.height;

  /** Cropping is declared here, where the intent is written down, rather than left to CSS. */
  if (height < box.height) {
    await page.screenshot({ path: file, clip: { x: box.x, y: box.y, width: box.width, height } });
  } else {
    await frame.screenshot({ path: file });
  }

  const scale = FRAME_WIDTH / box.width;
  const bodyText = (14 * scale).toFixed(1);
  console.log(
    `  ${shot.name.padEnd(9)} ${String(Math.round(box.width)).padStart(4)}x${String(Math.round(height)).padEnd(4)} css` +
      `  ->  ${scale.toFixed(2)}x in a ${FRAME_WIDTH}px frame, 14px type reads at ${bodyText}px   ${shot.what}`,
  );
  if (scale < 0.6) {
    console.log(`             warning: ${shot.name} is captured too wide to stay legible at ${FRAME_WIDTH}px`);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  reducedMotion: "reduce",
  colorScheme: "light",
});
const page = await context.newPage();

try {
  console.log(`\nCapturing from ${ADMIN} at ${VIEWPORT.width}px wide @${SCALE}x\n`);
  await login(page);
  for (const shot of shots(await pickConversations(page))) await capture(page, shot);
  console.log(`\nWrote ${OUT_DIR}\n`);
} finally {
  await browser.close();
}
