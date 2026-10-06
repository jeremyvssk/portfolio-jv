"use client";
// The hero's living background: the pool as a dithered pixel field instead of a smooth gradient,
// with contour lines drifting through a wash that moves with them.
//
// A canvas at 1/6 scale upscaled with `image-rendering: pixelated`. The chunky cell is the point, and
// it keeps the per-frame cost at ~70k cells rather than 2.6M. The drift is the whole animation and
// it answers to nothing but the clock (see field.ts on why the cursor was taken out of it).
//
// The paint runs in `field.worker.ts`, on its own thread; this file only hands over the canvas and
// tells it how big it is. WITHOUT `OffscreenCanvas` there is no field at all, deliberately: the CSS
// pool underneath is the same shape in a smooth gradient and is already what ships before hydration
// and with JS off, so the hero degrades to a composition that works rather than to a hole.
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { hostCanvas } from "@/lib/browser/canvasHost";
import { FIELD_CELL, parseHex, POOL } from "@/lib/hero";

export default function HeroField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const still = useReducedMotion() ?? false;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // The canvas is created here rather than rendered: `transferControlToOffscreen` is permanent, so
    // an element that outlives the effect can never be handed over twice, which happens on every
    // remount in development.
    const cvs = document.createElement("canvas");
    // Without a canvas the CSS pool is the finished state.
    if (!cvs.transferControlToOffscreen) return;
    cvs.className = "block size-full [image-rendering:pixelated]";
    wrap.appendChild(cvs);

    // The ink comes from `--p-pool` rather than a constant, so the smooth CSS pool underneath and the
    // dithered one on top cannot disagree, and an override up the tree re-inks both. Read off `wrap`,
    // not the root, for exactly that reason.
    const ink = parseHex(getComputedStyle(wrap).getPropertyValue("--p-pool")) ?? POOL;
    const worker = new Worker(new URL("../lib/browser/field.worker.ts", import.meta.url));
    const canvas = cvs.transferControlToOffscreen();
    worker.postMessage({ kind: "init", canvas, cellPx: FIELD_CELL, ink, still, shape: "hero" }, [canvas]);

    const host = hostCanvas(
      wrap,
      (g) => worker.postMessage({ kind: "size", g }),
      (on) => worker.postMessage({ kind: "run", on }),
    );

    return () => {
      host.stop();
      worker.terminate();
      cvs.remove();
    };
  }, [still]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      // NOT `inset-0`: the ink ends at 1.02svh + 0.76 x 0.7048svh = 1.556svh (the pool's centre plus
      // its last ramp stop), so 156svh is all that ever paints. Pinned at the TOP so the plasma
      // coordinates match the plate's. Re-derive from `Pool.strengthAt` if the arc moves.
      className="hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[156svh] overflow-clip"
    />
  );
}
