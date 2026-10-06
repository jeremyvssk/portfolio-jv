// What a REAL wheel gesture feels like, which the frame probe cannot ask.
//
// `probe-frames --wheel` dispatches synthetic WheelEvents. They reach our handler, but an untrusted
// event's `preventDefault` does nothing and the compositor never had to wait on it, so the one cost
// that defines this page's scroll (a `{ passive: false }` listener standing between the wheel and
// the page moving) is invisible to it. `page.mouse.wheel` sends the real thing through the browser's
// own input pipeline.
//
// Reports, per gesture:
//   frames    the rAF cadence while scrolling, and the share that missed the display
//   roughness how much the per-frame scroll STEP CHANGES from one frame to the next, against the
//             mean step. This is the number that matches "janky": a page can hold 100fps and still
//             stutter if the distance it moves per frame keeps jumping. A smooth ramp scores near
//             zero; 120px-then-nothing scores 200.
//   dead      share of gesture frames that did not move at all
//   coast     ms the page kept moving after the last wheel event
//   latency   ms from the wheel arriving to the first frame that moved, over the gesture
//
//   --native  drop the filter first (tears down the wheel listener), for the comparison that decides
//             whether the hijack pays for itself.
//   --headed  REQUIRED. See pw.mjs: headless has no GPU here.
import { browserFor, firefoxOrExit } from "./pw.mjs";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const PORT = process.env.PORT ?? 3199;
const WIDTH = Number(opt("width", 3440));
const HEIGHT = Number(opt("height", 1440));
const TICKS = Number(opt("ticks", 40));

if (!flag("headed")) {
  console.error("Refusing to time a gesture headless: no GPU here. Add --headed.");
  process.exit(2);
}

const pw = await firefoxOrExit();
const { type, opts } = browserFor(pw, "chromium", true);
const browser = await type.launch(opts);
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.evaluate(`window.scrollTo(0, 0)`);
await page.waitForTimeout(300);

// Recorder FIRST, and in the capture phase, so it still sees the wheel when --native silences the
// filter with `stopImmediatePropagation`: a later listener on the same phase would be silenced too.
await page.evaluate(`(() => {
  window.__rec = { f: [], w: [] };
  window.addEventListener("wheel", () => window.__rec.w.push(performance.now()), { capture: true, passive: true });
  const tick = (now) => { window.__rec.f.push([now, window.scrollY]); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})()`);

const native = flag("native");
if (native) {
  // There is no handle on the filter's teardown, so take it out the only way the page allows: stop
  // the event reaching it and let the browser scroll natively.
  await page.evaluate(`window.addEventListener("wheel", (e) => e.stopImmediatePropagation(), { capture: true, passive: true })`);
}

// A gesture that runs into the end of the document measures the clamp, not the scroll: every frame
// after it lands is a dead frame and the roughness is the bottom of the page.
const room = await page.evaluate(`document.documentElement.scrollHeight - window.innerHeight`);
const reach = TICKS * 120;
if (reach > room * 0.8) {
  console.error(`${TICKS} ticks reach ${reach}px into ${room}px of document. Use --ticks ${Math.floor((room * 0.7) / 120)} or less.`);
  process.exit(2);
}

// THE POINTER HAS TO BE INSIDE THE REAL WINDOW, which is not the viewport. A 3440x1440 viewport on
// a 3440x1440 screen cannot be a real window, so Playwright emulates the metrics and the OS window
// stays small, and a wheel aimed at the middle of the EMULATED viewport lands outside it, comes
// back `cancelable: false`, and every conclusion drawn from it is about nothing. Aim well inside the
// real window, then check the flag rather than trusting the aim.
const outer = await page.evaluate(`[outerWidth, outerHeight]`);
await page.mouse.move(Math.min(WIDTH, outer[0]) / 3, Math.min(HEIGHT, outer[1]) / 3);

