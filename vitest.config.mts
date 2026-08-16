import { defineConfig } from "vitest/config";

/**
 * Unit tests for the shared, platform-agnostic logic in `src/lib`.
 *
 * Kept separate from the leftover root `vite.config.ts` (which belongs to the
 * old web build and pulls in plugins that are not installed here), so `npm test`
 * runs without the web toolchain.
 */
export default defineConfig({
  test: {
    include: ["src/lib/**/*.test.ts"],
    exclude: ["node_modules/**", "web/**", "tests/**"],
    environment: "node",
  },
});
