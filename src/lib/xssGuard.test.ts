/**
 * XSS guard: no user data may reach dangerous HTML sinks.
 *
 * React JSX escapes text nodes by default; the risk is manual string
 * construction or `dangerouslySetInnerHTML` with data. This used to pin the
 * single file that had one — `app/+html.tsx`, which turned out never to be
 * used by this project's web output and was deleted. The rule outlived it, so
 * it is now enforced across the tree instead of in one place.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

function trackedSources(): string[] {
  return execFileSync("git", ["ls-files", "app", "src", "modules"], { encoding: "utf8" })
    .split("\n")
    // `ls-files` still lists a file deleted but not yet staged.
    .filter((file) => /\.(t|j)sx?$/.test(file) && existsSync(file));
}

test("no source file writes raw HTML at all", () => {
  const offenders = trackedSources().filter((file) => {
    if (file.endsWith("xssGuard.test.ts")) return false;
    const source = readFileSync(file, "utf8");
    return source.includes("dangerouslySetInnerHTML") || /\.innerHTML\s*=/.test(source);
  });
  expect(offenders).toEqual([]);
});
