// The hero's colour pool as geometry. MIRRORS `.pool-se` in globals.css and must change with it:
// the CSS pool paints underneath as the pre-hydration fallback, so any disagreement shows as a
// colour jump the moment the canvas mounts.
//
// This file holds the FULL ellipse. The stylesheet's box is deliberately 0.78 of it with its stops
// rescaled to match, because everything past 0.78 is transparent and rasterizing it cost 40% of the
// layer's area for nothing (see the trim note on `.hero-pools > div`). The two describe the same
// shape; only the CSS box is smaller. Multiply a radius here by 0.78 to get the CSS one.
import type { Rgb } from "./color.ts";

/** Layer size plus the viewport, which the radius caps read. */
export type Geom = { w: number; h: number; vh: number; vmax: number };

/** `--p-pool` #7a8dad. Fallback only: HeroField reads the property, so CSS stays the source. */
export const POOL: Rgb = [122, 141, 173];

// The CSS gradient's alpha profile, as (distance/radius -> alpha), against the FULL radius. Knowingly
// 40/76 where the stylesheet is 42/78 of that radius (53.85/100 of its trimmed box), a few px
// apart at the rim, left alone.
const STOPS: [number, number][] = [
  [0, 0.88],
  [0.4, 0.45],
  [0.76, 0],
];

function ramp(u: number) {
  for (let i = 1; i < STOPS.length; i++) {
    if (u <= STOPS[i][0]) {
      const [a, av] = STOPS[i - 1];
      const [b, bv] = STOPS[i];
      return av + ((u - a) / (b - a)) * (bv - av);
    }
  }
  return 0;
}

/** What `Field` needs from a pool. Two shapes implement it: the hero's, and the contact floor's. */
export interface PoolShape {
  grid(gw: number, gh: number, cellPx: number): Float32Array;
}

export class Pool implements PoolShape {
  private readonly g: Geom;

  // Assigned in the body rather than declared as a parameter property: Node's strip-only type
  // removal rejects those, and that would break the offline `node` render this module exists for.
  constructor(g: Geom) {
    this.g = g;
  }

  /** Strength at a point, in layer px. */
  strengthAt(px: number, py: number) {
    const g = this.g;
    // The centre sits off-frame so only an arc shows: a shape that fits inside the viewport reads as
    // a blob, and the radius is what buys the curve. Three caps, because the same flat-corner-wash
    // failure appears on a different axis for each screen shape: vmax is the height on a portrait
    // phone and the width on an ultrawide.
    // Size and anchor are ONE decision: see the note on `.pool-se`.
    const rs = Math.min(0.4404 * g.vmax, 0.7154 * g.w, 0.7048 * g.vh);
    // The ellipse's long axis follows the viewport's. Stretched sideways on a phone the pool spent
    // its reach on the short axis and died a third of the way down the screen.
    const portrait = g.vh > g.w;
    const sx = portrait ? 1 : 0.68;
    const sy = portrait ? 0.68 : 1;
    const ds = Math.hypot((px - 0.84 * g.w) * sx, (py - 1.02 * g.vh) * sy) / rs;
    return Math.min(1, ramp(ds));
  }

  /** Strength per cell, precomputed: the shapes are static, only the plasma moves. Keeps two
   *  hypots per cell out of the per-frame loop entirely. */
  grid(gw: number, gh: number, cellPx: number) {
    const amt = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) amt[y * gw + x] = this.strengthAt(x * cellPx, y * cellPx);
    }
    return amt;
  }
}

/** The contact floor's bend: a superellipse, p 1.25, so the peak is pointed and the sides run
 *  straight. RX is solved so the left edge lands where an ellipse of horizontal radius 1.12w would. */
const FLOOR_P = 1.25;
const FLOOR_RX = 1.6838;

/** The contact section's floor: the same falloff laid flat along the page's foot, densest right of
 *  centre. Nearly all of the fall is vertical, and 1.3h puts the first cells at the floor's top edge,
 *  so the pixels begin right under the last line of the form. ContactFloor paints its tint from this
 *  too, since no CSS gradient draws a superellipse. */
export class FloorPool implements PoolShape {
  private readonly w: number;
  private readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  strengthAt(px: number, py: number) {
    const ax = Math.abs(px - 0.66 * this.w) / (FLOOR_RX * this.w);
    const ay = Math.abs(this.h + 12 - py) / (1.3 * this.h);
    return Math.min(1, ramp((ax ** FLOOR_P + ay ** FLOOR_P) ** (1 / FLOOR_P)));
  }

  grid(gw: number, gh: number, cellPx: number) {
    const amt = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) amt[y * gw + x] = this.strengthAt(x * cellPx, y * cellPx);
    }
    return amt;
  }
}
