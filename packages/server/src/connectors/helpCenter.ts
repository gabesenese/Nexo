import * as cheerio from "cheerio";
import type { Connector, FetchedSource, RawDocument } from "./base.js";
import {
  EMPTY_ROBOTS,
  inScope,
  isAllowedByRobots,
  normalizeUrl,
  parseRobotsTxt,
  resolvePublicUrl,
  scopeFor,
  widenScope,
  type CrawlScope,
  type RobotsRules,
} from "./url.js";

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_CHILDREN = 10;
const MAX_REDIRECTS = 5;
const MAX_PAGE_BYTES = 2_000_000;
const MIN_PAGES_BEFORE_WIDENING = 2;
const USER_AGENT = "NexoBot/1.0 (+https://nexo.support/bot)";

export interface FetchedPage {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
}

export interface CrawlOptions {
  maxPages?: number;
  concurrency?: number;
  /** Injectable page fetcher, so the crawl can be unit-tested without network. */
  fetchPage?: (url: string) => Promise<FetchedPage>;
  /** Aborts the crawl between batches and cancels in-flight requests. */
  signal?: AbortSignal;
}

/**
 * Reads at most `limit` bytes, so one oversized document cannot exhaust memory
 * for the whole crawl. A truncated page still parses into usable sections.
 */
async function readBounded(res: Response, limit: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total >= limit) {
      await reader.cancel();
      break;
    }
  }
  return out + decoder.decode();
}

/**
 * Follows redirects by hand, revalidating every hop. Letting fetch follow them
 * would apply the public-address check only to the URL the operator typed, so
 * a public URL that redirects to 169.254.169.254 would pull an internal
 * response into a workspace's knowledge base.
 */
async function defaultFetchPage(url: string, deadline?: AbortSignal): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  if (deadline?.aborted) controller.abort();
  deadline?.addEventListener("abort", abort, { once: true });
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, status: res.status, contentType: "", body: "" };
        const next = resolvePublicUrl(location, current);
        if (!next) {
          throw new Error("Redirected to an address that is not on the public internet.");
        }
        current = next;
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_PAGE_BYTES) return { ok: false, status: res.status, contentType, body: "" };
      return { ok: res.ok, status: res.status, contentType, body: await readBounded(res, MAX_PAGE_BYTES) };
    }
    throw new Error("Too many redirects.");
  } finally {
    clearTimeout(timer);
    deadline?.removeEventListener("abort", abort);
  }
}

/**
 * Parses one HTML page into heading-scoped documents (one per h1/h2/h3
 * section). When a page title is given it's prefixed onto every heading path,
 * so a chunk from a multi-page crawl still records which article it came from.
 */
export function parseHtmlToDocuments(html: string, pageTitle?: string): RawDocument[] {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();

  const root = $("main").length ? $("main") : $("body");
  const prefix = pageTitle ? [pageTitle] : [];
  const documents: RawDocument[] = [];

  let currentHeading = "Introduction";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text) {
      documents.push({ headingPath: [...prefix, currentHeading], text });
    }
    buffer = [];
  };

  root.find("h1, h2, h3, p, li").each((_, el) => {
    const tag = (el as { name?: string }).name ?? "";
    const text = $(el).text().trim();
    if (!text) return;

    if (/^h[1-3]$/.test(tag)) {
      flush();
      currentHeading = text;
    } else {
      buffer.push(text);
    }
  });
  flush();

  if (documents.length === 0) {
    const fallback = root.text().replace(/\s+/g, " ").trim();
    if (fallback) documents.push({ headingPath: [...prefix, "Introduction"], text: fallback });
  }

  return documents;
}

function pageTitleOf(html: string): string | null {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  return title || null;
}

function extractLinks(html: string, baseUrl: string, scope: CrawlScope): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, baseUrl);
    if (normalized && inScope(normalized, scope)) links.add(normalized);
  });
  return [...links];
}

async function fetchRobots(origin: string, fetchPage: (url: string) => Promise<FetchedPage>): Promise<RobotsRules> {
  try {
    const page = await fetchPage(`${origin}/robots.txt`);
    if (!page.ok || !page.body) return EMPTY_ROBOTS;
    return parseRobotsTxt(page.body);
  } catch {
    return EMPTY_ROBOTS;
  }
}

/**
 * Where a sitemap might live, best guess first. robots.txt is authoritative,
 * so its Sitemap lines lead. Otherwise we walk up the start path before
 * falling back to the origin, because hosted help centers commonly publish
 * theirs under their own mount point (Zendesk uses /hc/sitemap.xml) and serve
 * a 404 at /sitemap.xml.
 */
function sitemapCandidates(origin: string, scope: CrawlScope, robots: RobotsRules): string[] {
  const candidates: string[] = [];
  for (const declared of robots.sitemaps) {
    const resolved = resolvePublicUrl(declared, origin);
    if (resolved) candidates.push(resolved);
  }

  let prefix = scope.prefix;
  for (;;) {
    candidates.push(`${origin}${prefix}sitemap.xml`);
    if (prefix === "/") break;
    const withoutTrailing = prefix.slice(0, -1);
    prefix = withoutTrailing.slice(0, withoutTrailing.lastIndexOf("/") + 1) || "/";
  }
  candidates.push(`${origin}/sitemap-index.xml`, `${origin}/sitemap_index.xml`);

  return [...new Set(candidates)];
}

/**
 * Best-effort discovery of every page URL a site advertises. Returns them
 * unfiltered so a widened crawl can reuse the same fetches.
 */
