// Does the plate's upload band cover everything the repaint changed?
//
// `HeroPortrait` uploads only `plate.band` on a scroll step instead of the whole canvas, because a
// full upload damages two megapixels that the pool above then has to composite over, measured at
// 7ms a frame mid-gesture at 3440x1440. If that band ever under-reports, a row of the figure goes stale on
// screen and nothing else catches it: it is one band of cells inside a dissolve.
//
// `lib/hero` is DOM-free and node-runnable exactly so this can be answered offline rather than by
// looking at a screenshot. Run:
//   node --experimental-strip-types scripts/check-plate-band.mjs
import { Portrait } from "../src/lib/hero/portrait.ts";

const GW = 240;
const GH = 320;
// A silhouette with a hole and hard crop edges, so the check covers cells that are on, off, and on
// the dissolve's own gates.
const src = new Uint8ClampedArray(GW * GH * 4);
for (let y = 0; y < GH; y++) {
  for (let x = 0; x < GW; x++) {
    const i = (y * GW + x) * 4;
    const d = Math.hypot((x - GW / 2) / (GW * 0.4), (y - GH / 2) / (GH * 0.45));
    const on = d < 1 && !(Math.hypot(x - GW * 0.6, y - GH * 0.4) < 18);
    src[i] = src[i + 1] = src[i + 2] = on ? 40 + ((x * 7 + y * 13) % 180) : 0;
    src[i + 3] = on ? 255 : 0;
  }
}

const plate = new Portrait({ fieldCellPx: 5 });
plate.viewport(1440);
plate.build(src, GW, GH, { x: 0, y: 0 });

// Down in small steps, back up in different ones, then three jumps: the three ways the cut moves.
const path = [];
for (let y = 0; y <= 1600; y += 37) path.push(y);
for (let y = 1600; y >= 0; y -= 53) path.push(y);
path.push(900, 40, 1200, 0);

const docTop = 360;
let bad = 0;
let steps = 0;
for (const y of path) {
  if (!plate.scrollTo(y, docTop)) continue;
  const before = plate.pixels.slice();
  plate.repaint();
  const after = plate.pixels;
  steps++;
  let lo = GH;
  let hi = -1;
  for (let row = 0; row < GH; row++) {
    for (let x = 0; x < GW; x++) {
      const q = (row * GW + x) << 2;
      // Colour under a transparent cell is not a pixel, so it cannot make a row dirty.
      const same =
        before[q + 3] === after[q + 3] &&
        (after[q + 3] === 0 ||
          (before[q] === after[q] && before[q + 1] === after[q + 1] && before[q + 2] === after[q + 2]));
      if (!same) {
        if (row < lo) lo = row;
        if (row > hi) hi = row;
        break;
      }
    }
  }
  const b = plate.band;
  if (hi < 0) continue;
  if (lo < b.y || hi >= b.y + b.h) {
    console.log(`  y=${y}: changed rows ${lo}-${hi}, band reports ${b.y}..${b.y + b.h - 1}`);
    bad++;
  }
}
console.log(
  bad
    ? `\nFAILED: the band missed changed rows at ${bad} of ${steps} steps`
    : `\nthe band covered every changed row at all ${steps} steps`,
);
process.exit(bad ? 1 : 0);
