import { defineConfig } from "vitest/config";

/**
 * Unit tests for the shared, platform-agnostic logic in `src/lib`.
 *
 * The old Vite web build is gone, so this is the only Vitest config left.
 */
export default defineConfig({
  test: {
    include: ["src/lib/**/*.test.ts"],
    exclude: ["node_modules/**"],
    environment: "node",
  },
});
