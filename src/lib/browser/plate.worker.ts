// The figure's plate, painted on its own thread. Same reasoning as `field.worker.ts`: this is a
// per-cell walk over the whole silhouette on the SCROLL path, since the cut moves with the reader.
//
// The main thread keeps only what a worker cannot see: the layout box, and `scrollY`.
import { Portrait, RATE, type Rgb } from "../hero/index.ts";

type Box = {
  w: number;
  h: number;
  vh: number;
  originX: number;
  originY: number;
  docTop: number;
  scrollY: number;
};

type Msg =
  | {
      kind: "init";
      canvas: OffscreenCanvas;
      src: string;
      flip: boolean;
      still: boolean;
      fieldCellPx: number;
      ink: Rgb;
      pool: Rgb;
    }
  | { kind: "size"; box: Box }
  | { kind: "scroll"; y: number; docTop: number }
  | { kind: "run"; on: boolean };

/** Same cap as the field. The sparkle re-rolls at `PLATE.rate` (4Hz), so most ticks change nothing
 *  and `tick` says so. This only decides how soon after a re-roll the change is on screen. */
const GAP = 1000 / 30;

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let scratch: OffscreenCanvas | null = null;
let sctx: OffscreenCanvasRenderingContext2D | null = null;
let plate: Portrait | null = null;
let frame: ImageData | null = null;
let bmp: ImageBitmap | null = null;
let box: Box | null = null;
let flip = true;
let still = false;
let visible = true;
let timer = 0;
const t0 = performance.now();

function build() {
  if (!bmp || !box || !ctx || !scratch || !sctx || !plate) return;
  const cell = plate.cellPx;
  const gw = Math.max(1, Math.round(box.w / cell));
  const gh = Math.max(1, Math.round(box.h / cell));
  ctx.canvas.width = gw;
  ctx.canvas.height = gh;
  scratch.width = gw;
  scratch.height = gh;
  // The mirror happens HERE, on the sample, not as a CSS transform on the wrapper: a CSS flip would
  // also mirror the coordinates the wobble reads the plasma at, so the figure's wobble would drift
  // opposite to the pools, the one thing this file is arranged to prevent.
  sctx.setTransform(flip ? -1 : 1, 0, 0, 1, flip ? gw : 0, 0);
  sctx.clearRect(0, 0, gw, gh);
  sctx.drawImage(bmp, 0, 0, gw, gh);
  plate.viewport(box.vh);
  // The origin is where the plate sits inside the hero wrapper, in page px. The wobble reads the
  // field's plasma there, so the figure drifts with the pools rather than animating in a box.
  plate.build(sctx.getImageData(0, 0, gw, gh).data, gw, gh, { x: box.originX, y: box.originY });
  // Shares the buffer with the plate, so its writes land here directly.
  frame = new ImageData(plate.pixels, gw, gh);
  // The build knows nothing about scroll, so the first frame has to be cut before it is shown,
  // otherwise a resize while scrolled down flashes the whole figure back.
  plate.scrollTo(box.scrollY, box.docTop);
  plate.repaint();
  ctx.putImageData(frame, 0, 0);
  postMessage({ kind: "live" });
  if (!timer) loop();
}

// UPLOAD ONLY WHEN THE PICTURE CHANGED, and it changes far less often than the loop runs: the
// sparkle re-rolls at 4Hz and says whether it did. Everything else was an identical frame.
function loop() {
  timer = 0;
  if (!visible || still || !ctx || !frame || !plate) return;
  const ms = performance.now() - t0;
  if (!plate.erased && plate.tick(ms * RATE, ms / 1000)) ctx.putImageData(frame, 0, 0);
  timer = self.setTimeout(loop, GAP);
}

addEventListener("message", (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.kind === "init") {
    ctx = m.canvas.getContext("2d");
    scratch = new OffscreenCanvas(1, 1);
    sctx = scratch.getContext("2d", { willReadFrequently: true });
    flip = m.flip;
    still = m.still;
    plate = new Portrait({
      fieldCellPx: m.fieldCellPx,
      ink: m.ink,
      pool: m.pool,
    });
    fetch(m.src)
      .then((r) => r.blob())
      .then(createImageBitmap)
      .then((b) => {
        bmp = b;
        build();
      })
      // A failed decode leaves the static plate showing, which is the correct fallback.
      .catch(() => {});
    return;
  }
  if (m.kind === "size") {
    box = m.box;
    build();
    return;
  }
  if (m.kind === "scroll") {
    if (!ctx || !frame || !plate || !box) return;
    box.scrollY = m.y;
    box.docTop = m.docTop;
    // `repaint` walks the whole grid, and the cut keeps moving for the whole of About long after
    // there is anything left to erase. Skip it while the plate is clear at both ends of the step;
    // the first step back UP fails this test, so the figure still returns.
    const was = plate.erased;
    if (!plate.scrollTo(m.y, m.docTop) || (was && plate.erased)) return;
    plate.repaint();
    // Upload the BAND `repaint` just rewrote, not the plate.
    const b = plate.band;
    if (b.h > 0) ctx.putImageData(frame, 0, 0, 0, b.y, ctx.canvas.width, b.h);
    return;
  }
  visible = m.on;
  if (visible && !timer) loop();
});
