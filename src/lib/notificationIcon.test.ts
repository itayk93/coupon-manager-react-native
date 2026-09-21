import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * Android builds a status-bar icon out of the alpha channel alone: everything
 * opaque comes out one flat white shape. So a colour artwork wired in here is
 * not a small mistake — the Kuponi face arrives as a blank blob, on every
 * Android push the app sends — and it looks perfectly correct in the repo,
 * which is how the launcher icon stood in for months.
 *
 * These pin the whole chain: the master the config plugin reads, the drawables
 * the checked-in native project ships until the next prebuild, the manifest
 * entries that point at them, and the badge a browser masks the same way.
 */

const DENSITIES: Array<[string, number]> = [
  ["mdpi", 24],
  ["hdpi", 36],
  ["xhdpi", 48],
  ["xxhdpi", 72],
  ["xxxhdpi", 96],
];

const appConfig = JSON.parse(readFileSync("app.json", "utf8"));

const notificationsPlugin: [string, { icon: string; color: string }] =
  appConfig.expo.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-notifications",
  );

function paeth(left: number, above: number, corner: number): number {
  const estimate = left + above - corner;
  const dLeft = Math.abs(estimate - left);
  const dAbove = Math.abs(estimate - above);
  const dCorner = Math.abs(estimate - corner);
  if (dLeft <= dAbove && dLeft <= dCorner) return left;
  return dAbove <= dCorner ? above : corner;
}

/**
 * Just enough PNG to read these files back: IHDR, the IDAT stream, and the
 * five row filters. Everything here is written by Pillow as 8-bit
 * non-interlaced RGBA, and the header check fails loudly if that ever changes.
 */
function decode(path: string): { width: number; height: number; pixels: Buffer } {
  const bytes = readFileSync(path);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const [depth, colorType, , , interlace] = bytes.subarray(24, 29);
  expect({ path, depth, colorType, interlace }).toEqual({
    path,
    depth: 8,
    colorType: 6, // RGBA. A mask without an alpha channel is the bug itself.
    interlace: 0,
  });

  const parts: Buffer[] = [];
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      parts.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12; // length, type, data, CRC
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const corner = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      const value = raw[y * (stride + 1) + 1 + x];
      const restored =
        filter === 1
          ? value + left
          : filter === 2
            ? value + above
            : filter === 3
              ? value + ((left + above) >> 1)
              : filter === 4
                ? value + paeth(left, above, corner)
                : value;
      pixels[y * stride + x] = restored & 0xff;
    }
  }
  return { width, height, pixels };
}

/** What the OS will actually paint: a white shape, and the holes inside it. */
function describeMask(path: string) {
  const { width, height, pixels } = decode(path);
  let tinted = 0;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      if (pixels[at + 3] === 0) continue;
      if (pixels[at] !== 255 || pixels[at + 1] !== 255 || pixels[at + 2] !== 255) tinted += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  // The face fills its own bounds, so a transparent pixel well inside them is
  // an eye or the smile — the thing that separates a face from a blob.
  const insetX = Math.round((right - left) / 4);
  const insetY = Math.round((bottom - top) / 4);
  let holes = 0;
  for (let y = top + insetY; y <= bottom - insetY; y += 1) {
    for (let x = left + insetX; x <= right - insetX; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] < 64) holes += 1;
    }
  }

  return { width, height, tinted, holes, margin: Math.min(left, top, width - 1 - right, height - 1 - bottom) };
}

describe("android notification icon", () => {
  it("is the mark expo-notifications resizes, not the colour launcher icon", () => {
    expect(notificationsPlugin[1].icon).toBe("./assets/notification-icon.png");
    const mask = describeMask("assets/notification-icon.png");
    expect(mask.tinted).toBe(0);
    expect(mask.holes).toBeGreaterThan(0);
  });

  it("ships a drawable for every density, down to the 24px status bar", () => {
    for (const [density, size] of DENSITIES) {
      const mask = describeMask(`android/app/src/main/res/drawable-${density}/notification_icon.png`);
      expect({ density, width: mask.width, height: mask.height }).toEqual({
        density,
        width: size,
        height: size,
      });
      expect({ density, tinted: mask.tinted }).toEqual({ density, tinted: 0 });
      // Legible at 24px means the features survive the downscale, and the
      // face keeps clear of an edge the system may crop or round.
      expect({ density, holes: mask.holes > 0 }).toEqual({ density, holes: true });
      expect({ density, inset: mask.margin > 0 }).toEqual({ density, inset: true });
    }
  });

  it("wires the icon and its tint into the checked-in manifest", () => {
    const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    // Both namespaces: FCM raises a remote push, expo-notifications the local
    // expiry reminders, and each reads its own key.
    for (const owner of ["com.google.firebase.messaging.default", "expo.modules.notifications.default"]) {
      expect(manifest).toContain(
        `<meta-data android:name="${owner}_notification_icon" android:resource="@drawable/notification_icon"/>`,
      );
      expect(manifest).toContain(
        `<meta-data android:name="${owner}_notification_color" android:resource="@color/notification_icon_color"/>`,
      );
    }

    const colors = readFileSync("android/app/src/main/res/values/colors.xml", "utf8");
    expect(colors).toContain(
      `<color name="notification_icon_color">${notificationsPlugin[1].color}</color>`,
    );
  });
});

describe("web push badge", () => {
  it("is masked to a glyph, so it ships as a silhouette too", () => {
    const mask = describeMask("public/notification-badge.png");
    expect(mask.tinted).toBe(0);
    expect(mask.holes).toBeGreaterThan(0);
  });

  it("is what the worker and the sender both reach for", () => {
    for (const source of ["public/sw.js", "supabase/functions/_shared/push.ts"]) {
      expect(readFileSync(source, "utf8")).toContain("/notification-badge.png");
    }
  });
});
