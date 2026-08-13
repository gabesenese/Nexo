import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The same guard the landing build has had since PR #46, which the console
 * never got.
 *
 * Vite inlines `import.meta.env.VITE_*` at build time, so an unset variable
 * bakes its localhost fallback into the shipped bundle. Verified before adding
 * this: a production build with no VITE_API_URL succeeded and shipped
 * `http://localhost:4000` in the JavaScript.
 *
 * That failure is worse here than on the landing page. The console renders
 * completely, signs nobody in, and every request goes to the operator's own
 * machine, so it looks like the API is down rather than like a misconfigured
 * deploy. Refusing to build is the only point at which it is obvious.
 */
function assertProductionUrls(env: Record<string, string>) {
  /** Everything the console does goes through the API, so this is unconditional. */
  const required = ["VITE_API_URL"];

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `A production admin build needs ${missing.join(", ")}. ` +
        `Without it the build inlines http://localhost:4000 and the console cannot reach the API. ` +
        `See the deploy section in README.md.`,
    );
  }

  /**
   * VITE_WIDGET_URL is optional: it defaults to `${VITE_API_URL}/widget.js`,
   * which is where the server serves it from, so an unset value is correct
   * rather than missing. It is still checked for localhost, because a stale
   * one would hand customers an install snippet pointing at nothing.
   */
  const checked = [...required, "VITE_WIDGET_URL"];
  const localhost = checked.filter((key) => env[key]?.includes("localhost"));
  if (localhost.length > 0) {
    throw new Error(
      `A production admin build was given localhost URLs in ${localhost.join(", ")}. ` +
        `Point these at the deployed API instead.`,
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
  };
});
