"use client";
// The figure: a keyed photograph run through the hero's own dither, so it is made of the same material
// as the pools rather than placed on top of them.
//
// THE STATIC PNG UNDERNEATH IS NOT A NICETY. The `<img>` puts the figure in the server HTML, so the
// hero is complete before any bundle arrives and stays complete with JS off. It hides the moment the
// canvas has painted its first frame, so the two never double-print through each other's gaps, and
// it is also the whole fallback where `OffscreenCanvas` is missing, which is why nothing here needs
// a second, main-thread copy of the paint loop.
//
// One image load and a layout box. The plate maths runs in `plate.worker.ts`, off the thread the
// page's own scrolling is waiting on.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { hostCanvas } from "@/lib/browser/canvasHost";
import { FIELD_CELL, parseHex, PLATE, POOL } from "@/lib/hero";

type Props = {
  /** Keyed portrait, alpha = silhouette. Sampled, never displayed. */
  src: string;
  /** Pre-dithered plate at grid resolution: the no-JS figure. */
  still: string;
  /** Mirror the figure horizontally. Defaults ON: the plate sits right of the column, so unflipped
   *  the figure looks off the edge of the page and the mirror turns the gaze back into it. */
  flip?: boolean;
  className?: string;
};

export default function HeroPortrait({ src, still, flip = true, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const frozen = useReducedMotion() ?? false;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Created here rather than rendered: `transferControlToOffscreen` is permanent, so an element
    // that outlives the effect can never be handed over twice.
    const cvs = document.createElement("canvas");
    // Without a canvas the static plate is the figure.
    if (!cvs.transferControlToOffscreen) return;
    cvs.className = "absolute inset-0 size-full [image-rendering:pixelated]";
    wrap.appendChild(cvs);

    // Both colours are read from CSS rather than mirrored in TS: the rung is chosen in the
    // stylesheet, and a colour copied into TS is a colour that will drift.
    const cs = getComputedStyle(wrap);
    const worker = new Worker(new URL("../lib/browser/plate.worker.ts", import.meta.url));
    const canvas = cvs.transferControlToOffscreen();
    worker.postMessage(
      {
        kind: "init",
        canvas,
        // Absolute: a relative URL inside a worker resolves against the worker's own chunk.
        src: new URL(src, location.href).href,
        flip,
        still: frozen,
        fieldCellPx: FIELD_CELL,
        ink: parseHex(cs.getPropertyValue("--p-deep")) ?? PLATE.col,
        pool: parseHex(cs.getPropertyValue("--p-pool")) ?? POOL,
      },
      [canvas],
    );
    worker.addEventListener("message", () => setLive(true));

    // The plate's top in DOCUMENT px, measured once per resize, so the scroll path stays pure
    // arithmetic and never forces a layout while the reader is scrolling.
    let docTop = 0;
    const host = hostCanvas(
      wrap,
      (g, r) => {
        docTop = r.top + window.scrollY;
        worker.postMessage({
          kind: "size",
          box: {
            w: g.w,
            h: g.h,
            vh: g.vh,
            originX: wrap.offsetLeft,
            originY: wrap.offsetTop,
            docTop,
            scrollY: window.scrollY,
          },
        });
      },
      (on) => worker.postMessage({ kind: "run", on }),
    );

    // The cut is driven from SCROLL, not from the loop, and that is correctness rather than taste:
    // under reduced motion the worker paints exactly one frame and never loops, so a cut computed
    // in the loop would park a headless torso in About. A scroll-linked erase is reader-driven, so
    // it is the one part of this plate that keeps working there.
    // Coalesced to a frame: scroll fires far more often than the compositor paints.
    let sf = 0;
    const post = () => {
      sf = 0;
      worker.postMessage({ kind: "scroll", y: window.scrollY, docTop });
    };
    const schedule = () => {
      if (!sf) sf = requestAnimationFrame(post);
    };
    window.addEventListener("scroll", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      cancelAnimationFrame(sf);
      host.stop();
      worker.terminate();
      cvs.remove();
      setLive(false);
    };
  }, [src, flip, frozen]);

  return (
    <div ref={wrapRef} aria-hidden className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- must be in the SSR HTML unprocessed:
          this is already a quantized plate at grid resolution, and any resampling by the image
          optimizer would soften the cells that are the whole texture. */}
      <img
        src={still}
        alt=""
        // The hero's first paint, so it must not queue behind anything.
        fetchPriority="high"
        className="absolute inset-0 size-full [image-rendering:pixelated]"
        // The still is a baked plate, so its mirror is a CSS one. There is no plasma read behind it
        // to keep honest, unlike the canvas above.
        style={{ opacity: live ? 0 : 1, transform: flip ? "scaleX(-1)" : undefined }}
      />
    </div>
  );
}
