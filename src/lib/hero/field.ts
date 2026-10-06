// The hero's living background: the pool as a dithered pixel field, with contour lines drifting
// through a wash that moves with them. Writes ALPHA rather than opaque RGB, so paper and the body bloom
// show through the gaps.
//
// NOTHING here reacts to the cursor, and that is a decision rather than an omission. Two versions
// were tried and both cut: a tone bump inside a radius, which painted a darker disc that followed
// the pointer around, and a domain warp that bent the contours instead of inking them. The second
// added no ink and still went. The field is weather, and weather does not notice you.
//
// Why 4 steps, why base pulls against gain, and why the two dials must stay two:
// claude-docs/frontend-conventions.md.
import type { Rgb } from "./color.ts";
import { BAYER8, hash2, quantize } from "./dither.ts";
import { DOMAIN, plasma } from "./plasma.ts";
import { POOL, type PoolShape } from "./pool.ts";

/** CSS px per cell. The plate uses the SAME number: one cell size for the whole page. */
export const FIELD_CELL = 5;
/** Quantization character: how many steps the tone lands on, and how dark the darkest is. */
export const INTENSITY = 0.55;
/** Loudness. The one dial to move if the pools read too quiet or too loud. */
export const SAUCE = 1;

// Lines per pool, and how thin each is. Below ~2.4 width the dither eats the line; below ~1.4 bands
// the sweeps merge and the direction goes.
const BANDS = 2.4;
const WIDTH = 3.2;

export type FieldDials = {
  intensity?: number;
  sauce?: number;
  cellPx?: number;
  ink?: Rgb;
};

export class Field {
  readonly levels: number;
  readonly cellPx: number;
  private readonly ceiling: number;
  private readonly base: number;
  private readonly gain: number;
  private readonly ink: Rgb;
  private pools: Float32Array | null = null;
  private gw = 0;
  private gh = 0;

  constructor({
    intensity = INTENSITY,
    sauce = SAUCE,
    cellPx = FIELD_CELL,
    ink = POOL,
  }: FieldDials = {}) {
    this.levels = Math.round(6 - 3 * intensity);
    this.ceiling = 0.7 + 0.3 * intensity;
    this.base = 0.3 * sauce;
    this.gain = 1.15 * sauce;
    this.cellPx = cellPx;
    this.ink = ink;
  }

  /** Cell grid for a layer size, which is what the canvas backing store should be. */
  static gridFor(w: number, h: number, cellPx: number) {
    return { gw: Math.max(1, Math.round(w / cellPx)), gh: Math.max(1, Math.round(h / cellPx)) };
  }

  /** Size to a cell grid and precompute the pool shapes. */
  resize(gw: number, gh: number, pool: PoolShape) {
    this.gw = gw;
    this.gh = gh;
    this.pools = pool.grid(gw, gh, this.cellPx);
  }

  /** One frame into an RGBA buffer. */
  paint(data: Uint8ClampedArray, t: number) {
    const amt = this.pools;
    if (!amt) return;
    const { gw, gh, levels, ceiling, base, gain, ink } = this;
    // Dither amplitude tracks one quantization step: smaller and it bands, larger and it fizzes.
    const dstep = 1 / (levels - 1);

    for (let y = 0; y < gh; y++) {
      const row = BAYER8[y & 7];
      const py = y * DOMAIN.sy;
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        const o = i << 2;
        const a0 = amt[i];
        // Bare paper stays bare.
        if (a0 < 0.005) {
          data[o + 3] = 0;
          continue;
        }

        const h = plasma(x * DOMAIN.sx, py, t);
        // Distance to the nearest band edge, inverted: 1 on a contour line, 0 mid-band.
        const f = (h * BANDS + 4) % 1;
        const line = 1 - Math.min(1, Math.abs(f - 0.5) * WIDTH);
        // Half contour, half the raw height as a wash. The two peak in different places, so the mark
        // never reaches 1.0 and the field keeps headroom over the text at the foot of the hero.
        const mark = 0.5 * line + 0.5 * (0.5 + 0.5 * h);

        let tone = a0 * (base + gain * mark);
        tone += (row[x & 7] / 64 - 0.5) * 1.15 * dstep;
        tone += (hash2(x, y) - 0.5) * 0.9 * dstep;

        data[o] = ink[0];
        data[o + 1] = ink[1];
        data[o + 2] = ink[2];
        data[o + 3] = quantize(tone, levels) * ceiling * 255;
      }
    }
  }
}
