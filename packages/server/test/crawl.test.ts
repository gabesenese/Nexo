import { describe, expect, it } from "vitest";
import { crawlHelpCenter, parseHtmlToDocuments, type FetchedPage } from "../src/connectors/helpCenter.js";
import { isAllowedByRobots, parseRobotsTxt, scopeFor, widenScope } from "../src/connectors/url.js";

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

/** Requests for robots.txt and sitemaps are discovery, not crawled pages. */
function pageRequests(calls: string[]): string[] {
  return calls.filter((url) => !/robots\.txt$|sitemap[^/]*\.xml$|sitemap\/\d+\.xml$/i.test(url));
}

function urlset(...locs: string[]): { body: string; contentType: string } {
  return {
    contentType: "application/xml",
    body: `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join("")}</urlset>`,
  };
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
    expect(calls).not.toContain("https://other.com/x");
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

    expect(pageRequests(calls).length).toBeLessThanOrEqual(2);
  });

  it("rejects a private/internal host", async () => {
    await expect(crawlHelpCenter("http://localhost:4000/help")).rejects.toThrow(/public http/i);
  });

  it("throws when the start page cannot be fetched", async () => {
    const { fetchPage } = fakeFetcher({});
    await expect(crawlHelpCenter("https://acme.com/", { fetchPage })).rejects.toThrow();
  });

  it("finds a sitemap mounted under the help center's own path, not just the origin", async () => {
    const { fetchPage, calls } = fakeFetcher({
      "https://support.acme.com/hc/en-us": { body: `<html><head><title>Acme</title></head><body><main></main></body></html>` },
      "https://support.acme.com/hc/sitemap.xml": urlset(
        "https://support.acme.com/hc/en-us/articles/1-refunds",
        "https://support.acme.com/hc/en-us/articles/2-billing",
      ),
      "https://support.acme.com/hc/en-us/articles/1-refunds": { body: article("Refunds", "Refunds", "Within 30 days.") },
      "https://support.acme.com/hc/en-us/articles/2-billing": { body: article("Billing", "Billing", "Charged monthly.") },
    });

    const source = await crawlHelpCenter("https://support.acme.com/hc/en-us", { fetchPage });

    expect(calls).toContain("https://support.acme.com/hc/en-us/articles/1-refunds");
    expect(source.documents.some((d) => d.text.includes("30 days"))).toBe(true);
    expect(source.documents.some((d) => d.text.includes("Charged monthly"))).toBe(true);
  });

  it("follows a nested sitemap index to its child sitemaps", async () => {
    const { fetchPage } = fakeFetcher({
      "https://acme.com/": { body: `<html><head><title>Acme</title></head><body><main></main></body></html>` },
      "https://acme.com/sitemap.xml": {
        contentType: "application/xml",
        body: `<sitemapindex><sitemap><loc>https://acme.com/sitemap/0.xml</loc></sitemap></sitemapindex>`,
      },
      "https://acme.com/sitemap/0.xml": urlset("https://acme.com/a", "https://acme.com/b"),
      "https://acme.com/a": { body: article("A", "A", "First article.") },
      "https://acme.com/b": { body: article("B", "B", "Second article.") },
    });

    const source = await crawlHelpCenter("https://acme.com/", { fetchPage });

    expect(source.documents.some((d) => d.text.includes("First article"))).toBe(true);
    expect(source.documents.some((d) => d.text.includes("Second article"))).toBe(true);
  });

  it("uses the sitemap robots.txt declares", async () => {
    const { fetchPage } = fakeFetcher({
      "https://acme.com/": { body: `<html><head><title>Acme</title></head><body><main></main></body></html>` },
      "https://acme.com/robots.txt": { body: "User-agent: *\nSitemap: https://acme.com/custom-sitemap.xml\n" },
      "https://acme.com/custom-sitemap.xml": urlset("https://acme.com/guide"),
      "https://acme.com/guide": { body: article("Guide", "Guide", "Declared in robots.") },
    });

    const source = await crawlHelpCenter("https://acme.com/", { fetchPage });

    expect(source.documents.some((d) => d.text.includes("Declared in robots"))).toBe(true);
  });

  it("does not fetch paths robots.txt disallows", async () => {
    const { fetchPage, calls } = fakeFetcher({
      "https://acme.com/": {
        body: `<html><head><title>Acme</title></head><body><main><h1>Home</h1><p>Hi.</p><a href="/help/ok">Ok</a><a href="/search?q=x">Search</a></main></body></html>`,
      },
      "https://acme.com/robots.txt": { body: "User-agent: *\nDisallow: /search\n" },
      "https://acme.com/help/ok": { body: article("Ok", "Ok", "Allowed page.") },
      "https://acme.com/search?q=x": { body: article("Search", "Search", "Should not be fetched.") },
    });

    const source = await crawlHelpCenter("https://acme.com/", { fetchPage });

    expect(calls).toContain("https://acme.com/help/ok");
    expect(calls).not.toContain("https://acme.com/search?q=x");
    expect(source.documents.some((d) => d.text.includes("Should not be fetched"))).toBe(false);
  });

  it("widens the scope when the start URL is a single leaf article", async () => {
    const { fetchPage } = fakeFetcher({
      "https://docs.acme.com/en/getting-started/": {
        body: `<html><head><title>Getting started</title></head><body><main><h1>Start</h1><p>Begin here.</p><a href="/en/install/">Install</a></main></body></html>`,
      },
      "https://docs.acme.com/en/install/": { body: article("Install", "Install", "Run the installer.") },
    });

    const source = await crawlHelpCenter("https://docs.acme.com/en/getting-started/", { fetchPage });

    expect(source.documents.some((d) => d.text.includes("Run the installer"))).toBe(true);
  });

  it("keeps a productive narrow scope instead of widening into a sibling section", async () => {
    const { fetchPage, calls } = fakeFetcher({
      "https://acme.com/help/": {
        body: `<html><head><title>Help</title></head><body><main><h1>Help</h1><p>Welcome.</p><a href="/help/a">A</a></main></body></html>`,
      },
      "https://acme.com/help/a": { body: article("A", "A", "In scope.") },
      "https://acme.com/blog/b": { body: article("B", "B", "Out of scope.") },
    });

    await crawlHelpCenter("https://acme.com/help/", { fetchPage });

    expect(calls).not.toContain("https://acme.com/blog/b");
  });
});

