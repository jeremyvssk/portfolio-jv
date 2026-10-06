"use client";
// The hero's exit CLOCK, and nothing else: it publishes `--hero-exit`, 0 at rest and 1 when the hero
// has finished leaving, and every part of the exit reads it. The figure's dissolve runs off the same
// `scrollY` in HeroPortrait, so the two cannot drift however they are tuned.
//
// Renders nothing. With JS off or before hydration the property is absent, and its registered
// initial value of 0 is the hero at rest.
//
// Written on each `.hero-out` rather than once on an ancestor: the property does not inherit, so only
// its 7 readers restyle per frame (1.31ms -> 0.25ms of style per frame, measured).
import { useEffect } from "react";
import { useReducedMotion } from "motion/react";

/** Screens of scroll the exit is spent over; clears the type before the figure's 0.97 dissolve ends. */
const SPAN = 0.66;

export default function HeroExit() {
  const frozen = useReducedMotion() ?? false;

  useEffect(() => {
    // No fallback to the root on purpose: a page without the wrapper has no `.hero-out` either, and
    // the registered initial value of 0 is the correct rest state for it.
    const root = document.getElementById("hero-scope");
    if (!root) return;
    // Queried once. These are static JSX inside the hero and React never swaps the nodes; a hero
    // that grows a reader at runtime would have to re-query, and does not exist.
    const outs = [...root.querySelectorAll<HTMLElement>(".hero-out")];
    if (!outs.length) return;
    const write = (v: string) => outs.forEach((el) => el.style.setProperty("--hero-exit", v));
    const clear = () => outs.forEach((el) => el.style.removeProperty("--hero-exit"));
    // Reduced motion parks the hero at rest rather than mid-exit. The figure's own cut keeps working
    // (a frozen reader still must not meet a headless torso in About), but that is a correctness
    // floor, where lifting the type is decoration on top of it.
    if (frozen) {
      write("0");
      return clear;
    }

    let raf = 0;
    let vh = window.innerHeight;
    let last = -1;

    const read = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, SPAN * vh)));
      // Rounded, and skipped when unchanged. A custom property write invalidates style for
      // everything that inherits it, and scroll fires far finer than three decimals of a 0..1 ramp
      // can show, so this is the difference between a style recalc per scroll event and one per
      // visible step.
      const v = Math.round(p * 1000) / 1000;
      if (v === last) return;
      last = v;
      write(String(v));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    // WIDTH-gated, and that is the whole mobile fix. A phone's URL bar collapsing on scroll fires
    // `resize` with a new innerHeight, which rescaled the ramp mid-gesture: every element on the
    // exit jumped, and the rule (the earliest to leave, at `--lead` 0.08) could snap straight to
    // invisible. Real viewport changes (rotation, a window drag) move the width, so this still
    // tracks them.
    let vw = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === vw) return;
      vw = window.innerWidth;
      vh = window.innerHeight;
      last = -1;
      schedule();
    };

    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      clear();
    };
  }, [frozen]);

  return null;
}
