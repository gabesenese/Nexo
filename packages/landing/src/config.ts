const APP_URL = import.meta.env.VITE_APP_URL ?? "http://localhost:5173";

export const ONBOARDING_URL = `${APP_URL}/onboarding`;
export const SIGN_IN_URL = `${APP_URL}/login`;
export const WIDGET_DEMO_URL = import.meta.env.VITE_WIDGET_URL ?? "http://localhost:5174/";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
export const WIDGET_SCRIPT_URL =
  import.meta.env.VITE_WIDGET_SCRIPT_URL ?? "http://localhost:5174/dist/widget.js";
export const WIDGET_ORG_KEY = import.meta.env.VITE_WIDGET_ORG_KEY ?? "";
