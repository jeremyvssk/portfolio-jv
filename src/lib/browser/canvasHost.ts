// Main-thread half of a worker-owned canvas: the two things a worker cannot see for itself, and
// nothing else. Sizing needs a layout box; gating needs an IntersectionObserver. Both are rare
// events, so neither is on the scroll path.
import type { Geom } from "../hero/pool.ts";

export type Host = { stop(): void };

export function hostCanvas(
  el: HTMLElement,
  onSize: (g: Geom, r: DOMRect) => void,
  onShow: (on: boolean) => void,
): Host {
  const measure = () => {
    const r = el.getBoundingClientRect();
    onSize(
      {
        w: Math.max(1, Math.round(r.width)),
        h: Math.max(1, Math.round(r.height)),
        vh: window.innerHeight,
        vmax: Math.max(window.innerWidth, window.innerHeight),
      },
      r,
    );
  };
  measure();

  // Two reasons to stop drawing, and they are not the same one. An IntersectionObserver does not
  // fire when the TAB is hidden (it only ever knew about the viewport), so without the second the
  // worker keeps painting a canvas on a screen nobody is looking at.
  let onScreen = true;
  let awake = document.visibilityState === "visible";
  const settle = () => onShow(onScreen && awake);

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    settle();
  });
  io.observe(el);
  const ro = new ResizeObserver(measure);
  ro.observe(el);
  const onVisibility = () => {
    awake = document.visibilityState === "visible";
    settle();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    stop() {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
