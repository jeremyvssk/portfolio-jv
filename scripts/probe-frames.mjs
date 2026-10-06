// Frame-time probe: turns "it feels janky" into ms per frame, per section, per screen size.
//
// It measures the interval between requestAnimationFrame callbacks while the page sits in one
// section. A page that keeps up reports the display's own cadence (16.7ms); one that does not
// reports the stretched interval, so 30ms means every second frame is being dropped. Nothing here
// times our own JS on purpose: the cost this page has is compositing, and JS timers cannot see it.
//
// Needs a PRODUCTION build serving on PORT, since `next dev` does not hydrate reliably here:
//   npm run build && npm run probe:serve &   # 3199, never 3020 (the dev server's)
//   node scripts/probe-frames.mjs
//
// ALWAYS forces `reducedMotion: no-preference`. This desktop reports `reduce` (GNOME's
// enable-animations is off), which stops the drift and parks the canvases on a single frame, so an
// unforced run measures a page with the animations switched off and reports that everything is fine.
//
//   --css <file>   A/B: run baseline and the same page with that stylesheet appended, INTERLEAVED,
//                  because across-run variance is +/-3ms and a sequential A-then-B run cannot see a
//                  win that small.
//   --diff         With --css, screenshot instead of timing and report the worst channel delta. For
//                  the changes that are supposed to be invisible; freezes animation and hides the
//                  canvases first, or A and B are two different moments and every pixel differs.
//   --wheel        Oscillate the wheel during the measurement instead of measuring at rest.
//   --headed       REQUIRED for any frame-time number. Headless Chromium here has no GPU and
//                  rasterizes on the CPU through SwiftShader, which inflates every compositing cost
//                  by a multiple and has, in the past, invented the bottleneck being chased.
//   --cdp          Also report what the MAIN THREAD spent, from Chromium's own counters: task,
//                  script, style and layout ms per frame, and how many style recalcs and layouts
//                  each frame cost. rAF cadence cannot see headroom (a page using 9ms of a 10ms
//                  budget reports the same 10.0 as one using 1ms), so a green cadence needs this
//                  before it means anything.
//   --widths / --zones / --frames  Narrow a run down while bisecting.
import { readFileSync } from "node:fs";
import { browserFor, firefoxOrExit } from "./pw.mjs";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 || i === argv.length - 1 ? fallback : argv[i + 1];
};

const PORT = process.env.PORT ?? 3199;
const URL = `http://localhost:${PORT}/`;
const WIDTHS = opt("widths", "1440,1920,3440").split(",").map(Number);
const ZONES = opt("zones", "hero,about,works,services,contact").split(",");
const FRAMES = Number(opt("frames", 90));
const cssPath = opt("css", null);
const css = cssPath ? readFileSync(cssPath, "utf-8") : null;
const diff = flag("diff");
const wheel = flag("wheel");
// Under `reduce` the wheel filter never starts and both canvases draw one frame. Measure the state you mean.
const motion = opt("motion", "no-preference");
// `chromium` drives the installed Chromium browser (see browserFor in pw.mjs).
const engine = opt("engine", "firefox");

if (diff && !css) {
  console.error("--diff needs --css: it compares the page against the page with that override.");
  process.exit(2);
}

// Heights are the shape each width actually ships in, not one height for all of them: area is the
// cost here, so measuring a 2560 screen at 900 understates it by a third.
// On a 100Hz display the budget is 10ms, not 16.7; read the rows against the target display's rate.
const HEIGHT = { 1440: 900, 1920: 1080, 2560: 1440, 3440: 1440 };

/** Only what makes A and B the SAME PICTURE. The canvases repaint from `performance.now()` and the
 *  pool drifts on a 67s loop, so without this a diff reports the time between two screenshots. */
const FREEZE = `*, *::before, *::after { animation: none !important; transition: none !important }
canvas { visibility: hidden !important }`;

/** Park the viewport in a section. `scrollTo`, never a wheel event: the wheel filter would ease into
 *  it and where it lands is then a function of how long we waited. */
// The three page-side functions are template strings CALLED by interpolation rather than passed as
// arguments: `page.evaluate` treats a string as an expression to evaluate and silently drops the
// argument, so `evaluate(fn, arg)` here returns the function itself and every check downstream reads
// a `{}`.
const parkAt = `(id) => {
  if (id === "hero") { window.scrollTo(0, 0); return 0; }
  const el = document.getElementById(id);
  if (!el) return -1;
  const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.1;
  window.scrollTo(0, Math.max(0, y));
  return Math.max(0, y);
}`;

