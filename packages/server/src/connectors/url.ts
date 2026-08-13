/**
 * URL helpers shared by the crawling connectors. Crawling fetches pages on a
 * workspace's behalf, so, like the webhook target check, we refuse addresses
 * that could probe our own network, and we keep a crawl inside the scope the
 * operator pointed us at rather than wandering the whole internet.
 */

/** File extensions that are never help-center HTML pages worth fetching. */
const NON_PAGE_EXT =
  /\.(pdf|zip|gz|tar|png|jpe?g|gif|svg|webp|ico|mp4|mp3|wav|avi|mov|css|js|json|xml|rss|woff2?|ttf|eot|csv|xlsx?|docx?|pptx?)$/i;

/**
 * A private/loopback host would turn the crawler into an SSRF vector. Mirrors
 * the check in routes/webhooks.ts (literal-hostname posture, same tradeoff).
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
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
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe80:/.test(host) ||
    host.endsWith(".internal") ||
    host.endsWith(".local");
  return isLoopback || isPrivate;
}

export interface CrawlScope {
  hostname: string;
  prefix: string;
}

/**
 * The scope a crawl may stay within: the same hostname, and paths under the
 * start URL treated as a directory. Treating the start path as a directory
 * rather than splitting on its last slash is what keeps a trailing slash from
 * changing the answer: "/hc/en-us" and "/hc/en-us/" both scope to the articles
 * beneath them, and neither reaches a sibling locale.
 */
export function scopeFor(startUrl: string): CrawlScope {
  const u = new URL(startUrl);
  const path = u.pathname || "/";
  return { hostname: u.hostname.toLowerCase(), prefix: path.endsWith("/") ? path : `${path}/` };
}

/**
 * The next scope out, or null at the host root. A start URL that turns out to
 * be a leaf article scopes to a directory containing only itself, so the crawl
 * widens one level at a time rather than reporting a whole help center as a
 * single page.
 */
export function widenScope(scope: CrawlScope): CrawlScope | null {
  if (scope.prefix === "/") return null;
  const withoutTrailing = scope.prefix.slice(0, -1);
  const parent = withoutTrailing.slice(0, withoutTrailing.lastIndexOf("/") + 1);
  return { hostname: scope.hostname, prefix: parent || "/" };
}

/**
 * Resolves a possibly-relative href against a base and returns a canonical
 * absolute URL, or null if it is not an http(s) address we are willing to
 * request. Applies to every URL we fetch, including redirect targets and
 * sitemaps, so it deliberately does not filter by file extension.
 */
export function resolvePublicUrl(href: string, base?: string): string | null {
  let u: URL;
  try {
    u = base ? new URL(href, base) : new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isPrivateHost(u.hostname)) return null;
  u.hash = "";
  if (u.pathname === "") u.pathname = "/";
  return u.toString();
}

/**
 * A public URL that is also worth parsing as a page. Query strings are kept
 * (some help centers key articles by query), fragments dropped.
 */
export function normalizeUrl(href: string, base?: string): string | null {
  const resolved = resolvePublicUrl(href, base);
  if (!resolved) return null;
  if (NON_PAGE_EXT.test(new URL(resolved).pathname)) return null;
  return resolved;
}

export function inScope(url: string, scope: CrawlScope): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.hostname.toLowerCase() !== scope.hostname) return false;
  const path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
  return path.startsWith(scope.prefix);
}

export interface RobotsRules {
  allow: string[];
  disallow: string[];
  sitemaps: string[];
}

export const EMPTY_ROBOTS: RobotsRules = { allow: [], disallow: [], sitemaps: [] };

/**
 * Reads the rules that apply to us out of a robots.txt: the Sitemap lines
 * (which is how a site actually declares where its sitemap lives) and the
 * Allow/Disallow paths from the groups addressed to "*" or to us by name.
 */
export function parseRobotsTxt(text: string, userAgent = "nexobot"): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], sitemaps: [] };
  const agent = userAgent.toLowerCase();
  let groupAgents: string[] = [];
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "sitemap") {
      if (value) rules.sitemaps.push(value);
      continue;
    }
    if (field === "user-agent") {
      if (!lastLineWasAgent) groupAgents = [];
      groupAgents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (field !== "allow" && field !== "disallow") continue;
    const applies = groupAgents.some((a) => a === "*" || agent.startsWith(a));
    if (!applies || !value) continue;
    if (field === "allow") rules.allow.push(value);
    else rules.disallow.push(value);
  }

  return rules;
}

function matchLength(path: string, rule: string): number {
  const [literal] = rule.split("*");
  if (rule.includes("*")) {
    const pattern = rule
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${pattern}`).test(path) ? literal.length : -1;
  }
  return path.startsWith(rule) ? rule.length : -1;
}

/** Longest matching rule wins, with Allow beating Disallow on a tie. */
export function isAllowedByRobots(url: string, rules: RobotsRules): boolean {
  let path: string;
  try {
    const u = new URL(url);
    path = u.pathname + u.search;
  } catch {
    return false;
  }
  let allowed = -1;
  let denied = -1;
  for (const rule of rules.allow) allowed = Math.max(allowed, matchLength(path, rule));
  for (const rule of rules.disallow) denied = Math.max(denied, matchLength(path, rule));
  return denied === -1 || allowed >= denied;
}
