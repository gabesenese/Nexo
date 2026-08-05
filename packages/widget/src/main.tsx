import { createRoot } from "react-dom/client";
import { Widget } from "./Widget";

declare global {
  interface Window {
    NEXO_API_URL?: string;
  }
}

const scriptEl = document.currentScript as HTMLScriptElement | null;
const apiUrl = scriptEl?.dataset.apiUrl ?? window.NEXO_API_URL ?? "http://localhost:4000";

const containerId = "nexo-widget-root";
let container = document.getElementById(containerId);
if (!container) {
  container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);
}

createRoot(container).render(<Widget apiUrl={apiUrl} />);