/** Median rAF interval over `n` frames. The first handful are dropped: the first frame after a
 *  scroll carries that scroll's own work and is not what the reader feels once they are there. */
const measure = `async ({ n, wheel }) => {
  const gaps = [];
  let last = 0;
  let osc = 0;
  await new Promise((done) => {
    const tick = (now) => {
      if (last) gaps.push(now - last);
      last = now;
      if (wheel) {
        // Small alternating steps, so the scroll-linked work runs without leaving the section.
        osc++;
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: osc % 20 < 10 ? 24 : -24, bubbles: true, cancelable: true }));
      }
      if (gaps.length < n) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  const keep = gaps.slice(5);
  const sorted = [...keep].sort((a, b) => a - b);
  // The MEDIAN alone is a coin flip: a display-locked browser reports either the cadence or a whole
  // multiple of it, so a page dropping a third of its frames still reads 16.7 and a page dropping
  // half reads 33.3, with nothing in between. The mean and the drop rate are the continuous
  // numbers, and they are what a change of a few ms actually moves.
  return {
    med: sorted[sorted.length >> 1],
    mean: keep.reduce((a, b) => a + b, 0) / keep.length,
    drop: keep.filter((g) => g > 20).length / keep.length,
    frames: keep.length,
  };
}`;

/** Worst channel delta between two PNGs, and how much of the frame is not identical. Decoded in the
 *  page because node has no image decoder here and this probe is not taking a dependency for one. */
const compare = `async ([a, b]) => {
  const load = async (b64) => {
    const bmp = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext("2d").drawImage(bmp, 0, 0);
    return c.getContext("2d").getImageData(0, 0, bmp.width, bmp.height).data;
  };
  const [x, y] = await Promise.all([load(a), load(b)]);
  if (x.length !== y.length) return { worst: 255, pixels: -1 };
  let worst = 0, pixels = 0;
  for (let i = 0; i < x.length; i += 4) {
    let d = 0;
    for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(x[i + k] - y[i + k]));
    if (d > worst) worst = d;
    if (d > 1) pixels++;
  }
  return { worst, pixels };
}`;

