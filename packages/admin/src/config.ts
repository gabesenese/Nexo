const configured = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * `same-origin` is what the deployed image is built with: the API serves this
 * console from its own origin, so every call is a relative path and one image
 * works on any hostname without a rebuild. Anything else is an absolute origin,
 * which is what a split deploy or local development needs.
 */
export const API_URL = configured === "same-origin" ? "" : configured;

/**
 * The embed snippet is pasted into a customer's own site, so it can never be
 * relative, even when this console's own calls are.
 */
export const PUBLIC_API_ORIGIN = API_URL || window.location.origin;

export const WIDGET_SRC = import.meta.env.VITE_WIDGET_URL ?? `${PUBLIC_API_ORIGIN}/widget.js`;

export function embedSnippet(orgKey: string) {
  return `<script src="${WIDGET_SRC}" data-api-url="${PUBLIC_API_ORIGIN}" data-org-key="${orgKey}"></script>`;
}
