import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    /**
     * The integration suites share one test database and truncate it between
     * cases, so running two files at once lets one wipe the rows another is
     * midway through asserting on.
     */
    fileParallelism: false,
  },
});
