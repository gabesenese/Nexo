/**
 * Vite replaces `import.meta.env.DEV` with a literal at build time, so these
 * ternaries fold and the localhost fallbacks are dropped from a production
 * bundle entirely rather than shipping as unreachable strings. The production
 * values are enforced in vite.config.ts, which fails the build without them.
 */
const APP_URL = import.meta.env.VITE_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5173" : "");

export const ONBOARDING_URL = `${APP_URL}/onboarding`;
export const SIGN_IN_URL = `${APP_URL}/login`;
export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");
export const WIDGET_SCRIPT_URL =
  import.meta.env.VITE_WIDGET_SCRIPT_URL ??
  (import.meta.env.DEV ? "http://localhost:5174/dist/widget.js" : "");
export const WIDGET_ORG_KEY = import.meta.env.VITE_WIDGET_ORG_KEY ?? "";

/**
 * Mirrors TRIAL_DAYS in packages/server/src/config/env.ts, which the page
 * states as fact. If the server default moves, this moves with it.
 */
export const TRIAL_DAYS = Number(import.meta.env.VITE_TRIAL_DAYS ?? 14);

/**
 * Signup opens only once the console is deployed and someone can actually
 * finish onboarding. Until then the page collects interest instead, and
 * vite.config.ts refuses to build the combination where a start button points
 * at an app that is not there.
 */
export const SIGNUP_OPEN = (import.meta.env.VITE_SIGNUP_OPEN ?? "") === "true";

/**
 * Where the interest form posts: our own API once it exists, any form endpoint
 * before that. With neither, the form falls back to CONTACT_EMAIL.
 */
export const LEAD_ENDPOINT =
  import.meta.env.VITE_LEAD_ENDPOINT ?? (API_URL ? `${API_URL}/api/leads` : "");

export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? "";

/** CONFIDENCE_THRESHOLD in packages/server/src/config/env.ts. */
export const CONFIDENCE_THRESHOLD = 0.55;
