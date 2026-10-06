// Alignment probe: turns "the alignment looks off" into a number, at every width at once.
//
// Three kinds of check, because they look identical on screen and have nothing to do with each
// other:
//   PAIRS:   edges that must be equal (a column's top against its neighbour's, a rule against the
//            text under it). Measured on getBoundingClientRect, and on a Range when the thing that
//            has to line up is the INK rather than the padded box.
//   BASE:    where a line of type SITS, which no edge reports. `{ base: sel }` reads it off a
//            zero-width strut appended to the element; a form field can hold no strut, so its
//            baseline comes from the font metrics. Compared on the "top" edge.
//   SPREAD:  a set of measurements that must agree with EACH OTHER, where no single one of them is
//            the reference. A pair check cannot say "these fourteen gaps are equal": asserting one
//            against another only ever catches the two it names. Tolerances are in units of the
//            wall's own --mk, so the check means the same thing at every root size.
//   INK:     a glyph centred inside a filled box. The layout run is wider than the ink at both ends
//            and the two are never symmetric, so `items-center` is not centred; this screenshots the
//            element at 4x and finds the real ink bounds.
//
// Needs a PRODUCTION build serving on PORT, since `next dev` does not hydrate reliably here:
//   npm run build && npm run probe:serve &   # 3199, never 3020 (the dev server's)
//   node scripts/probe-align.mjs
//
// The browser comes from `scripts/pw.mjs`: playwright-core is resolved out of the npx cache rather
// than installed, so this stays a dev tool instead of something the site ships.
import { firefoxOrExit } from "./pw.mjs";

const pw = await firefoxOrExit();

const PORT = process.env.PORT ?? 3199;
const URL = `http://localhost:${PORT}/`;
const WIDTHS = [320, 375, 768, 1024, 1151, 1152, 1280, 1366, 1440, 1536, 1728, 1920, 2560];
/** Sub-pixel layout rounding is not a misalignment. Anything above this is. */
const TOL = 1.5;

/** Scroll here first, then assert these edges are equal. `ink:` measures the text, not the box.
 *  The fifth field is a minimum width: a check that only means something once a layout is two
 *  columns has to say so, or it "fails" on every phone by describing a stack correctly. */
const PAIRS = [
  {
    section: "contact",
    checks: [
      ["heading left = links left", { ink: "#contact h2 .sh-char" }, ".ct-links"],
      ["sign-off left = links left", { ink: ".ct-sign" }, ".ct-links"],
      ["back to top right = form right", ".ct-top", "#contact form", "right"],
      ["row label left = field left", { ink: ".cf-ix" }, ".cf-in"],
      ["message label left = name label left", { ink: ".cf-row:last-of-type .cf-ix" }, { ink: ".cf-row:first-of-type .cf-ix" }],
      ["links right = form right", ".ct-links", "#contact form", "right"],
      ["box label left = field left", { ink: ".cf-lab" }, ".cf-row"],
      ["send right = field right", ".cf-send", ".cf-row:last-of-type", "right"],
    ],
  },
  {
    // Row 05's marks are FLUSH START in the keyline box, so the first column's ink is a real edge
    // again, and it is the section's edge: this panel carries the same `md:ps-20` as rows 01-04,
    // so a mark that starts late starts late against every other row's body copy too.
    section: "services",
    open: "#svc-t-4",
    checks: [
      ["stack label left = wall left", { ink: "#svc-p-4 .stk-lbl" }, "#svc-p-4 .stk"],
      ["first mark left = wall left", "#svc-p-4 .stk-grp:first-child .bdg:first-child .mk", "#svc-p-4 .stk"],
      [
        "last group first mark left = wall left",
        "#svc-p-4 .stk-grp:last-child .bdg:first-child .mk",
        "#svc-p-4 .stk",
      ],
      [
        "stack names share column 1",
        { ink: "#svc-p-4 .stk-grp:first-child .bdg:first-child .bdg-n" },
        { ink: "#svc-p-4 .stk-grp:last-child .bdg:first-child .bdg-n" },
      ],
    ],
  },
];

/** Every `.bdg` on the wall yields one number; the spread across them must stay under `tolMk` x the
 *  wall's own --mk. `inset` is what flush start means and is allowed no slack at all. `gap` is
 *  allowed the mark set's intrinsic width spread (0.29) and nothing more. Past that, something
 *  other than how wide the marks are is moving the names. */
const SPREAD = [
  {
    name: "stack mark inset",
    section: "services",
    open: "#svc-t-4",
    each: "#svc-p-4 .bdg",
    tolMk: 0.05,
    value: `(b) => b.querySelector(".mk").getBoundingClientRect().left - b.getBoundingClientRect().left`,
  },
  {
    name: "stack ink-to-name gap",
    section: "services",
    open: "#svc-t-4",
    each: "#svc-p-4 .bdg",
    tolMk: 0.31,
    value: `(b) => {
      const r = document.createRange();
      r.selectNodeContents(b.querySelector(".bdg-n"));
      return r.getBoundingClientRect().left - b.querySelector(".mk").getBoundingClientRect().right;
    }`,
  },
];

/** Glyphs centred in a filled box. `open` runs first if the state has to be reached. */
const INK = [
  { name: "services index chip", section: "services", open: ".svc-trigger", sel: '.svc-row[data-open="true"] .svc-chip' },
];

