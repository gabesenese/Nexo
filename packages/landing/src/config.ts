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
