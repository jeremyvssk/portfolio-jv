// check:legible. Is each mark drawn big enough for its OWN artwork to survive?
//
// check:marks passes while a logo is visibly mud, because it asks a different question: whether
// the size constants match the file. It cannot see a mark that is sized exactly right and still
// unreadable, because the file carries finer detail than the box has pixels. Measured, that is
// PostgreSQL at 31px, where the elephant's face closes into a blob, and Java, whose steam is gone.
//
// The measurement is a morphological OPENING with a disc of half a device pixel, run twice: once on
// the ink and once on the holes. Whatever the opening removes is a stroke, or a gap, narrower than
// one device pixel, which no renderer can draw, at any source resolution. The two losses add,
// because a mark dies either way: strokes fading out, or holes filling in.
//
// It also measures EDGE SOFTNESS, which is the other way a mark arrives unfit: mid-alpha pixels per
// pixel of perimeter. A mark rendered straight from vector art has a one-pixel antialias band and
// scores about 1. The React mask shipped at 5.63 (a five-pixel ramp, from being rendered huge and
// then reduced), and a soft mask drawn at 34px reads grey and mushy however good the artwork is.
// This is the check for "blurry", which no amount of comparing a file against itself can catch.
//
// Needs ImageMagick. Offline, no browser. Run: npm run check:legible
import { MARKS, alphaOf } from "./mark-set.mjs";

// A fifth of a mark gone is where it stops reading as itself; past 15% it is visibly thin and the
// artwork, not the layout, is what would have to change.
const BREAKS = 0.25;
const THIN = 0.15;
// Every mark in the set measures 0.9 to 2.9 drawn straight from its art; a 2px gaussian on the
// softest of them lands at 5.7. 4.0 sits in that gap with room on both sides.
const SOFT = 4.0;

/** Mid-alpha pixels per pixel of perimeter: the width of the antialias band, in pixels. */
function softness(w, h, a) {
  let mid = 0, per = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x, v = a[p];
    if (v > 0.1 && v < 0.9) mid++;
    if (v > 0.5 && (a[p - 1] <= 0.5 || a[p + 1] <= 0.5 || a[p - w] <= 0.5 || a[p + w] <= 0.5)) per++;
  }
  return per ? mid / per : 0;
}

/** Exact euclidean distance transform (Felzenszwalb), measured inward from outside `mask`. */
function edt(mask, w, h) {
  const INF = 1e12, d = new Float64Array(w * h), n = Math.max(w, h);
  const f = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), o = new Float64Array(n);
  const tx = (len) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      for (;;) {
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        if (s <= z[k]) k--; else break;
      }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; o[q] = (q - v[k]) ** 2 + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? INF : 0;
    tx(h); for (let y = 0; y < h; y++) d[y * w + x] = o[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = d[y * w + x];
    tx(w); for (let x = 0; x < w; x++) d[y * w + x] = Math.sqrt(o[x]);
  }
  return d;
}

/** Share of `mask` that an opening of radius r deletes: everything thinner than 2r across. */
function openLoss(mask, w, h, r) {
  let area = 0;
  for (let i = 0; i < mask.length; i++) area += mask[i];
  if (!area) return 0;
  const din = edt(mask, w, h);
  const inv = new Uint8Array(w * h);
  let any = 0;
  for (let i = 0; i < inv.length; i++) { const keep = din[i] > r; inv[i] = keep ? 0 : 1; any += keep ? 1 : 0; }
  if (!any) return 1;
  const dout = edt(inv, w, h);
  let kept = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] && dout[i] <= r) kept++;
  return 1 - kept / area;
}

// Every place the site draws a mark, at the smallest it ever gets there. `--logo` is 1.5rem below
// 768 and 2.25rem above; `html`'s clamp holds the root at 16px until 1440 and only then opens up to
// 24, so the SMALLEST desktop mark is the one at 768-1440, not the one on the widest screen. The
// peek strip takes another 0.62 on top, which is what makes it the tightest box on the page.
// Phones are all 2x or better; a sub-768 window at 1x is a resized desktop browser, not a device,
// and is deliberately out of this matrix.
const PLACES = [
  { name: "wall 768-1440 1x", logo: 16 * 2.25, dpr: 1 },
  { name: "wall >1440 1x", logo: 24 * 2.25, dpr: 1 },
  { name: "wall phone 2x", logo: 16 * 1.5, dpr: 2 },
  { name: "peek 768-1440 1x", logo: 16 * 2.25 * 0.62, dpr: 1, peek: true },
  { name: "peek >1440 1x", logo: 24 * 2.25 * 0.62, dpr: 1, peek: true },
  { name: "peek phone 2x", logo: 16 * 1.5 * 0.62, dpr: 2, peek: true },
];

const PEEK = [...(await import("node:fs")).readFileSync("src/components/StackWall.tsx", "utf8")
  .matchAll(/const PEEK = \[([^\]]+)\]/g)].map((m) => m[1].match(/"[^"]+"/g).map((s) => s.slice(1, -1)))[0] ?? [];

let broke = 0, thin = 0, soft = 0;
console.log("mark         place              drawn    ink lost  holes shut   total   edge");
for (const m of MARKS) {
  const { w, h, a } = alphaOf(m.file);
  const ink = new Uint8Array(w * h), hole = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) { const on = a[i] > 0.5; ink[i] = on ? 1 : 0; hole[i] = on ? 0 : 1; }
  const long = Math.max(w, h);

  let worst = null;
  for (const p of PLACES) {
    if (p.peek && !PEEK.includes(m.name)) continue;
    const px = p.logo * 0.86 * m.k * p.dpr;
    const r = 0.5 * long / px;
    const li = openLoss(ink, w, h, r), lh = openLoss(hole, w, h, r);
    const total = li + lh;
    if (!worst || total > worst.total) worst = { place: p.name, px, li, lh, total };
  }
  const edge = softness(w, h, a);
  const blurry = edge > SOFT;
  const bad = worst.total > BREAKS, warn = !bad && worst.total > THIN;
  if (bad) broke++; else if (warn) thin++;
  if (blurry) soft++;
  console.log(
    m.id.padEnd(12), worst.place.padEnd(18), `${worst.px.toFixed(1)}px`.padStart(7),
    `${(worst.li * 100).toFixed(1)}%`.padStart(9), `${(worst.lh * 100).toFixed(1)}%`.padStart(11),
    `${(worst.total * 100).toFixed(1)}%`.padStart(8), edge.toFixed(2).padStart(6),
    blurry ? "  BLURRY" : bad ? "  BREAKS" : warn ? "  thin" : "");
}
if (thin) console.log(`\n${thin} mark(s) over ${THIN * 100}% at their smallest. Readable, but the artwork is the lever if they ever need to be crisper.`);
if (soft) {
  console.error(`\n${soft} mark(s) have an antialias band over ${SOFT}px wide: the file was rendered large and ` +
    `reduced, or blurred. Re-render it from the vector at the size it ships, do not sharpen it.`);
}
if (broke) {
  console.error(`\n${broke} mark(s) lose more than ${BREAKS * 100}% of themselves at a size the site draws them. ` +
    `Draw it bigger, keep it out of the peek, or source artwork with less detail. Thickening the strokes is not a fix.`);
}
if (broke || soft) process.exit(1);
console.log(`\nall marks survive every size they are drawn at (under ${BREAKS * 100}% detail lost)`);
