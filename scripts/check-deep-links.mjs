#!/usr/bin/env node
/**
 * Checks the deployed site still does what the email links need it to.
 *
 * The offline half of this lives in src/lib/appLinks.test.ts, which proves the
 * links the emails build are claimed by both platforms' claim files. This half
 * proves the deployed site actually serves those files, unchanged, with the
 * content type Apple requires — and that every claimed path answers.
 *
 * The failure it is written for leaves no trace anywhere: a tap opens the
 * browser instead of the app, and nothing logs it.
 *
 *   npm run check:links
 *   npm run check:links -- https://staging.example.com
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { promises as dns } from "node:dns";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv[2] || "https://coupons.itaykarkason.com").replace(/\/+$/, "");
const host = new URL(BASE).host;

const localAasa = JSON.parse(
  readFileSync(join(repoRoot, "public/.well-known/apple-app-site-association"), "utf8")
);

let failures = 0;
const pass = (label, detail = "") => console.log(`  ok   ${label}${detail ? `  ${detail}` : ""}`);
const fail = (label, detail) => {
  failures += 1;
  console.log(`  FAIL ${label}\n         ${detail}`);
};

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
  const body = await res.text();
  return { status: res.status, type: res.headers.get("content-type") || "", body };
}

console.log(`\nchecking ${BASE}\n`);

console.log("dns");
try {
  const addresses = await dns.resolve4(host);
  pass(`${host} resolves`, addresses.join(", "));
} catch (error) {
  fail(`${host} does not resolve`, `${error.code || error.message} — the link is dead everywhere`);
}

console.log("\napple-app-site-association");
try {
  const aasa = await get("/.well-known/apple-app-site-association");
  if (aasa.status !== 200) {
    fail("served", `HTTP ${aasa.status} — iOS falls back to the browser for every link`);
  } else {
    pass("served", "HTTP 200");

    // Apple refuses to parse it as anything else, and a static host that
    // guesses text/plain breaks universal links without a word.
    if (aasa.type.includes("application/json")) pass("content-type", aasa.type);
    else fail("content-type", `${aasa.type || "(none)"} — Apple requires application/json`);

    try {
      const live = JSON.parse(aasa.body);
      const same =
        JSON.stringify(live.applinks.details) === JSON.stringify(localAasa.applinks.details);
      if (same) pass("matches the file in this repo");
      else
        fail(
          "matches the file in this repo",
          "the deployed claim file is not the one the tests checked — redeploy the site"
        );
    } catch {
      fail("valid JSON", "the deployed file did not parse");
    }
  }
} catch (error) {
  fail("apple-app-site-association", error.message);
}

console.log("\nassetlinks.json (Android)");
try {
  const links = await get("/.well-known/assetlinks.json");
  if (links.status !== 200) {
    fail(
      "served",
      `HTTP ${links.status} — Android App Links are never verified, so no link opens the app there`
    );
  } else if (!links.type.includes("application/json")) {
    fail("content-type", `${links.type || "(none)"} — Android requires application/json`);
  } else {
    const parsed = JSON.parse(links.body);
    const fingerprints = parsed.flatMap((e) => e.target?.sha256_cert_fingerprints || []);
    if (fingerprints.length) pass("served", `${fingerprints.length} fingerprint(s)`);
    else fail("fingerprints", "no sha256_cert_fingerprints — Android cannot verify the app");
  }
} catch (error) {
  fail("assetlinks.json", error.message);
}

console.log("\npaths the app claims");
const claimed = localAasa.applinks.details
  .flatMap((detail) => detail.components.map((component) => component["/"]))
  // A wildcard is not a URL; substitute something real to request.
  .map((pattern) => pattern.split("?")[0].replace(/\*/g, "42"))
  .filter((path, index, all) => all.indexOf(path) === index);

for (const path of claimed) {
  try {
    const res = await get(path);
    if (res.status === 200) pass(path, "HTTP 200");
    else fail(path, `HTTP ${res.status} — the app opens, the website behind it 404s`);
  } catch (error) {
    fail(path, error.message);
  }
}

console.log(
  failures === 0
    ? "\nall deep-link checks passed\n"
    : `\n${failures} check(s) failed\n`
);
process.exit(failures === 0 ? 0 : 1);
