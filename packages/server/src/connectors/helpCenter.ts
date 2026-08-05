import * as cheerio from "cheerio";
import type { Connector, FetchedSource, RawDocument } from "./base.js";

/**
 * Fetches a single help-center article by URL and splits it into
 * heading-scoped documents (one per h1/h2/h3 section) so downstream
 * chunking can respect the article's structure.
 */
export const helpCenterConnector: Connector = {
  type: "help_center",
  async fetch(input: unknown): Promise<FetchedSource> {
    const url = String(input);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header, noscript").remove();

    const title = $("title").first().text().trim() || url;
    const documents: RawDocument[] = [];

    const headingPath: string[] = [];
    const root = $("main").length ? $("main") : $("body");

    let currentHeading = "Introduction";
    let buffer: string[] = [];

    const flush = () => {
      const text = buffer.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      if (text) {
        documents.push({ headingPath: [...headingPath, currentHeading], text });
      }
      buffer = [];
    };

    root.find("h1, h2, h3, p, li").each((_, el) => {
      const tag = (el as { tagName?: string; name?: string }).name ?? "";
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
      if (fallback) documents.push({ headingPath: ["Introduction"], text: fallback });
    }

    return { name: title, origin: url, documents };
  },
};