// One probe tick, checked rather than trusted. A wheel that lands outside the real window comes back
// `cancelable: false`: the filter's `preventDefault` is then a no-op, the browser scrolls natively
// AND the filter scrolls too, and the trace is violent jank that belongs entirely to the rig.
await page.evaluate(`window.__probe = null; window.addEventListener("wheel", (e) => { window.__probe = e.cancelable; }, { capture: true, passive: true, once: true })`);
// A full notch, not 1px: a sub-threshold delta is dispatched non-cancelable and the check then
// fails on a page that is fine.
await page.mouse.wheel(0, 120);
await page.waitForTimeout(150);
const cancelable = await page.evaluate(`window.__probe`);
if (cancelable === null) {
  console.error("No wheel reached the page: the pointer is outside the real browser window.");
  process.exit(2);
}
if (!cancelable && !native) {
  console.error(`Wheel events arrive cancelable:false, so the filter cannot prevent them. The OS window is ${outer[0]}x${outer[1]}; aim inside it.`);
  process.exit(2);
}

await page.evaluate(`window.scrollTo(0, 0); window.__rec = { f: window.__rec.f, w: [] }`);
await page.waitForTimeout(250);

for (let i = 0; i < TICKS; i++) {
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(16);
}
await page.waitForTimeout(700);

const r = await page.evaluate(`(() => {
  const { f, w } = window.__rec;
  if (!w.length) return null;
  const t0 = w[0], tLast = w[w.length - 1];
  const step = [], gap = [], time = [];
  for (let i = 1; i < f.length; i++) { step.push(f[i][1] - f[i - 1][1]); gap.push(f[i][0] - f[i - 1][0]); time.push(f[i][0]); }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  // The GESTURE window: every frame between the first wheel and the last, moving or not. Filtering
  // to moving frames only would score a page that jumps 120px and then sits still as perfectly even.
  const inG = step.map((s, i) => i).filter((i) => time[i] >= t0 && time[i] <= tLast);
  const g = inG.map((i) => step[i]);
  const gg = inG.map((i) => gap[i]);
  // Frame-to-frame CHANGE in the step, against the mean step. A smooth ramp scores near zero here;
  // a stall-then-catch-up does not, and neither does 120/0/120/0.
  const d2 = [];
  for (let i = 1; i < g.length; i++) d2.push(Math.abs(g[i] - g[i - 1]));
  const stall = g.filter((s) => Math.abs(s) < 0.5).length;
  // The COAST: from the last wheel to the last frame that moved.
  let end = f.length - 1;
  while (end > 1 && Math.abs(f[end][1] - f[end - 1][1]) < 0.5) end--;
  const lat = [];
  for (const t of w) { const i = inG.find((k) => time[k] >= t && Math.abs(step[k]) > 0.5); if (i !== undefined) lat.push(time[i] - t); }
  return {
    frames: g.length,
    frameMean: +mean(gg).toFixed(2),
    dropped: +(100 * gg.filter((x) => x > 13).length / (gg.length || 1)).toFixed(0),
    stepMean: +mean(g).toFixed(1),
    stepMax: +Math.max(...g.map(Math.abs)).toFixed(0),
    rough: +(100 * mean(d2) / Math.abs(mean(g) || 1)).toFixed(0),
    stallPct: +(100 * stall / (g.length || 1)).toFixed(0),
    latencyMean: +mean(lat).toFixed(1),
    latencyWorst: +Math.max(...lat, 0).toFixed(1),
    coast: +(f[end][0] - tLast).toFixed(0),
    travelled: +f[f.length - 1][1].toFixed(0),
    steps: g.map((x) => Math.round(x)),
  };
})()`);

if (!r) { console.error("no wheel events reached the page"); process.exit(1); }

console.log(`${native ? "NATIVE scroll" : "WHEEL FILTER"}  ${WIDTH}x${HEIGHT}  port ${PORT}`);
console.log(`  frames ${r.frameMean}ms, ${r.dropped}% missed   roughness ${r.rough}%   dead frames ${r.stallPct}%`);
console.log(`  latency ${r.latencyMean}ms (worst ${r.latencyWorst})   coast after last wheel ${r.coast}ms`);
console.log(`  ${r.frames} gesture frames, mean step ${r.stepMean}px (max ${r.stepMax}), travelled ${r.travelled}px of ${room}px`);
if (flag("steps")) console.log("  steps:", r.steps.join(" "));
await browser.close();
