// The screen: an ordered matrix, a hash, and the quantizer they feed.

/** 8x8 ordered (Bayer) matrix: the structured half, and what reads as printed rather than noisy. */
export const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/** Deterministic hash: the unstructured half, so the Bayer grid never reads as a lattice. */
export function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

/** Tone -> ink. Every painter goes through here, so none can disagree about a given tone. The
 *  `t <= 0` guard is what makes a finished cell exactly zero ink rather than a faint residue. */
export function quantize(t: number, levels: number) {
  return t <= 0 ? 0 : Math.round(Math.min(1, t) * (levels - 1)) / (levels - 1);
}
