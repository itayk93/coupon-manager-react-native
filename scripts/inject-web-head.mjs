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
 * It also writes the launch screen into the body. iOS shows the matching
 * `apple-touch-startup-image` from tap until the page's first paint, and the
 * page Expo ships is an empty white root until the bundle boots — so without
 * this the branded launch ends in a white screen, which is most of the wait.
 * `hideWebBootSplash` takes it down once the app is ready.
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
/** One link per device size, written by `scripts/build-pwa-splash.py`. */
export const startupImages = JSON.parse(
  readFileSync(resolve(ROOT, "src/lib/webHeadStartupImages.json"), "utf8"),
);

/** The native splash's own background and the brand blue, from `theme.ts`. */
const BRAND_TINT = "#e8f2fd";
const BRAND_BLUE = "#1f6fd1";
/** Written by `scripts/build-pwa-splash.py`, beside the iOS launch images. */
const BOOT_WORDMARK = "/splash/wordmark.png";

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
  for (const link of [...head.links, ...startupImages]) {
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

/**
 * The launch screen, in the document itself.
 *
 * Deliberately static: it is the same wordmark on the same tint at the same
 * 240pt the iOS launch image and the native splash draw, so the handover from
 * one to the other is invisible. The spinner only fades in once the wait is
 * long enough to be worth admitting to, which is what the native launch does.
 *
 * @param {string} html @param {typeof webHead} head
 */
export function injectBootSplash(html, head = webHead) {
  if (html.includes('id="boot-splash"')) return html;

  const style = `<style id="boot-splash-style">
      html, body { background-color: ${BRAND_TINT}; }
      #boot-splash {
        position: fixed; inset: 0; z-index: 2147483646;
        display: flex; align-items: center; justify-content: center;
        background-color: ${BRAND_TINT};
        transition: opacity 220ms ease-out;
      }
      #boot-splash.boot-splash--done { opacity: 0; pointer-events: none; }
      #boot-splash img { width: 240px; height: 240px; }
      #boot-splash .boot-splash__spinner {
        position: absolute; bottom: 96px;
        bottom: calc(96px + env(safe-area-inset-bottom));
        width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%;
        border: 3px solid rgba(31, 111, 209, 0.24); border-top-color: ${BRAND_BLUE};
        animation: boot-splash-spin 900ms linear infinite,
                   boot-splash-appear 300ms ease-out 1200ms both;
      }
      @keyframes boot-splash-spin { to { transform: rotate(360deg); } }
      @keyframes boot-splash-appear { from { opacity: 0; } to { opacity: 1; } }
    </style>`;

  const markup = `<div id="boot-splash">
      <img src="${BOOT_WORDMARK}" alt="${escape(head.title)}" width="240" height="240" />
      <span class="boot-splash__spinner" role="progressbar" aria-label="טוען את האפליקציה"></span>
    </div>
    <script>
      // The app hides this the moment it is ready. This is the other case: a
      // bundle that never arrives must not leave the screen covered for good.
      setTimeout(function () {
        var splash = document.getElementById("boot-splash");
        if (splash) splash.classList.add("boot-splash--done");
      }, 20000);
    </script>`;

  let out = html.replace(/([ \t]*)<\/head>/i, (match, indent) => `${indent}  ${style}\n${match}`);
  out = out.replace(/([ \t]*)<\/body>/i, (match, indent) => `${indent}  ${markup}\n${match}`);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const target = resolve(ROOT, process.argv[2] ?? "dist/index.html");
  const before = readFileSync(target, "utf8");
  const after = injectBootSplash(injectWebHead(before));
  writeFileSync(target, after);
  const added = after.length === before.length ? "already present" : `${after.length - before.length} bytes`;
  console.log(`inject-web-head: ${target} (${added})`);
}
