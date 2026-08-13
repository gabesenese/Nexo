import { describe, expect, it } from "vitest";
import { crawlHelpCenter, parseHtmlToDocuments, type FetchedPage } from "../src/connectors/helpCenter.js";

/** Builds an injectable fetchPage from a map of url -> {body, contentType}. */
function fakeFetcher(pages: Record<string, { body: string; contentType?: string }>) {
  const calls: string[] = [];
  const fetchPage = async (url: string): Promise<FetchedPage> => {
    calls.push(url);
    const page = pages[url];
    if (!page) return { ok: false, status: 404, contentType: "text/html", body: "" };
    return { ok: true, status: 200, contentType: page.contentType ?? "text/html", body: page.body };
  };
  return { fetchPage, calls };
}

function article(title: string, heading: string, body: string): string {
  return `<html><head><title>${title}</title></head><body><main><h1>${heading}</h1><p>${body}</p></main></body></html>`;
}

describe("parseHtmlToDocuments", () => {
  it("prefixes the page title onto every heading path", () => {
    const docs = parseHtmlToDocuments(article("Refunds", "How refunds work", "We refund within 30 days."), "Refunds");
    expect(docs).toHaveLength(1);
    expect(docs[0].headingPath).toEqual(["Refunds", "How refunds work"]);
    expect(docs[0].text).toContain("30 days");
  });

  it("omits the title prefix when none is given", () => {
    const docs = parseHtmlToDocuments("<body><h2>Plans</h2><p>Three tiers.</p></body>");
    expect(docs[0].headingPath).toEqual(["Plans"]);
  });
});

describe("crawlHelpCenter", () => {
  it("discovers pages from sitemap.xml and combines their documents into one source", async () => {
    const { fetchPage } = fakeFetcher({
      "https://help.acme.com/": { body: article("Acme Help", "Welcome", "Start here.") },
      "https://help.acme.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<urlset><url><loc>https://help.acme.com/</loc></url><url><loc>https://help.acme.com/refunds</loc></url><url><loc>https://help.acme.com/billing</loc></url></urlset>`,
      },
      "https://help.acme.com/refunds": { body: article("Refunds", "Refunds", "Refunded in 30 days.") },
      "https://help.acme.com/billing": { body: article("Billing", "Billing", "Charged monthly.") },
    });

    const source = await crawlHelpCenter("https://help.acme.com/", { fetchPage });

    expect(source.name).toBe("Acme Help");
    expect(source.origin).toBe("https://help.acme.com/");
    const headings = source.documents.map((d) => d.headingPath.join(" / "));
    expect(headings).toContain("Refunds / Refunds");
    expect(headings).toContain("Billing / Billing");
    expect(source.documents.some((d) => d.text.includes("30 days"))).toBe(true);
  });

  it("follows in-scope links when there is no sitemap", async () => {
    const { fetchPage, calls } = fakeFetcher({
      "https://docs.acme.com/": {
        body: `<html><head><title>Docs</title></head><body><main><h1>Home</h1><p>Hi.</p><a href="/guide">Guide</a><a href="https://other.com/x">External</a></main></body></html>`,
      },
      "https://docs.acme.com/guide": { body: article("Guide", "Guide", "Follow these steps.") },
    });

    const source = await crawlHelpCenter("https://docs.acme.com/", { fetchPage });

    expect(calls).toContain("https://docs.acme.com/guide");
    expect(calls).not.toContain("https://other.com/x"); // external, out of scope
    expect(source.documents.some((d) => d.text.includes("Follow these steps"))).toBe(true);
  });

  it("stays within the start URL's path scope", async () => {
    const { fetchPage, calls } = fakeFetcher({
      "https://acme.com/help/": {
        body: `<html><head><title>Help</title></head><body><main><h1>Help</h1><a href="/help/a">A</a><a href="/blog/b">B</a></main></body></html>`,
      },
      "https://acme.com/help/a": { body: article("A", "A", "In scope.") },
      "https://acme.com/blog/b": { body: article("B", "B", "Out of scope.") },
    });

    await crawlHelpCenter("https://acme.com/help/", { fetchPage });

    expect(calls).toContain("https://acme.com/help/a");
    expect(calls).not.toContain("https://acme.com/blog/b");
  });

  it("honors the maxPages cap", async () => {
    const pages: Record<string, { body: string }> = {
      "https://acme.com/": {
        body: `<body><main><h1>Home</h1><a href="/1">1</a><a href="/2">2</a><a href="/3">3</a><a href="/4">4</a></main></body>`,
      },
    };
    for (const n of [1, 2, 3, 4]) pages[`https://acme.com/${n}`] = { body: article(`P${n}`, `P${n}`, `Page ${n}.`) };
    const { fetchPage, calls } = fakeFetcher(pages);

    await crawlHelpCenter("https://acme.com/", { fetchPage, maxPages: 2 });

    expect(calls.filter((u) => !u.endsWith("sitemap.xml")).length).toBeLessThanOrEqual(2);
  });

  it("rejects a private/internal host", async () => {
    await expect(crawlHelpCenter("http://localhost:4000/help")).rejects.toThrow(/public http/i);
  });

  it("throws when the start page cannot be fetched", async () => {
    const { fetchPage } = fakeFetcher({}); // every fetch 404s
    await expect(crawlHelpCenter("https://acme.com/", { fetchPage })).rejects.toThrow();
  });
});