/** Chromium's own main-thread counters. Cumulative, so a window is the difference of two reads. */
async function readMetrics(session) {
  const { metrics } = await session.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

/** Per frame, over the window: seconds in the counters, ms on the page. */
function spend(a, b, frames) {
  const d = (k) => ((b[k] - a[k]) * 1000) / frames;
  return {
    task: d("TaskDuration"),
    script: d("ScriptDuration"),
    style: d("RecalcStyleDuration"),
    layout: d("LayoutDuration"),
    recalcs: (b.RecalcStyleCount - a.RecalcStyleCount) / frames,
    layouts: (b.LayoutCount - a.LayoutCount) / frames,
  };
}

const pw = await firefoxOrExit();
const headed = flag("headed");
if (!headed && !diff) {
  console.error("Refusing to time frames headless: no GPU here, so compositing reads several times what it costs on the card that draws this page. Add --headed.");
  process.exit(2);
}
const { type, opts } = browserFor(pw, engine, headed);
const browser = await type.launch(opts);
const gpu = await (async () => {
  const p = await (await browser.newContext()).newPage();
  const r = await p.evaluate(`(() => { const c = document.createElement("canvas"); const g = c.getContext("webgl");
    const d = g && g.getExtension("WEBGL_debug_renderer_info");
    return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown"; })()`);
  await p.context().close();
  return r;
})();
console.log(`${engine} / prefers-reduced-motion: ${motion}\n${gpu}`);
if (/SwiftShader|llvmpipe|software/i.test(gpu)) {
  console.error("That is a software rasterizer. The numbers below are not this machine's.");
}

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: HEIGHT[width] ?? 900 },
    // The whole point of the probe. See the header.
    reducedMotion: motion,
  });
  const page = await ctx.newPage();
  // Only Chromium has these counters; Firefox runs cadence-only.
  const cdp = flag("cdp") && engine === "chromium" ? await ctx.newCDPSession(page) : null;
  if (cdp) await cdp.send("Performance.enable");
  await page.goto(URL, { waitUntil: "networkidle" });
  // A stylesheet that 500d lays the page out as one column of static blocks, which measures FAST and
  // reports a fix that does not exist.
  const rules = await page.evaluate(() =>
    [...document.styleSheets].reduce((n, s) => n + (s.cssRules?.length ?? 0), 0),
  );
  if (rules < 100) {
    console.error(`No stylesheet at ${width}px (${rules} rules). Rebuild, then restart the server.`);
    process.exit(2);
  }
  // A server started before the last build serves a chunk manifest that no longer matches what is on
  // disk: hydration throws, no client effect runs, and the page measures beautifully because it is
  // doing nothing. The hero's canvases are created by an effect, so one of them existing is proof
  // the client actually ran. RESTART `probe:serve` AFTER EVERY BUILD.
  await page.waitForTimeout(600);
  const hydrated = await page.evaluate(`!!document.querySelector("#hero-scope canvas")`);
  if (!hydrated) {
    console.error("No hero canvas: the page never hydrated. Restart the server on this build.");
    process.exit(2);
  }
  if (diff) await page.addStyleTag({ content: FREEZE });

  // One handle, added and removed around each B pass, so A and B are the same page in the same
  // session rather than two loads with two different warm-ups.
  let tag = null;
  const setB = async (on) => {
    if (!css) return;
    if (on && !tag) tag = await page.addStyleTag({ content: css });
    if (!on && tag) {
      await tag.evaluate((el) => el.remove());
      tag = null;
    }
  };

  console.log(`\n${width}x${HEIGHT[width] ?? 900}`);
  for (const zone of ZONES) {
    const y = await page.evaluate(`(${parkAt})(${JSON.stringify(zone)})`);
    if (y < 0) {
      console.log(`  ${zone.padEnd(9)} MISSING`);
      continue;
    }
    await page.waitForTimeout(700);

    if (diff) {
      await setB(false);
      const a = (await page.screenshot()).toString("base64");
      await setB(true);
      const b = (await page.screenshot()).toString("base64");
      await setB(false);
      const r = await page.evaluate(`(${compare})(${JSON.stringify([a, b])})`);
      console.log(`  ${zone.padEnd(9)} worst ${String(r.worst).padStart(3)}/255   ${r.pixels} px differ`);
      continue;
    }

    // A B A B. Two passes each, reported separately: two numbers that disagree by more than the gap
    // being claimed mean the run is noise and the change has not been measured yet.
    const runs = [];
    for (let i = 0; i < 4; i++) {
      await setB(i % 2 === 1);
      if (css) await page.waitForTimeout(250);
      const before = cdp && (await readMetrics(cdp));
      const r = await page.evaluate(`(${measure})(${JSON.stringify({ n: FRAMES, wheel })})`);
      if (cdp) r.cdp = spend(before, await readMetrics(cdp), r.frames);
      runs.push(r);
    }
    await setB(false);
    // mean ms, then the share of frames that missed. `med` is printed only when it disagrees with
    // the mean about whether this zone is healthy.
    const fmt = (r) => `${r.mean.toFixed(1).padStart(5)} ${String(Math.round(r.drop * 100)).padStart(3)}%`;
    console.log(
      css
        ? `  ${zone.padEnd(9)} A ${fmt(runs[0])} ${fmt(runs[2])}  |  B ${fmt(runs[1])} ${fmt(runs[3])}`
        : `  ${zone.padEnd(9)} ${fmt(runs[0])} ${fmt(runs[1])} ${fmt(runs[2])} ${fmt(runs[3])}`,
    );
    if (cdp) {
      // A and B kept apart, and each averaged over its two passes: these counters are steady where
      // the cadence is noisy, but averaging the two variants together hides the whole comparison.
      const line = (label, rs) => {
        const k = (f) => rs.reduce((n, r) => n + f(r.cdp), 0) / rs.length;
        const ms = (f) => k(f).toFixed(2).padStart(5);
        console.log(
          `           ${label} main ${ms((c) => c.task)}ms  script ${ms((c) => c.script)}  style ${ms(
            (c) => c.style,
          )}  layout ${ms((c) => c.layout)}   ${k((c) => c.recalcs).toFixed(1)} recalcs, ${k(
            (c) => c.layouts,
          ).toFixed(1)} layouts per frame`,
        );
      };
      if (css) {
        line("A", [runs[0], runs[2]]);
        line("B", [runs[1], runs[3]]);
      } else line(" ", runs);
    }
  }
  await ctx.close();
}

await browser.close();
