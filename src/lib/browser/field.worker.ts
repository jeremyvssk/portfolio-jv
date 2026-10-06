// The hero field and the contact floor, each painted on its own thread.
//
// Off the main thread because `wheel` is bound `{ passive: false }`: the page cannot scroll until the
// main thread is free, so ~300k cells of plasma there put scrolling behind the background.
// `lib/hero` is DOM-free exactly so it can run here.
import { Field, FloorPool, Pool, RATE, type Geom, type Rgb } from "../hero/index.ts";

type Msg =
  | { kind: "init"; canvas: OffscreenCanvas; cellPx: number; ink: Rgb; still: boolean; shape: "hero" | "floor" }
  | { kind: "size"; g: Geom }
  | { kind: "run"; on: boolean };

// 30, not 60. The plasma's rate is 0.00028 and the drift is a 67s loop, so consecutive frames at 60
// are the same picture and each one is a texture the compositor has to take.
// A TIMER, NOT rAF, though both engines do have rAF in a worker. A timer cannot stall: rAF in a
// worker is driven by the transferred canvas's frame provider, and a background that stops is the
// exact complaint this rewrite exists to answer. Weather does not need vsync, and the tab-hidden
// case is handled explicitly in canvasHost.ts rather than left to a side effect of rAF.
const GAP = 1000 / 30;

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let field: Field | null = null;
let img: ImageData | null = null;
let cellPx = 5;
let shape: "hero" | "floor" = "hero";
let still = false;
let visible = true;
let timer = 0;
const t0 = performance.now();

function paint() {
  if (!ctx || !field || !img) return;
  field.paint(img.data, (performance.now() - t0) * RATE);
  ctx.putImageData(img, 0, 0);
}

function loop() {
  timer = 0;
  if (!visible || still || !img) return;
  paint();
  timer = self.setTimeout(loop, GAP);
}

addEventListener("message", (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.kind === "init") {
    ctx = m.canvas.getContext("2d");
    cellPx = m.cellPx;
    still = m.still;
    shape = m.shape;
    field = new Field({ cellPx, ink: m.ink });
    return;
  }
  if (m.kind === "size") {
    if (!ctx || !field) return;
    const { gw, gh } = Field.gridFor(m.g.w, m.g.h, cellPx);
    ctx.canvas.width = gw;
    ctx.canvas.height = gh;
    img = ctx.createImageData(gw, gh);
    field.resize(gw, gh, shape === "floor" ? new FloorPool(m.g.w, m.g.h) : new Pool(m.g));
    paint();
    if (!timer) loop();
    return;
  }
  visible = m.on;
  if (visible && !timer) loop();
});
