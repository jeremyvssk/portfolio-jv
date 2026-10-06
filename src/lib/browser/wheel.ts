// Smooth wheel: the wheel stops moving the viewport and starts moving a NUMBER, and the page walks
// toward that number on `glide.ts`'s curve. So free scrolling and a nav click are finally the same
// animation, which is the whole reason to write this rather than install a scroll library.
//
// WHEEL ONLY. Touch keeps its native inertia: the platform's is better than anything here, and it
// is the one gesture where hijacking is felt as lag. Keyboard, the scrollbar and find-in-page also
// stay native; they move the document out from under us, and the guard in `step` is how that is
// handled rather than by intercepting each one.
import { RETAIN } from "./glide.ts";

/** Pixels per line when the wheel reports LINE units, in root-font multiples so it tracks the fluid
 *  root like everything else. Firefox on Linux reports lines, not pixels, and sends 3 per notch. */
const LINES = 1;

/** Starts the filter, returns the teardown. Not called under reduced motion: the caller decides. */
export function startWheel() {
  let target = window.scrollY;
  let pos = target;
  let frame = 0;
  let last = 0;
  // Measured ONCE PER GESTURE, not per event. Both of these force the browser to flush work it would
  // otherwise batch (`scrollHeight` a layout, `getComputedStyle` a style recalc), and style is dirty
  // on every scroll frame anyway, because the hero's exit writes a custom property each one.
  // Interleaved with our own `scrollTo` writes at 60-120 wheel events a second, that is layout thrash
  // on the one gesture this file exists to smooth. Nothing they measure changes mid-flick: the document only
  // grows on a click (a services panel), and a click ends the gesture.
  let root = 16;
  let max = 0;

  const step = (now: number) => {
    // Something else moved the document: the nav glide, a keypress, the scrollbar, find-in-page,
    // or the menu's scroll lock swallowing our writes. Whoever it is owns the scroll now, so drop
    // ours instead of fighting for it; the next wheel event re-seeds from wherever we ended up.
    if (Math.abs(window.scrollY - pos) > 2) {
      frame = 0;
      return;
    }
    // Same time-normalised decay as the glide, for the same reason: frame-counting runs the curve
    // two and a half times fast on a 144Hz screen.
    const k = 1 - RETAIN ** (last ? (now - last) / 16.67 : 1);
    last = now;
    pos += (target - pos) * k;
    if (Math.abs(target - pos) < 0.5) {
      pos = target;
      window.scrollTo(0, pos);
      frame = 0;
      return;
    }
    window.scrollTo(0, pos);
    frame = requestAnimationFrame(step);
  };

  const onWheel = (e: WheelEvent) => {
    // Zoom (ctrl+wheel, and a trackpad pinch), a horizontal gesture (which is the back-navigation
    // swipe on some setups), and anything another handler has already claimed.
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    // The menu's scroll lock. `overflow: hidden` on the root stops the READER scrolling but not
    // `scrollTo`, so without this the filter happily drives the page along behind an open panel and
    // the reader is somewhere else when it closes. Bailing here is also exactly what native does.
    // Read off the INLINE declaration Header sets rather than the computed style: same answer, and
    // reading `.style` flushes nothing.
    const el = document.documentElement;
    if (el.style.overflow === "hidden") return;
    e.preventDefault();

    if (!frame) {
      // Between gestures the document is not ours, so start from where it actually is.
      pos = target = window.scrollY;
      last = 0;
      root = parseFloat(getComputedStyle(el).fontSize);
      max = el.scrollHeight - window.innerHeight;
    }
    const px =
      e.deltaMode === 1 ? e.deltaY * LINES * root
      : e.deltaMode === 2 ? e.deltaY * window.innerHeight
      : e.deltaY;
    // Clamped per event, not per frame: an unclamped target keeps accumulating past the end of the
    // page and the next flick back up spends itself paying that debt down.
    target = Math.max(0, Math.min(max, target + px));
    if (!frame) frame = requestAnimationFrame(step);
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener("wheel", onWheel);
  };
}
