import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the shared, platform-agnostic logic in `src/lib`.
 *
 * The old Vite web build is gone, so this is the only Vitest config left.
 */
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  // Mirrors the `@/*` alias from tsconfig, so a module under test can import its
  // neighbours the same way the app does.
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    include: ["src/lib/**/*.test.ts"],
    exclude: ["node_modules/**"],
    environment: "node",
  },
});
