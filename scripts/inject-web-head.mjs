#!/usr/bin/env node
/**
 * Write the head tags into the exported HTML, from the same `webHead.json` the
 * app applies at runtime.
 *
 * `web.output: "single"` means Expo ships its own stock template and every tag
 * this app needs is added by `applyWebDocumentHead` once the bundle boots. Any
 * reader that does not run JavaScript therefore saw a page with no icon, no
 * title card and no preview image — which is every link preview there is. iOS
 * builds the share sheet and the Add to Home Screen icon from that fetch, found
 * nothing, and fell back to tiling a mascot frame across a square.
 *
 * Run after `expo export`, over `dist/index.html`. Idempotent: a tag already in
 * the document is left alone, so re-running it, or running it over a file the
 * runtime pass has also touched, changes nothing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const webHead = JSON.parse(readFileSync(resolve(ROOT, "src/lib/webHead.json"), "utf8"));

const escape = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const attributes = (pairs) =>
  Object.entries(pairs)
    .map(([key, value]) => `${key}="${escape(value)}"`)
    .join(" ");

/** @param {string} html @param {typeof webHead} head */
export function injectWebHead(html, head = webHead) {
  let out = html;

  // Expo's template hardcodes `lang="en"` and a viewport without
  // `viewport-fit`, so these two are replaced rather than appended.
  out = out.replace(/<html([^>]*)\slang="[^"]*"/i, `<html$1 lang="${escape(head.lang)}"`);
  out = out.replace(
    /<meta\s+name="viewport"[^>]*>/i,
    `<meta name="viewport" content="${escape(head.viewport)}" />`,
  );

  const pending = [];
  for (const tag of head.meta) {
    const key = "property" in tag ? "property" : "name";
    if (new RegExp(`<meta[^>]*\\s${key}="${tag[key].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i").test(out)) {
      continue;
    }
    pending.push(`<meta ${attributes({ [key]: tag[key], content: tag.content })} />`);
  }
  for (const link of head.links) {
    if (out.includes(`href="${escape(link.href)}"`)) continue;
    pending.push(`<link ${attributes(link)} />`);
  }

  if (pending.length === 0) return out;
  const closing = out.match(/([ \t]*)<\/head>/i);
  if (!closing) return `${out}\n${pending.join("\n")}`;
  const indent = closing[1];
  const block = pending.map((tag) => `${indent}  ${tag}`).join("\n");
  return out.replace(closing[0], `${block}\n${closing[0]}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const target = resolve(ROOT, process.argv[2] ?? "dist/index.html");
  const before = readFileSync(target, "utf8");
  const after = injectWebHead(before);
  writeFileSync(target, after);
  const added = after.length === before.length ? "already present" : `${after.length - before.length} bytes`;
  console.log(`inject-web-head: ${target} (${added})`);
}