describe("crawl scope", () => {
  it("scopes a trailing slash and a bare path the same way", () => {
    expect(scopeFor("https://a.com/hc/en-us").prefix).toBe("/hc/en-us/");
    expect(scopeFor("https://a.com/hc/en-us/").prefix).toBe("/hc/en-us/");
  });

  it("keeps a locale section out of its siblings", () => {
    const scope = scopeFor("https://a.com/hc/en-us");
    expect(scope.prefix).toBe("/hc/en-us/");
    expect(widenScope(scope)?.prefix).toBe("/hc/");
    expect(widenScope({ hostname: "a.com", prefix: "/" })).toBeNull();
  });
});

describe("robots.txt", () => {
  it("applies only the groups addressed to us", () => {
    const rules = parseRobotsTxt("User-agent: AppleBot\nDisallow: /tickets\n\nUser-agent: *\nDisallow: /users\n");
    expect(isAllowedByRobots("https://a.com/tickets/1", rules)).toBe(true);
    expect(isAllowedByRobots("https://a.com/users/1", rules)).toBe(false);
  });

  it("lets a more specific Allow override a broader Disallow", () => {
    const rules = parseRobotsTxt("User-agent: *\nDisallow: /hc\nAllow: /hc/en-us\n");
    expect(isAllowedByRobots("https://a.com/hc/de", rules)).toBe(false);
    expect(isAllowedByRobots("https://a.com/hc/en-us/articles/1", rules)).toBe(true);
  });

  it("collects Sitemap lines regardless of grouping", () => {
    const rules = parseRobotsTxt("Sitemap: https://a.com/s1.xml\nUser-agent: *\nDisallow:\nSitemap: https://a.com/s2.xml\n");
    expect(rules.sitemaps).toEqual(["https://a.com/s1.xml", "https://a.com/s2.xml"]);
  });
});
