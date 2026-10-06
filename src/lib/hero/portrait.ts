// The figure: a keyed photograph run through the field's own dither, so it is made of the same
// material as the pools rather than placed on top of them. Shares the Bayer matrix, the hash, the
// plasma and the field clock, and that sharing is the whole reason its pixels look like they belong.
//
// The reasoning behind the tuning (why the exit converges on nothing, why `spread` must not be
// rescaled, why the bisection excludes the scroll term, why cream paper needs this much ink) lives
// in claude-docs/frontend-conventions.md. What is here is the mechanism.
import type { Rgb } from "./color.ts";
import { BAYER8, hash2, quantize } from "./dither.ts";
import { DOMAIN, plasma } from "./plasma.ts";
import { POOL } from "./pool.ts";

/** Gamma PUSH, not a contrast stretch: it recovers a real black without bleaching the highlights. */
export const GAMMA = 0.65;
/** Screens erased per screen scrolled. Check any change against where the figure finishes (~0.97 screens). */
export const EXIT = 1.4;
/** Erase-band height as a fraction of the viewport: how gradual the edge is. */
export const FADE = 0.35;

/** What the dissolve threshold is made of: plain hash, or the field's own plasma shapes. */
export type Grain = "noise" | "pool";

const DISSOLVE_FROM = 0.6; // bottom shoulder ramp starts here, as a fraction of plate height
// The side cuts get the same ramp over the outer fraction of the width. The source is a crop, so the
// keyed alpha ends on straight lines that describe the frame rather than the body; ramping only the
// bottom left two hard verticals, a slab with a head on it. Wide enough to be a fade, not a bevel.
const DISSOLVE_SIDE = 0.2;
// Gradient magnitude counting as a full edge. Below 1 because a face has no black-to-white steps:
// at 1.0 the term only ever fires on a collar.
const EDGE_KNEE = 0.5;
// Plasma against per-cell hash in the "pool" threshold. Weighted to the plasma because the blobs are
// the point, but not pure, or the dissolve front is a smooth contour: a clean edge, just curved.
const POOL_GRAIN = 0.25;

/** The settled plate. `col` is the fallback for `--p-deep`; HeroPortrait reads the property. */
export const PLATE = {
  levels: 6,
  gain: 1.25,
  wob: 0.035,
  rate: 4,
  dissolve: 1.3,
  cell: 5,
  // OFF. It guaranteed ink on any strong luminance edge, but what it added over the extra level was a
  // traced outline that read as illustration. The Sobel pass is guarded on this, so it is one number
  // away from being back if the face ever loses its structure.
  edge: 0,
  col: [37, 68, 100] as Rgb,
  pool: POOL,
  target: 0.5,
  spread: 0.75,
  grain: "pool" as Grain,
  blend: 0.45,
};

export type PortraitDials = {
  /** Quantization steps. More makes the face more legible, which costs ID-resistance. */
  levels?: number;
  gain?: number;
  /** Wobble amplitude in tone units: the amount of life. */
  wob?: number;
  /** Re-roll cadence in Hz. Twitchiness, separate from amplitude. */
  rate?: number;
  /** Frame ramp strength; 0 leaves a hard cut at every crop edge. */
  dissolve?: number;
  /** Tone added on a full-range luminance edge; 0 disables the Sobel pass entirely. */
  edge?: number;
  cellPx?: number;
  /** The FIELD's cell size, so the plasma is read in the field's own grid coordinates. */
  fieldCellPx?: number;
  ink?: Rgb;
  /** The field's ink, the far end of the exit's colour crossing. */
  pool?: Rgb;
  /** Mean ink to pin `base` to, so loudness never smuggles in density. */
  target?: number;
  /** How much of the band staggers cells against each other. 0 is a clean line, 1 a pixel dissolve. */
  spread?: number;
  /** Fraction of a cell's exit spent carrying its ink from `ink` to `pool`. */
  blend?: number;
  grain?: Grain;
  exit?: number;
  fade?: number;
};

/**
 * 1 where the silhouette runs off a frame edge, 0 where it ends in open wall well inside it, so the
 * dissolve only fires where the CROP actually cut something. Ungated, a side ramp bleaches hair and
 * cheek on a tighter crop, softening a contour the photograph drew.
 */