async function collectSitemapLocs(
  origin: string,
  scope: CrawlScope,
  robots: RobotsRules,
  fetchPage: (url: string) => Promise<FetchedPage>,
): Promise<string[]> {
  const found = new Set<string>();

  const readSitemap = async (sitemapUrl: string, allowNested: boolean) => {
    let page: FetchedPage;
    try {
      page = await fetchPage(sitemapUrl);
    } catch {
      return;
    }
    if (!page.ok || !/xml/i.test(page.contentType + page.body.slice(0, 100))) return;

    const $ = cheerio.load(page.body, { xmlMode: true });

    if ($("sitemapindex").length > 0 && allowNested) {
      const children = $("sitemap > loc")
        .map((_, el) => $(el).text().trim())
        .get()
        .slice(0, MAX_SITEMAP_CHILDREN);
      for (const child of children) {
        const resolved = resolvePublicUrl(child, sitemapUrl);
        if (resolved) await readSitemap(resolved, false);
      }
      return;
    }

    $("url > loc").each((_, el) => {
      const normalized = normalizeUrl($(el).text().trim());
      if (normalized) found.add(normalized);
    });
  };

  for (const candidate of sitemapCandidates(origin, scope, robots)) {
    await readSitemap(candidate, true);
    if (found.size > 0) break;
  }

  return [...found];
}

interface CrawlPass {
  documents: RawDocument[];
  sourceName: string | null;
  pagesWithDocuments: number;
  startError: string | null;
}

async function crawlWithin(
  start: string,
  scope: CrawlScope,
  seeds: string[],
  robots: RobotsRules,
  maxPages: number,
  concurrency: number,
  fetchPage: (url: string) => Promise<FetchedPage>,
  signal?: AbortSignal,
): Promise<CrawlPass> {
  const queue: string[] = [start];
  const queued = new Set<string>([start]);
  for (const seed of seeds) {
    if (!queued.has(seed) && inScope(seed, scope) && isAllowedByRobots(seed, robots)) {
      queue.push(seed);
      queued.add(seed);
    }
  }

  const visited = new Set<string>();
  const pass: CrawlPass = { documents: [], sourceName: null, pagesWithDocuments: 0, startError: null };

  const visitOne = async (url: string) => {
    let page: FetchedPage;
    try {
      page = await fetchPage(url);
    } catch (err) {
      if (url === start) pass.startError = (err as Error).message;
      return;
    }
    if (!page.ok) {
      if (url === start) pass.startError = `Failed to fetch ${url}: ${page.status}`;
      return;
    }
    if (!/html/i.test(page.contentType) && page.contentType !== "") return;

    const title = pageTitleOf(page.body);
    if (url === start) pass.sourceName = title ?? new URL(start).hostname;
    const documents = parseHtmlToDocuments(page.body, title ?? undefined);
    if (documents.length > 0) pass.pagesWithDocuments++;
    pass.documents.push(...documents);

    if (queued.size < maxPages) {
      for (const link of extractLinks(page.body, url, scope)) {
        if (queued.size >= maxPages) break;
        if (queued.has(link) || !isAllowedByRobots(link, robots)) continue;
        queue.push(link);
        queued.add(link);
      }
    }
  };

  while (queue.length > 0 && visited.size < maxPages) {
    if (signal?.aborted) break;
    const batch: string[] = [];
    while (batch.length < concurrency && queue.length > 0 && visited.size < maxPages) {
      const next = queue.shift()!;
      if (visited.has(next)) continue;
      visited.add(next);
      batch.push(next);
    }
    await Promise.all(batch.map(visitOne));
  }

  return pass;
}

/**
 * Crawls a help center starting from a URL and returns a single FetchedSource
 * whose documents span every in-scope page reached. Discovery is sitemap-first
 * (fast, complete) with link-following as it fetches, so a site without a
 * sitemap, or one whose landing page renders client-side, is still covered. A
 * crawl stays one Source with many chunks; it must not fan out into many
 * sources, which would blow a workspace's source cap.
 */
export async function crawlHelpCenter(startUrl: string, opts: CrawlOptions = {}): Promise<FetchedSource> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const signal = opts.signal;
  const fetchPage = opts.fetchPage ?? ((url: string) => defaultFetchPage(url, signal));

  const start = normalizeUrl(startUrl);
  if (!start) {
    throw new Error(`${startUrl} is not a fetchable public http(s) URL.`);
  }

  const origin = new URL(start).origin;
  const robots = await fetchRobots(origin, fetchPage);
  let scope = scopeFor(start);
  const seeds = await collectSitemapLocs(origin, scope, robots, fetchPage);

  let pass = await crawlWithin(start, scope, seeds, robots, maxPages, concurrency, fetchPage, signal);

  /**
   * A start URL that is itself an article scopes to a directory holding only
   * that article. Rather than reporting a whole help center as one page, widen
   * to the section containing it and try again.
   */
  while (pass.pagesWithDocuments < MIN_PAGES_BEFORE_WIDENING && !signal?.aborted) {
    const wider = widenScope(scope);
    if (!wider) break;
    scope = wider;
    const widened = await crawlWithin(start, scope, seeds, robots, maxPages, concurrency, fetchPage, signal);
    if (widened.pagesWithDocuments <= pass.pagesWithDocuments) break;
    pass = widened;
  }

  if (pass.documents.length === 0) {
    throw new Error(pass.startError ?? `No readable content found at ${startUrl}.`);
  }

  return {
    name: pass.sourceName ?? new URL(start).hostname,
    origin: start,
    documents: pass.documents,
    pageCount: pass.pagesWithDocuments,
  };
}

export const helpCenterConnector: Connector = {
  type: "help_center",
  async fetch(input: unknown, signal?: AbortSignal): Promise<FetchedSource> {
    return crawlHelpCenter(String(input), { signal });
  },
};
