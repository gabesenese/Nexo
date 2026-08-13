/**
 * URL helpers shared by the crawling connectors. Crawling fetches pages on a
 * workspace's behalf, so — like the webhook target check — we refuse addresses
 * that could probe our own network, and we keep a crawl inside the scope the
 * operator pointed us at rather than wandering the whole internet.
 */

/** File extensions that are never help-center HTML pages worth fetching. */
const NON_PAGE_EXT =
  /\.(pdf|zip|gz|tar|png|jpe?g|gif|svg|webp|ico|mp4|mp3|wav|avi|mov|css|js|json|xml|rss|woff2?|ttf|eot|csv|xlsx?|docx?|pptx?)$/i;

/**
 * A private/loopback host would turn the crawler into an SSRF vector. Mirrors
 * the check in routes/webhooks.ts (literal-hostname posture — same tradeoff).
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const isLoopback =
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^0\./.test(host);
  const isPrivate =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host.endsWith(".internal") ||
    host.endsWith(".local");
  return isLoopback || isPrivate;
}

/**
 * Parses a start URL and returns the scope a crawl is allowed to stay within:
 * the same hostname, and paths under the start URL's directory. A bare origin
 * (path "/") scopes to the whole host.
 */
export interface CrawlScope {
  hostname: string;
  prefix: string;
}

export function scopeFor(startUrl: string): CrawlScope {
  const u = new URL(startUrl);
  const path = u.pathname;
  const prefix = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
  return { hostname: u.hostname.toLowerCase(), prefix: prefix || "/" };
}

/**
 * Resolves a possibly-relative href against a base, strips the fragment, and
 * returns a canonical absolute URL string — or null if it isn't an http(s)
 * page, points at a private host, or is a non-page asset. Query strings are
 * kept (some help centers key articles by query), fragments dropped.
 */
export function normalizeUrl(href: string, base?: string): string | null {
  let u: URL;
  try {
    u = base ? new URL(href, base) : new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isPrivateHost(u.hostname)) return null;
  if (NON_PAGE_EXT.test(u.pathname)) return null;
  u.hash = "";
  // Normalize a bare host to a single "/" path so dupes collapse.
  if (u.pathname === "") u.pathname = "/";
  return u.toString();
}

export function inScope(url: string, scope: CrawlScope): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.hostname.toLowerCase() === scope.hostname && u.pathname.startsWith(scope.prefix);
}
