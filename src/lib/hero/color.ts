// Colour values the hero painters share, and the parser that reads them out of CSS.

/** 8-bit sRGB triple. */
export type Rgb = [number, number, number];

/** `#rgb` / `#rrggbb`, whitespace tolerated, as `getPropertyValue` hands it back. */
export function parseHex(v: string): Rgb | null {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}
