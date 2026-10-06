// The stack wall's marks, read out of StackWall.tsx, plus the alpha reader both mark checks need.
// Shared so `check:marks` (are the constants right?) and `check:legible` (does each mark survive
// the size it is drawn at?) can never disagree about which files the wall ships or how their alpha is read.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** One byte per pixel. PGM rather than a decoder, because webp is not a dependency of this repo. */
export function parsePGM(raw) {
  const head = [];
  let i = 0;
  while (head.length < 4) {
    while (raw[i] === 0x20 || raw[i] === 0x0a || raw[i] === 0x09 || raw[i] === 0x0d) i++;
    if (raw[i] === 0x23) { while (raw[i] !== 0x0a) i++; continue; }
    const j = i;
    while (raw[i] > 0x20) i++;
    head.push(raw.toString("latin1", j, i));
  }
  const [, w, h, max] = head.map(Number);
  const d = raw.subarray(i + 1);
  return { w, h, d, a: Float32Array.from(d.subarray(0, w * h), (v) => v / max) };
}

export function alphaOf(file, extra = []) {
  return parsePGM(execFileSync("magick", [file, ...extra, "-alpha", "extract", "-depth", "8", "pgm:-"],
    { maxBuffer: 1 << 28 }));
}

const SRC = readFileSync("src/components/StackWall.tsx", "utf8");

/** The four names on the closed row's preview strip, the smallest box a mark is drawn in, so the
 *  size checks have to know which marks land there and which never do. */
export const PEEK = (SRC.match(/const PEEK = \[([^\]]+)\]/)?.[1].match(/"[^"]+"/g) ?? [])
  .map((s) => s.slice(1, -1));

export const MARKS = (() => {
  const src = SRC;
  const found = [...src.matchAll(/\{ name: "([^"]+)", src: (\w+)\.src, a: ([\d.]+), k: ([\d.]+) \}/g)]
    .map((m) => ({ name: m[1], id: m[2], file: `src/img/logos/${m[2]}.webp`, a: +m[3], k: +m[4] }));
  if (!found.length) { console.error("no marks parsed from StackWall.tsx"); process.exit(2); }
  return found;
})();
