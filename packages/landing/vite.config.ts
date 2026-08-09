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
  /** VITE_API_URL is unconditional: the "Talk to us" form posts leads to it. */
  const required = ["VITE_APP_URL", "VITE_WIDGET_URL", "VITE_API_URL"];
  if (env.VITE_WIDGET_ORG_KEY) {
    required.push("VITE_WIDGET_SCRIPT_URL");
  }

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `A production landing build needs ${missing.join(", ")}. ` +
        `Without them the build inlines localhost URLs and every call to action breaks. ` +
        `See the landing environment table in README.md.`,
    );
  }

  const localhost = required.filter((key) => env[key]?.includes("localhost"));
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
