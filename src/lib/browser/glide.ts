// The page's one scroll animation. Constant-RATE exponential decay, not a fixed-duration tween:
// measured off a reference, where a long trip and a short one leave at the same speed and the long
// one simply takes longer. A duration-based tween does the opposite and reads as a lurch.
//
// Module state rather than a ref per caller, because two scroll animations at once is never a
// thing anyone wants. A second call cancels the first wherever it came from.

/** Distance retained per 60fps frame. Exported because the wheel filter runs the SAME curve: one
 *  number, so free scrolling and a nav click can never drift into two different feels. */
export const RETAIN = 0.92;

let frame = 0;
let stopper: (() => void) | null = null;

export function cancelGlide() {
  stopper?.();
}

/**
 * Scrolls to `y` on that curve and calls `onArrive` once it lands. Returns nothing. Cancel it with
 * `cancelGlide()`. Any real input cancels it too: an uninterruptible glide is what "scroll-jacking"
 * means.
 */
export function glide(y: number, onArrive?: () => void) {
  cancelGlide();
  let pos = window.scrollY;
  let last = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    stopper = null;
    removeEventListener("wheel", stop);
    removeEventListener("touchstart", stop);
    removeEventListener("keydown", stop);
  };
  stopper = stop;
  addEventListener("wheel", stop, { passive: true });
  addEventListener("touchstart", stop, { passive: true });
  addEventListener("keydown", stop);

  const step = (now: number) => {
    // Normalised to elapsed time rather than counting frames, so the curve keeps its shape on a
    // 144Hz screen instead of arriving two and a half times faster than it was tuned to. The clock
    // is rAF's own timestamp: the first frame has no predecessor and is charged one frame, which is
    // also what stops the gap between the click and that frame from being spent.
    const k = 1 - RETAIN ** (last ? (now - last) / 16.67 : 1);
    last = now;
    pos += (y - pos) * k;
    if (Math.abs(y - pos) < 0.5) {
      window.scrollTo(0, y);
      stop();
      onArrive?.();
      return;
    }
    window.scrollTo(0, pos);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}
