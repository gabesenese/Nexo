import * as cheerio from "cheerio";
import type { Connector, FetchedSource, RawDocument } from "./base.js";
import { inScope, normalizeUrl, scopeFor, type CrawlScope } from "./url.js";

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_CHILDREN = 10;
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
}

async function defaultFetchPage(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    return { ok: res.ok, status: res.status, contentType, body };
  } finally {
    clearTimeout(timer);
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

/** Best-effort discovery of page URLs from /sitemap.xml (and one level of nested sitemaps). */
async function seedFromSitemap(
  startUrl: string,
  scope: CrawlScope,
  fetchPage: (url: string) => Promise<FetchedPage>,
): Promise<string[]> {
  const origin = new URL(startUrl).origin;
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
    const isIndex = $("sitemapindex").length > 0;

    if (isIndex && allowNested) {
      const children = $("sitemap > loc")
        .map((_, el) => $(el).text().trim())
        .get()
        .slice(0, MAX_SITEMAP_CHILDREN);
      for (const child of children) {
        const normalized = normalizeUrl(child);
        if (normalized) await readSitemap(normalized, false);
      }
      return;
    }

    $("url > loc").each((_, el) => {
      const loc = $(el).text().trim();
      const normalized = normalizeUrl(loc);
      if (normalized && inScope(normalized, scope)) found.add(normalized);
    });
  };

  await readSitemap(`${origin}/sitemap.xml`, true);
  return [...found];
}

/**
 * Crawls a help center starting from a URL and returns a single FetchedSource
 * whose documents span every in-scope page reached. Discovery is sitemap-first
 * (fast, complete) with link-following as it fetches (so it still works on
 * sites without a sitemap). A crawl stays one Source with many chunks — it must
 * not fan out into many sources, which would blow a workspace's source cap.
 */
export async function crawlHelpCenter(startUrl: string, opts: CrawlOptions = {}): Promise<FetchedSource> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const fetchPage = opts.fetchPage ?? defaultFetchPage;

  const start = normalizeUrl(startUrl);
  if (!start) {
    throw new Error(`${startUrl} is not a fetchable public http(s) URL.`);
  }
  const scope = scopeFor(start);

  const seeded = await seedFromSitemap(start, scope, fetchPage);
  const queue: string[] = [start, ...seeded.filter((u) => u !== start)];
  const visited = new Set<string>();
  const documents: RawDocument[] = [];
  let sourceName: string | null = null;
  let firstError: string | null = null;

  const visitOne = async (url: string) => {
    let page: FetchedPage;
    try {
      page = await fetchPage(url);
    } catch (err) {
      if (url === start) firstError = (err as Error).message;
      return;
    }
    if (!page.ok) {
      if (url === start) firstError = `Failed to fetch ${url}: ${page.status}`;
      return;
    }
    if (!/html/i.test(page.contentType) && page.contentType !== "") return;

    const title = pageTitleOf(page.body);
    if (url === start) sourceName = title ?? new URL(start).hostname;
    documents.push(...parseHtmlToDocuments(page.body, title ?? undefined));

    // Discover more in-scope pages as we go, so a missing sitemap isn't fatal.
    if (visited.size + queue.length < maxPages) {
      for (const link of extractLinks(page.body, url, scope)) {
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
    }
  };

  while (queue.length > 0 && visited.size < maxPages) {
    const batch: string[] = [];
    while (batch.length < concurrency && queue.length > 0 && visited.size + batch.length < maxPages) {
      const next = queue.shift()!;
      if (visited.has(next)) continue;
      visited.add(next);
      batch.push(next);
    }
    await Promise.all(batch.map(visitOne));
  }

  if (documents.length === 0) {
    throw new Error(firstError ?? `No readable content found at ${startUrl}.`);
  }

  return { name: sourceName ?? new URL(start).hostname, origin: start, documents };
}

export const helpCenterConnector: Connector = {
  type: "help_center",
  async fetch(input: unknown): Promise<FetchedSource> {
    return crawlHelpCenter(String(input));
  },
};
