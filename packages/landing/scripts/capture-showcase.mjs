/**
 * Regenerates the product screenshots the landing page ships, from the running
 * product against the demo workspace, in both themes.
 *
 *   npm run showcase:capture --workspace=@nexo/landing
 *
 * Needs the dev stack up (`npm run dev`) and the demo workspace seeded
 * (`npm run db:seed:demo --workspace=@nexo/server`).
 *
 * ## What it takes
 *
 * Two panels from the console, one per feature row: the handoff context on a
 * conversation waiting for a person, and the knowledge gaps list. The chats at
 * the top of the page are not screenshots at all; they are rebuilt in HTML so
 * their text stays sharp.
 *
 * Each panel is captured at a 1000px viewport, where it lays out around 700px
 * wide, and the page shows it at about 600px. That keeps the console's 14px
 * text near 12px on screen, readable rather than a thumbnail, and the 2x pixel
 * density on top keeps it sharp. A whole-screen picture shrunk into a frame is
 * what made the old hero look blurred.
 *
 * ## Why it fails loudly
 *
 * Every shot declares what must be on screen before the shutter opens. A
 * missing element exits non-zero rather than republishing a broken page: hand
 * taken screenshots silently rotted as the console changed, which is the
 * problem this exists to end.
 */
import { createRequire } from "module";
import { mkdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire("C:/Users/Gabriel/Desktop/dev/Nexo/package.json");
const { chromium } = require("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../public/product");

const ADMIN = process.env.SHOWCASE_ADMIN_URL ?? "http://localhost:5173";
const API = process.env.SHOWCASE_API_URL ?? "http://localhost:4000";
const EMAIL = process.env.SHOWCASE_EMAIL ?? "demo@meridian.test";
const PASSWORD = process.env.SHOWCASE_PASSWORD ?? "demo-password";

const VIEWPORT = { width: 1000, height: 900 };
const SCALE = 2;
const THEMES = ["light", "dark"];

/** The question the page's second chat tells, so the handoff picture continues the same story. */
const STORY_QUESTION = "Can I get a refund for the seats we didn't use last quarter?";

function fail(message) {
  console.error(`\n  FAILED  ${message}\n`);
  throw new Error(message);
}

/** A capture that races an ease differs run to run, so motion is off rather than waited out. */
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

/**
 * Not "networkidle": the console holds a live update stream open, so the
 * network never goes quiet. Each shot waits for its own elements instead.
 */
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  await page.waitForTimeout(400);
}

async function signedIn(browser, theme) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, reducedMotion: "reduce" });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("nexo-theme", t);
    } catch {
      /* the theme falls back to the system one, and the shot is still the product */
    }
  }, theme);
  const res = await context.request.post(`${API}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { Origin: ADMIN },
  });
  if (!res.ok()) fail(`could not sign in as ${EMAIL} (${res.status()}). Is the dev stack up and the demo seeded?`);
  return context;
}

/**
 * Chosen by what the shot has to show rather than hardcoded, since the demo
 * seed regenerates ids. Sorted so a rerun picks the same conversation.
 */
async function pickWaiting(context) {
  const res = await context.request.get(`${API}/api/conversations`, { headers: { Origin: ADMIN } });
  if (!res.ok()) fail("GET /api/conversations did not return a list; is the API reachable?");
  const rows = [...(await res.json())].sort((a, b) => a.id.localeCompare(b.id));
  const asked = (c) => (c.messages ?? []).find((m) => m.role === "user")?.content;
  const waiting = rows.filter((c) => c.status === "escalated" && (c.messages ?? []).length >= 2);
  const picked = waiting.find((c) => asked(c) === STORY_QUESTION) ?? waiting[0];
  if (!picked) fail("no conversation is waiting on a person, so the handoff shot has nothing to show");
  if (asked(picked) !== STORY_QUESTION) {
    console.warn(`  note: no waiting chat asks "${STORY_QUESTION}", using "${asked(picked)}"`);
  }
  return picked.id;
}

function shots(waiting) {
  return [
    {
      name: "escalate",
      path: `/conversations?id=${waiting}`,
      requires: [".conv-context", ".conv-transcript .msg"],
      viewport: { width: 1000, height: 1400 },
      frame: (page) => page.locator(".conv-detail-card"),
      /** Ends on the last message: the reply box under it is the operator's, not part of the story. */
      until: (page) => page.locator(".conv-transcript .msg").last(),
    },
    {
      name: "gaps",
      path: "/knowledge-gaps",
      requires: ["text=Ranked by how often"],
      frame: (page) => page.locator(".card").filter({ hasText: "Ranked by how often" }).first(),
      maxHeight: 460,
    },
  ];
}

async function capture(page, shot, theme) {
  await page.setViewportSize(shot.viewport ?? VIEWPORT);
  await page.goto(`${ADMIN}${shot.path}`, { waitUntil: "load" });
  await page.addStyleTag({ content: FREEZE_CSS });
  for (const selector of shot.requires) {
    try {
      await page.waitForSelector(selector, { state: "visible", timeout: 15000 });
    } catch {
      fail(`${shot.name}: \`${selector}\` never appeared on ${shot.path}. Either the UI moved and this shot ` +
        `needs updating, or the demo workspace is missing the data it depends on.`);
    }
  }
  await settle(page);

  const frame = shot.frame(page);
  if ((await frame.count()) === 0) fail(`${shot.name}: nothing matched the capture frame on ${shot.path}`);
  const box = await frame.boundingBox();
  if (!box || box.width < 240 || box.height < 60) fail(`${shot.name}: frame too small to be the real UI`);

  /** Exact bounds: the landing frames each crop on the console's own ground, so a margin only adds a neighbour's shadow. */
  let height = shot.maxHeight ? Math.min(box.height, shot.maxHeight) : box.height;
  if (shot.until) {
    const end = await shot.until(page).boundingBox();
    if (end) height = end.y + end.height + 24 - box.y;
  }
  const file = path.join(OUT_DIR, `${shot.name}-${theme}.png`);
  await page.screenshot({ path: file, clip: { x: box.x, y: box.y, width: box.width, height } });
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`  ${path.basename(file).padEnd(20)} ${Math.round(box.width)}x${Math.round(height)} css  ${kb} KB`);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

try {
  console.log(`\nCapturing from ${ADMIN} @${SCALE}x into ${OUT_DIR}\n`);
  const probe = await signedIn(browser, "light");
  const waiting = await pickWaiting(probe);
  await probe.close();

  for (const theme of THEMES) {
    const context = await signedIn(browser, theme);
    const page = await context.newPage();
    for (const shot of shots(waiting)) await capture(page, shot, theme);
    await context.close();
  }
  console.log("");
} finally {
  await browser.close();
}
