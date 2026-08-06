import { createRoot } from "react-dom/client";
import { Widget } from "./Widget";

declare global {
  interface Window {
    NEXO_API_URL?: string;
  }
}

const scriptEl = document.currentScript as HTMLScriptElement | null;
const apiUrl = scriptEl?.dataset.apiUrl ?? window.NEXO_API_URL ?? "http://localhost:4000";

const fontLinkId = "nexo-widget-fonts";
if (!document.getElementById(fontLinkId)) {
  const link = document.createElement("link");
  link.id = fontLinkId;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
  document.head.appendChild(link);
}

const containerId = "nexo-widget-root";
let container = document.getElementById(containerId);
if (!container) {
  container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);
}

createRoot(container).render(<Widget apiUrl={apiUrl} />);
