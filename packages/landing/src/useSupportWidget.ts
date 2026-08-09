import { useEffect } from "react";
import { API_URL, WIDGET_ORG_KEY, WIDGET_SCRIPT_URL } from "./config";

const SCRIPT_ID = "nexo-support-widget";

export function useSupportWidget() {
  useEffect(() => {
    if (!WIDGET_ORG_KEY) return;
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.dataset.apiUrl = API_URL;
    script.dataset.orgKey = WIDGET_ORG_KEY;
    document.body.appendChild(script);
  }, []);
}
