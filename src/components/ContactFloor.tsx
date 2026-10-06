"use client";
// The contact section's floor: the hero's field returns as ground the page ends on. Same worker,
// same Field, same cell; only the pool shape differs (`FloorPool`).
//
// Two canvases, like the hero's two layers: a still tint (`.pool-se`'s 0.3 of the ramp, painted here
// once per size, smooth-scaled) under the worker's dither. Without `OffscreenCanvas` only the tint
// is drawn, and that is the finished state.
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { hostCanvas } from "@/lib/browser/canvasHost";
import { Field, FIELD_CELL, FloorPool, parseHex, POOL, type Geom, type Rgb } from "@/lib/hero";

function paintTint(cvs: HTMLCanvasElement, g: Geom, ink: Rgb) {
  const ctx = cvs.getContext("2d");
  if (!ctx) return;
  const { gw, gh } = Field.gridFor(g.w, g.h, FIELD_CELL);
  cvs.width = gw;
  cvs.height = gh;
  const amt = new FloorPool(g.w, g.h).grid(gw, gh, FIELD_CELL);
  const img = ctx.createImageData(gw, gh);
  for (let k = 0; k < amt.length; k++) {
    img.data.set([ink[0], ink[1], ink[2], amt[k] * 0.3 * 255], k * 4);
  }
  ctx.putImageData(img, 0, 0);
}

export default function ContactFloor() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const still = useReducedMotion() ?? false;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ink = parseHex(getComputedStyle(wrap).getPropertyValue("--p-pool")) ?? POOL;

    const tint = document.createElement("canvas");
    tint.className = "absolute inset-0 size-full";
    wrap.appendChild(tint);

    // Created here, not rendered: see HeroField on why a transferred canvas cannot outlive the effect.
    const cvs = document.createElement("canvas");
    let worker: Worker | undefined;
    if (cvs.transferControlToOffscreen) {
      cvs.className = "absolute inset-0 block size-full [image-rendering:pixelated]";
      wrap.appendChild(cvs);
      worker = new Worker(new URL("../lib/browser/field.worker.ts", import.meta.url));
      const canvas = cvs.transferControlToOffscreen();
      worker.postMessage({ kind: "init", canvas, cellPx: FIELD_CELL, ink, still, shape: "floor" }, [canvas]);
    }

    const host = hostCanvas(
      wrap,
      (g) => {
        paintTint(tint, g, ink);
        worker?.postMessage({ kind: "size", g });
      },
      (on) => worker?.postMessage({ kind: "run", on }),
    );

    return () => {
      host.stop();
      worker?.terminate();
      tint.remove();
      cvs.remove();
    };
  }, [still]);

  return <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0" />;
}
