// Public surface of the hero paint engine. Everything here is DOM-free and runnable under plain
// `node`, which is what lets the per-cell maths be verified offline; the browser half lives in
// `lib/browser`.
export { parseHex, type Rgb } from "./color.ts";
export { Field, FIELD_CELL } from "./field.ts";
export { RATE } from "./plasma.ts";
export { FloorPool, Pool, POOL, type Geom } from "./pool.ts";
export { PLATE, Portrait } from "./portrait.ts";