function cutGate(on: Uint8Array, n: number, span: number, at: (i: number, k: number) => number) {
  const g = new Float32Array(n);
  // A key leaves a pixel or two of fringe short of the border, hence the tolerance.
  const reach = Math.max(2, Math.round(span * 0.02));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < reach; k++) {
      if (on[at(i, k)]) {
        g[i] = 1;
        break;
      }
    }
  }
  // Box blur, so a touching row and a non-touching row do not meet as a visible step.
  const r = Math.max(1, Math.round(n * 0.04));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let d = -r; d <= r; d++) s += g[Math.min(n - 1, Math.max(0, i + d))];
    out[i] = s / (2 * r + 1);
  }
  return out;
}

export class Portrait {
  readonly levels: number;
  readonly cellPx: number;
  private readonly gain: number;
  private readonly wob: number;
  private readonly rate: number;
  /** Last sparkle frame written. `-1` is "nothing yet", which is what a rebuild resets to. */
  private lastFr = -1;
  /** The rows the last `repaint` actually changed, recorded while writing them. */
  private y0 = 0;
  private y1 = 0;
  private readonly dissolve: number;
  private readonly edge: number;
  private readonly fieldCellPx: number;
  private readonly ink: Rgb;
  private readonly pool: Rgb;
  private readonly target: number;
  private readonly spread: number;
  private readonly blend: number;
  private readonly grain: Grain;
  private readonly exit: number;
  private readonly fade: number;

  private gw = 0;
  private gh = 0;
  private originX = 0;
  private originY = 0;
  private vh = 1;
  /** Row below which no ink survives. `Infinity` is "nothing erased", the honest opening state. */
  private cut = Infinity;
  /** Band height above `cut` that the erase ramps across, in rows. */
  private soft = 1;

  private tone = new Float32Array(0);
  private seed = new Float32Array(0);
  private live = new Int32Array(0);
  /** Pinned to a plain ArrayBuffer so it can back an ImageData with no copy. */
  private out = new Uint8ClampedArray(0) as Uint8ClampedArray<ArrayBuffer>;

  constructor(d: PortraitDials = {}) {
    this.levels = d.levels ?? PLATE.levels;
    this.gain = d.gain ?? PLATE.gain;
    this.wob = d.wob ?? PLATE.wob;
    this.rate = d.rate ?? PLATE.rate;
    this.dissolve = d.dissolve ?? PLATE.dissolve;
    this.edge = d.edge ?? PLATE.edge;
    this.cellPx = d.cellPx ?? PLATE.cell;
    this.fieldCellPx = d.fieldCellPx ?? PLATE.cell;
    this.ink = d.ink ?? PLATE.col;
    this.pool = d.pool ?? PLATE.pool;
    this.target = d.target ?? PLATE.target;
    this.spread = d.spread ?? PLATE.spread;
    this.blend = d.blend ?? PLATE.blend;
    this.grain = d.grain ?? PLATE.grain;
    this.exit = d.exit ?? EXIT;
    this.fade = d.fade ?? FADE;
  }

  /** The RGBA buffer to hand an ImageData. Valid after `build`. */
  get pixels() {
    return this.out;
  }

