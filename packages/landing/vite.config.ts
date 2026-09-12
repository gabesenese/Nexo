import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite inlines `import.meta.env.VITE_*` at build time, so an unset variable
 * bakes its localhost fallback into the shipped bundle. Every CTA on this page
 * is one of those URLs, and a build that ships them fails silently: the page
 * renders perfectly and each button points at the visitor's own machine. A
 * production build refuses to run rather than let that reach real traffic.
 */
function assertProductionUrls(env: Record<string, string>) {
  const signupOpen = env.VITE_SIGNUP_OPEN === "true";

  /**
   * With signup open, every start button links at the console, so the console
   * and the API both have to exist. With it closed the page only collects
   * interest, and the one thing it cannot ship without is somewhere for that
   * interest to land.
   */
  const required = signupOpen ? ["VITE_APP_URL", "VITE_API_URL"] : [];
  if (env.VITE_WIDGET_ORG_KEY) {
    required.push("VITE_WIDGET_SCRIPT_URL");
  }

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `A production landing build with signup open needs ${missing.join(", ")}. ` +
        `Without them the build inlines localhost URLs and every call to action breaks. ` +
        `See the landing environment table in README.md.`,
    );
  }

  if (!signupOpen && !env.VITE_LEAD_ENDPOINT && !env.VITE_CONTACT_EMAIL && !env.VITE_API_URL) {
    throw new Error(
      "A production landing build with signup closed needs VITE_LEAD_ENDPOINT or VITE_CONTACT_EMAIL. " +
        "Without one the request form has nowhere to send anything, which is worse than not shipping the page.",
    );
  }

  const urlKeys = ["VITE_APP_URL", "VITE_API_URL", "VITE_WIDGET_SCRIPT_URL", "VITE_LEAD_ENDPOINT"];
  const localhost = urlKeys.filter((key) => env[key]?.includes("localhost"));
  if (localhost.length > 0) {
    throw new Error(
      `A production landing build was given localhost URLs in ${localhost.join(", ")}. ` +
        `Point these at the deployed app instead.`,
    );
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (mode === "production") {
    assertProductionUrls(env);
  }

  return {
    plugins: [react()],
    build: {
      outDir: "dist",
    },
  };
});
