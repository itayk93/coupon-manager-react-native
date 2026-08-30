// Regenerates the share-extension action icons so the + / % glyph sits dead
// centre in the coupon body and nothing overflows the rounded rectangle.
// Pure JS: renders an alpha mask at high res, box-downsamples to every size
// the appiconset needs. rgb is always black; alpha carries the shape.
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const BASE = 1024;
const SS = 3; // supersample factor for the master render
const S = BASE * SS;

// --- geometry, in 1024-space -------------------------------------------------
const CX = 512, CY = 512;
const body = { x0: 210, y0: 280, x1: 814, y1: 744, r: 52 };
const perfR = 40;
const perfYs = [CY - 146, CY, CY + 146];

function insideRoundedRect(x, y, b) {
  if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return false;
  const rx = Math.min(Math.max(x, b.x0 + b.r), b.x1 - b.r);
  const ry = Math.min(Math.max(y, b.y0 + b.r), b.y1 - b.r);
  const inCornerBox =
    (x < b.x0 + b.r || x > b.x1 - b.r) && (y < b.y0 + b.r || y > b.y1 - b.r);
  if (!inCornerBox) return true;
  return Math.hypot(x - rx, y - ry) <= b.r;
}

function inPerforation(x, y) {
  for (const cy of perfYs) {
    if (Math.hypot(x - body.x0, y - cy) <= perfR) return true;
    if (Math.hypot(x - body.x1, y - cy) <= perfR) return true;
  }
  return false;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inPlus(x, y) {
  const t = 76, L = 150;
  return (
    segDist(x, y, CX - L, CY, CX + L, CY) <= t / 2 ||
    segDist(x, y, CX, CY - L, CX, CY + L) <= t / 2
  );
}

function inPercent(x, y) {
  const dotR = 54, off = 92;
  if (Math.hypot(x - (CX - off), y - (CY - off)) <= dotR) return true;
  if (Math.hypot(x - (CX + off), y - (CY + off)) <= dotR) return true;
  return segDist(x, y, CX + 120, CY - 168, CX - 120, CY + 168) <= 31;
}

function renderMaster(glyphFn) {
  const a = new Uint8Array(S * S);
  for (let py = 0; py < S; py++) {
    const y = (py + 0.5) / SS;
    for (let px = 0; px < S; px++) {
      const x = (px + 0.5) / SS;
      let on = insideRoundedRect(x, y, body) && !inPerforation(x, y) && !glyphFn(x, y);
      a[py * S + px] = on ? 255 : 0;
    }
  }
  return a;
}

function downsample(master, n) {
  const out = new PNG({ width: n, height: n });
  const scale = S / n;
  for (let y = 0; y < n; y++) {
    const sy0 = Math.floor(y * scale), sy1 = Math.floor((y + 1) * scale);
    for (let x = 0; x < n; x++) {
      const sx0 = Math.floor(x * scale), sx1 = Math.floor((x + 1) * scale);
      let sum = 0, cnt = 0;
      for (let sy = sy0; sy < sy1; sy++)
        for (let sx = sx0; sx < sx1; sx++) { sum += master[sy * S + sx]; cnt++; }
      const alpha = Math.round(sum / cnt);
      const i = (y * n + x) << 2;
      out.data[i] = 0; out.data[i + 1] = 0; out.data[i + 2] = 0; out.data[i + 3] = alpha;
    }
  }
  return PNG.sync.write(out);
}

const SIZES = {
  "App-Icon-20x20@1x.png": 20, "App-Icon-20x20@2x.png": 40, "App-Icon-20x20@3x.png": 60,
  "App-Icon-29x29@1x.png": 29, "App-Icon-29x29@2x.png": 58, "App-Icon-29x29@3x.png": 87,
  "App-Icon-40x40@1x.png": 40, "App-Icon-40x40@2x.png": 80, "App-Icon-40x40@3x.png": 120,
  "App-Icon-60x60@2x.png": 120, "App-Icon-60x60@3x.png": 180,
  "App-Icon-76x76@1x.png": 76, "App-Icon-76x76@2x.png": 152,
  "App-Icon-83.5x83.5@2x.png": 167, "ItunesArtwork@2x.png": 1024,
};

const targets = [
  { dir: "targets/share", glyph: inPercent },
  { dir: "targets/add-share", glyph: inPlus },
];

const root = path.resolve(__dirname, "..");
for (const { dir, glyph } of targets) {
  const master = renderMaster(glyph);
  const master1024 = downsample(master, 1024);
  fs.writeFileSync(path.join(root, dir, "assets/action-icon.png"), master1024);
  const setDir = path.join(root, dir, "Assets.xcassets/AppIcon.appiconset");
  for (const [name, n] of Object.entries(SIZES)) {
    fs.writeFileSync(path.join(setDir, name), n === 1024 ? master1024 : downsample(master, n));
  }
  console.log("wrote", dir);
}