  /**
   * Build the plate from an RGBA sample at grid resolution, with the wall keyed to alpha 0 so there
   * is no rectangle to place. `origin` is the plate's position in page px, which is what lets the
   * wobble read the FIELD's plasma rather than a private one.
   *
   * Two things earn their cost. `base` is found by BISECTION against a target mean ink: tone is
   * affine in base, so everything else sums once into `t0` and only the offset is searched, which is
   * what makes the shoulder dissolve a tonal gain rather than a blend. And the LIVE INDEX is the perf
   * story: a cell can only change state when its static tone sits within `wob` of a quantization
   * boundary, so indexing those once turns a ~70k-cell per-frame loop into ~15k.
   */
  build(src: Uint8ClampedArray, gw: number, gh: number, origin: { x: number; y: number }) {
    const n = gw * gh;
    const { levels, gain, edge, dissolve } = this;
    const t0 = new Float32Array(n); // tone without `base`
    const lum = new Float32Array(n);
    const on = new Uint8Array(n);
    const dstep = 1 / (levels - 1);
    const from = Math.floor(gh * DISSOLVE_FROM);
    const side = Math.max(1, Math.floor(gw * DISSOLVE_SIDE));
    let subject = 0;

    this.gw = gw;
    this.gh = gh;
    this.originX = origin.x;
    this.originY = origin.y;

    for (let i = 0; i < n; i++) {
      const q = i << 2;
      if (src[q + 3] < 128) {
        lum[i] = 1;
        continue;
      }
      on[i] = 1;
      subject++;
      lum[i] = (0.2126 * src[q] + 0.7152 * src[q + 1] + 0.0722 * src[q + 2]) / 255;
    }

    // Sobel magnitude INSIDE the silhouette only: a cell touching the matte edge is skipped, so the
    // outline never feeds the term. /4 puts a full black-to-white step near 1.
    const grad = new Float32Array(n);
    if (edge > 0) {
      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const i = y * gw + x;
          if (!on[i]) continue;
          if (
            !on[i - gw - 1] || !on[i - gw] || !on[i - gw + 1] ||
            !on[i - 1] || !on[i + 1] ||
            !on[i + gw - 1] || !on[i + gw] || !on[i + gw + 1]
          ) continue;
          const gx =
            lum[i - gw + 1] + 2 * lum[i + 1] + lum[i + gw + 1] -
            (lum[i - gw - 1] + 2 * lum[i - 1] + lum[i + gw - 1]);
          const gy =
            lum[i + gw - 1] + 2 * lum[i + gw] + lum[i + gw + 1] -
            (lum[i - gw - 1] + 2 * lum[i - gw] + lum[i - gw + 1]);
          grad[i] = Math.min(1, Math.hypot(gx, gy) / 4 / EDGE_KNEE);
        }
      }
    }

    // One gate per edge, indexed along that edge: rows for the sides, columns for the bottom.
    const gateL = cutGate(on, gh, gw, (y, k) => y * gw + k);
    const gateR = cutGate(on, gh, gw, (y, k) => y * gw + (gw - 1 - k));
    const gateB = cutGate(on, gw, gh, (x, k) => (gh - 1 - k) * gw + x);

    for (let y = 0; y < gh; y++) {
      const row = BAYER8[y & 7];
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        if (!on[i]) continue;
        // MAX of the three ramps, not their sum: a corner is one cut seen twice, and adding them
        // punches a hole there while the middle of each edge stays hard. Squared, so the shoulders
        // hold their weight and then let go. Applied to TONE, so what thins is the ink.
        const k = Math.max(
          y >= from ? ((y - from) / (gh - from)) * gateB[x] : 0,
          x < side ? ((side - x) / side) * gateL[y] : 0,
          x > gw - 1 - side ? ((x - (gw - 1 - side)) / side) * gateR[y] : 0,
        );
        t0[i] =
          gain * (1 - Math.pow(lum[i], GAMMA)) -
          k * k * dissolve +
          edge * grad[i] +
          (row[x & 7] / 64 - 0.5) * 1.15 * dstep +
          (hash2(x, y) - 0.5) * 0.55 * dstep;
      }
    }

    // The SCROLL EXIT is deliberately not in that sum: this search pins the mean, so a scroll-varying
    // term would drag `base` up as the reader scrolls and redistribute the erased ink into the face.
    const meanInk = (b: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) if (on[i]) s += quantize(b + t0[i], levels);
      return subject ? s / subject : 0;
    };
    let lo = -1;
    let hi = 0.4;
    for (let j = 0; j < 26; j++) {
      const m = (lo + hi) / 2;
      if (meanInk(m) < this.target) lo = m;
      else hi = m;
    }
    const base = (lo + hi) / 2;

    const tone = new Float32Array(n);
    const out = new Uint8ClampedArray(n * 4) as Uint8ClampedArray<ArrayBuffer>;
    const live: number[] = [];
    // In quantizer units the boundaries are the half-integers, so "can this cell flip" is one
    // distance test with no loop over levels.
    const reach = this.wob * (levels - 1);
    for (let i = 0; i < n; i++) {
      const q = i << 2;
      if (!on[i]) {
        out[q + 3] = 0;
        continue;
      }
      const t = base + t0[i];
      tone[i] = t;
      out[q] = this.ink[0];
      out[q + 1] = this.ink[1];
      out[q + 2] = this.ink[2];
      out[q + 3] = quantize(t, levels) * 255;
      const u = t * (levels - 1);
      if (reach > 0 && Math.abs(u - 0.5 - Math.round(u - 0.5)) < reach) live.push(i);
    }

    this.tone = tone;
    this.out = out;
    this.live = Int32Array.from(live);
    this.lastFr = -1;
    this.seed = this.buildSeed(on);
  }

  /** Set the viewport height; the erase band's height in rows follows it. */
  viewport(vh: number) {
    this.vh = vh;
    this.soft = Math.max(1, (this.fade * vh) / this.cellPx);
  }

  /** Nothing of the figure is left. The threshold is `writeCell`'s own cutoff read backwards: a cell is gone
   *  at `u >= 1`, `u` is `bandAt(y) - seed*spread`, and the last cell to go is the one at row 0 with
   *  seed 1. So the whole plate is clear once the band's top edge has passed `spread` bands above it. */
  get erased() {
    return this.cut <= -this.spread * this.soft;
  }

  /** Place the erase line at a grid row. True if it moved enough to be worth a repaint. */
  setCut(row: number) {
    if (Math.abs(row - this.cut) < 0.5) return false;
    this.cut = row;
    return true;
  }

  /**
   * Place the erase line for a scroll position. `docTop` is the plate's top in DOCUMENT px, measured
   * once per resize, so this stays pure arithmetic and never forces a layout mid-scroll. The band
   * starts a full `fade` BELOW the fold, which is what leaves the hero at rest untouched.
   */
  scrollTo(scrollY: number, docTop: number) {
    const band = this.fade * this.vh;
    return this.setCut((this.vh + band - scrollY * this.exit - docTop) / this.cellPx);
  }

  /**
   * Re-ink the whole plate for the current cut, in place. The loop is the whole grid rather than the
   * band, because scrolling back UP has to restore rows the band already passed. Off-silhouette cells
   * need no mask: `tone` is 0 there and `quantize(0)` is 0, so they stay transparent.
   */
  repaint() {
    const { gw, gh, tone, seed, out } = this;
    // The loop is the whole grid, because scrolling back UP has to restore rows the band already
    // passed. What is NOT the whole grid is the upload: the rows that actually changed are recorded
    // as they are written, so the caller can send just those. Deriving that range from the cut
    // instead was tried and left one cell of 76,800 stale at a boundary (measurable, not
    // explicable), and this costs one comparison per cell to be exact by construction.
    let lo = gh;
    let hi = 0;
    for (let y = 0; y < gh; y++) {
      // Only the band fraction is row-constant; the progress itself is per cell. That is the stagger.
      const b = this.bandAt(y);
      const row = y * gw;
      let changed = false;
      for (let x = 0; x < gw; x++) {
        const i = row + x;
        const q = i << 2;
        const a0 = out[q];
        const a3 = out[q + 3];
        this.writeCell(i, tone[i], b - seed[i] * this.spread);
        if (!changed && (out[q + 3] !== a3 || out[q] !== a0)) changed = true;
      }
      if (changed) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    }
    this.y0 = lo;
    this.y1 = hi + 1;
  }

  /** The rows the last `repaint` rewrote, as an upload band. */
  get band() {
    return { y: this.y0, h: Math.max(0, this.y1 - this.y0) };
  }

  /**
   * Repaint the live cells for one tick. `t` is field time (the pools' own clock, so the activity
   * drifts with them); `secs` is wall time and only the re-roll counter uses it.
   *
   * SPARKLE: the plasma decides WHERE the activity is, a per-cell hash decides WHICH cells move
   * inside it. The hash is zero-mean per cell, so nothing bleaches however loud this gets.
   *
   * Returns whether it changed anything (see the frame guard below).
   */
  tick(t: number, secs: number) {
    const { gw, tone, live, seed, wob, spread, cellPx, fieldCellPx, originX, originY } = this;
    const fr = Math.floor(secs * this.rate);
    // The sparkle re-rolls `rate` times a second (4Hz), so between re-rolls this rewrites the same
    // cells to the same values and the caller uploads an identical 2-megapixel picture. Reporting
    // "nothing changed" is what lets it skip both. The plasma term is sampled on the same clock
    // rather than continuously, which is the one visible consequence: the wobble's amplitude now
    // steps with its own re-roll instead of drifting between them.
    if (fr === this.lastFr) return false;
    this.lastFr = fr;
    const ax = fr * 7919;
    const ay = fr * 104729;
    for (let j = 0; j < live.length; j++) {
      const i = live[j];
      const x = i % gw;
      const y = (i / gw) | 0;
      // Page px, divided by the FIELD's cell size: same page, same plasma coordinates. It is the
      // field's cell and not the plate's, because what has to line up is the plasma, not the grid.
      const gx = ((originX + x * cellPx) / fieldCellPx) * DOMAIN.sx;
      const gy = ((originY + y * cellPx) / fieldCellPx) * DOMAIN.sy;
      const act = 0.5 + 0.5 * plasma(gx, gy, t);
      // The exit is applied here too: a live cell inside the band is rewritten from `tone` on the next
      // frame, so leaving it out pops every wobbling cell back to full ink when scrolling stops.
      const tt = tone[i] + wob * act * (hash2(x + ax, y - ay) - 0.5) * 2;
      this.writeCell(i, tt, this.bandAt(y) - seed[i] * spread);
    }
    return true;
  }

  /** How far into the band a ROW is: 0 at the band's top edge, 1 at `cut`. Row-constant. */
  private bandAt(y: number) {
    return (y - (this.cut - this.soft)) / this.soft;
  }

  /**
   * One cell's RGBA. Both painters go through here rather than repeating the maths, because the two
   * disagreeing about a cell is the failure this class is arranged around: a live cell would flicker
   * between the crossed colour and the raw one every time the reader stopped scrolling.
   *
   * Tone converges on NOTHING, and the thinning is multiplicative. RGB is written whenever `blend` is
   * on, not only while crossing: at m = 0 the lerp returns `ink` exactly, which is what restores the
   * figure when the reader scrolls back up.
   */
  private writeCell(i: number, t: number, u: number) {
    const q = i << 2;
    const { blend, ink, pool, out } = this;
    if (blend > 0) {
      const m = blend <= 0 || u <= 0 ? 0 : Math.min(1, u / blend);
      out[q] = ink[0] + (pool[0] - ink[0]) * m;
      out[q + 1] = ink[1] + (pool[1] - ink[1]) * m;
      out[q + 2] = ink[2] + (pool[2] - ink[2]) * m;
    }
    out[q + 3] = quantize(u <= 0 ? t : u >= 1 ? 0 : t * (1 - u), this.levels) * 255;
  }

  /**
   * Where in the band each cell gives up. Built once per build, because the alternative is a plasma
   * call per cell per row-crossing and `repaint` already walks the whole grid.
   *
   * `pool` reads the field's plasma at the field's own coordinates, so the figure comes apart in the
   * shapes the pools are already making. Min/max normalized over the silhouette, or a threshold
   * that never reaches 0 or 1 leaves both ends of the band doing nothing. Sampled at t = 0: this
   * needs the plasma's SHAPE, not its phase.
   */
  private buildSeed(on: Uint8Array) {
    const { gw, gh, cellPx, fieldCellPx, originX, originY } = this;
    const seed = new Float32Array(gw * gh);
    if (this.grain === "noise") {
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) seed[y * gw + x] = hash2(x, y);
      return seed;
    }

    let lo = Infinity;
    let hi = -Infinity;
    for (let y = 0; y < gh; y++) {
      const gy = ((originY + y * cellPx) / fieldCellPx) * DOMAIN.sy;
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const v = plasma(((originX + x * cellPx) / fieldCellPx) * DOMAIN.sx, gy, 0);
        seed[i] = v;
        if (!on[i]) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }

    const span = 1 / Math.max(1e-6, hi - lo);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const a = Math.min(1, Math.max(0, (seed[i] - lo) * span));
        seed[i] = a * (1 - POOL_GRAIN) + hash2(x, y) * POOL_GRAIN;
      }
    }
    return seed;
  }
}
