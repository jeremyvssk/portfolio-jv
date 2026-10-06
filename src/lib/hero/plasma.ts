// The substrate both canvases are made of: a domain-warped sum of three sines, on one clock, so
// their textures drift together instead of running two private animations.

// 5 trig calls per cell at ~70k cells x 60fps is 21M Math.sin/s. `|0` truncates and `& MASK` wraps
// (negative ints mask to the correct slot), so a table read costs no branch.
const SIZE = 4096;
const MASK = SIZE - 1;
const SCALE = SIZE / (Math.PI * 2);
const TABLE = new Float32Array(SIZE);
for (let i = 0; i < SIZE; i++) TABLE[i] = Math.sin((i / SIZE) * Math.PI * 2);

const sin = (x: number) => TABLE[((x * SCALE) | 0) & MASK];
const cos = (x: number) => TABLE[(((x * SCALE) | 0) + (SIZE >> 2)) & MASK];

/**
 * How the field samples the domain. NEVER sample it square: at sx === sy the bands close into
 * concentric rings around every extremum. See claude-docs/frontend-conventions.md.
 */
export const DOMAIN = { sx: 0.52, sy: 1.3 };

/** Field-time per millisecond. A mark with no hard edge makes this read as still (see the doc). */
export const RATE = 0.00028;

export function plasma(x: number, y: number, t: number) {
  const wx = x + 7 * sin(y * 0.075 + t * 0.55);
  const wy = y + 7 * cos(x * 0.085 - t * 0.45);
  return (
    (sin(wx * 0.085 + t * 0.8) + sin(wy * 0.1 - t * 0.65) + sin((wx + wy) * 0.055 + t * 0.45)) / 3
  );
}
