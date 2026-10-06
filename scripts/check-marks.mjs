// Do the numbers baked into StackWall.tsx still describe the files on disk?
//
// The wall's sizing rule lives in two places that cannot see each other: the formula, argued in
// StackWall.tsx's header, and the fifteen `a`/`k` constants it was applied to. Nothing in the build
// re-derives one from the other, so a re-exported logo silently keeps the old mark's size, and the
// failure is a mark 4% off its neighbours, which no screenshot and no layout probe will report. It
// is the drift the header comment warns about, made checkable. Needs ImageMagick. Run:
//   npm run check:marks
import { MARKS, alphaOf } from "./mark-set.mjs";

const K = 1.105; // the keyline: the longest edge a mark may be drawn at, over `.mk`'s 0.86
const C0 = Math.PI / 4; // a disc's share of its own box, the coverage that earns the whole keyline
const E = 0.394; // puts a filled square at 1 / 1.10 of that disc

/** Coverage of the SILHOUETTE: transparency that a stroke encloses is part of the shape, so only
 *  transparency reachable from the border is outside it. A ring reads as large as its own disc. */
function silhouette({ w, h, d }) {
  const out = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (!out[p] && d[p] < 8) { out[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    if (x + 1 < w) push(x + 1, y);
    if (x > 0) push(x - 1, y);
    if (y + 1 < h) push(x, y + 1);
    if (y > 0) push(x, y - 1);
  }
  let outside = 0;
  for (let p = 0; p < out.length; p++) outside += out[p];
  return 1 - outside / (w * h);
}

let bad = 0;
for (const m of MARKS) {
  const img = alphaOf(m.file);
  const a = img.w / img.h;
  const k = K * Math.min(1, (C0 / silhouette(img)) ** E);
  // 0.003 is six times the worst rounding error a three-place constant can carry, and 0.14px at
  // the largest size the wall is ever drawn. It has to be this tight: WordPress drawn 0.005 of `k`
  // off Next.js is 1.4px, and perfectly visible.
  const off = Math.abs(a - m.a) > 0.003 || Math.abs(k - m.k) > 0.003;
  if (off) bad++;
  console.log(`${m.name.padEnd(12)} a ${m.a.toFixed(3)} / ${a.toFixed(3)}   k ${m.k.toFixed(3)} / ${k.toFixed(3)}  ${off ? "OFF" : ""}`);
}
console.log(bad ? `\n${bad} mark(s) do not match the file on disk` : "\nall marks match the rule");
process.exit(bad ? 1 : 0);