const box = `(spec) => {
  const sel = typeof spec === "string" ? spec : spec.ink ?? spec.base;
  const el = document.querySelector(sel);
  if (!el) return null;
  // A baseline is not an edge, so it is reported in both vertical slots and compared on "top".
  // Form fields need the metric route: nothing can be appended inside one to be measured.
  if (spec.base) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    let y;
    if (el.matches("input, textarea, select")) {
      const c = document.createElement("canvas").getContext("2d");
      c.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      const m = c.measureText("Hxg");
      const a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
      const lh = cs.lineHeight === "normal" ? a + d : parseFloat(cs.lineHeight);
      y = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) + (lh - (a + d)) / 2 + a;
    } else {
      const s = document.createElement("span");
      s.style.cssText = "display:inline-block;width:0;height:0";
      el.appendChild(s);
      y = s.getBoundingClientRect().bottom;
      s.remove();
    }
    return { left: r.left, right: r.right, top: y, bottom: y, width: r.width, height: r.height };
  }
  let b;
  if (typeof spec === "string") b = el.getBoundingClientRect();
  else { const r = document.createRange(); r.selectNodeContents(el); b = r.getBoundingClientRect(); }
  return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
}`;

const browser = await pw.firefox.launch();
let failures = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  // A page whose stylesheet 500s lays out as one column of full-width blocks and quietly PASSES
  // most edge checks. Refuse to report on it.
  const rules = await page.evaluate(() =>
    [...document.styleSheets].reduce((n, s) => n + (s.cssRules?.length ?? 0), 0)
  );
  if (rules < 100) {
    console.error(`No stylesheet at ${width}px (${rules} rules). Is the build stale? Rebuild, then restart next start.`);
    process.exit(2);
  }
  const bad = [];

  for (const group of PAIRS) {
    await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), group.section);
    // `open:` for edges that only exist in a disclosed state, same field INK already takes.
    if (group.open) await page.evaluate((s) => document.querySelector(s)?.click(), group.open);
    await page.waitForTimeout(500);
    for (const [label, a, b, edge = "left", minWidth = 0] of group.checks) {
      if (width < minWidth) continue;
      const [ra, rb] = await Promise.all([
        page.evaluate(`(${box})(${JSON.stringify(a)})`),
        page.evaluate(`(${box})(${JSON.stringify(b)})`),
      ]);
      // A selector that matches nothing is a failing check, not a passing one.
      if (!ra || !rb) { bad.push(`${label}: MISSING`); continue; }
      const d = ra[edge] - rb[edge];
      if (Math.abs(d) > TOL) bad.push(`${label}: off ${d.toFixed(1)}px`);
    }
  }

  for (const probe of SPREAD) {
    await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), probe.section);
    if (probe.open) await page.evaluate((sel) => document.querySelector(sel)?.click(), probe.open);
    await page.waitForTimeout(400);
    const r = await page.evaluate(
      ([each, body]) => {
        const els = [...document.querySelectorAll(each)].filter((e) => e.offsetParent);
        if (!els.length) return null;
        // --mk is @property-registered, so it computes to a real length. Read it there and NOT
        // off the keyline box: deriving the unit from the box under test lets a widened box
        // inflate its own tolerance, which is exactly the regression this check exists to catch.
        const mk = parseFloat(getComputedStyle(els[0]).getPropertyValue("--mk"));
        if (!(mk > 0)) return { bad: "--mk did not resolve" };
        const v = els.map(new Function("return " + body)());
        return { mk, lo: Math.min(...v), hi: Math.max(...v), n: els.length };
      },
      [probe.each, probe.value]
    );
    // Nothing matched is a failing check, not a passing one, the same rule the pair checks follow.
    if (!r) { bad.push(`${probe.name}: MISSING`); continue; }
    if (r.bad) { bad.push(`${probe.name}: ${r.bad}`); continue; }
    const limit = r.mk * probe.tolMk;
    if (r.hi - r.lo > limit)
      bad.push(`${probe.name}: spread ${(r.hi - r.lo).toFixed(1)}px over ${r.n} > ${limit.toFixed(1)}px`);
  }

  for (const probe of INK) {
    await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), probe.section);
    await page.waitForTimeout(300);
    if (probe.open) await page.evaluate((s) => document.querySelector(s)?.click(), probe.open);
    await page.waitForTimeout(400);
    const el = await page.$(probe.sel);
    // Hidden below its breakpoint is a pass: there is nothing to centre.
    if (!el || !(await el.isVisible())) continue;
    const shot = (await el.screenshot()).toString("base64");
    const r = await page.evaluate(async (b64) => {
      const bmp = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext("2d");
      g.drawImage(bmp, 0, 0);
      const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < bmp.height; y++)
        for (let x = 0; x < bmp.width; x++) {
          const i = (y * bmp.width + x) * 4;
          const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          if (d[i + 3] > 40 && lum < 110) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      return { W: bmp.width, H: bmp.height, x0, y0, x1, y1 };
    }, shot);
    if (r.x1 < 0) { bad.push(`${probe.name}: no ink found`); continue; }
    const dpr = r.W / (await el.evaluate((e) => e.getBoundingClientRect().width));
    const dx = (r.x0 - (r.W - 1 - r.x1)) / 2 / dpr;
    const dy = (r.y0 - (r.H - 1 - r.y1)) / 2 / dpr;
    if (Math.abs(dx) > TOL || Math.abs(dy) > TOL)
      bad.push(`${probe.name}: ink off dx ${dx.toFixed(2)} dy ${dy.toFixed(2)}`);
  }

  failures += bad.length;
  console.log(String(width).padEnd(6), bad.length ? "FAIL\n       " + bad.join("\n       ") : "ok");
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} misaligned` : "\nall aligned");
process.exit(failures ? 1 : 0);
