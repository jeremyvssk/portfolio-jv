"use client";
// Section title whose letters resolve out of random glyphs on entry, with a filled square landing
// last as a full stop:
//
//   About  ->  X$@3P -> AN8X8 -> A8@2U -> Ab8NZ -> AboP% -> AbouF -> About
//
// WHAT IS NOT IN THE MARKUP IS THE POINT. The rendered heading is the REAL TITLE; the noise only
// exists as text this component writes over it and then puts back. So no JS, a slow bundle, or a
// stale chunk after a deploy all resolve to the title simply being there.
//
// Trigger rules and the reduced-motion call are argued in claude-docs/frontend-conventions.md.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/** No lowercase: the heading is uppercase, so a lowercase glyph sits at the wrong height. */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@?/*+=";
/** One more slot locks in every STEP ms. */
const STEP = 45;
/** The unresolved tail re-rolls this often. NOT a frame: at 60fps the noise blurs to grey. */
const ROLL = 40;
/** Reduced motion still decodes; it just steps rather than strobes. Movement off, information on. */
const STILL_ROLL = STEP;

type Props = {
  /** One line, or explicit lines for a title that has to break. */
  title: string | string[];
  align?: "left" | "right";
  /** The orange beat. On by default; pass `false` for a heading that should stay unmarked. */
  mark?: boolean;
  /** Overrides the section scale. Contact uses it: that heading is the ask, not a label. */
  size?: string;
};

export default function SectionHeading({ title, align = "left", mark = true, size }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [phase, setPhase] = useState<"armed" | "in" | null>(null);
  const still = useReducedMotion() ?? false;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Grouped BY LINE and swept in parallel, so the cost is the LONGEST line rather than the sum.
    const groups = [...el.querySelectorAll<HTMLElement>(".sh-line")].map((line) => [
      ...line.querySelectorAll<HTMLElement>(".sh-char"),
    ]);
    const longest = Math.max(0, ...groups.map((g) => g.length));
    if (!longest) return;

    let raf = 0;
    let running = false;

    const settle = () => {
      for (const g of groups) for (const s of g) s.textContent = s.dataset.ch!;
    };

    const play = () => {
      if (running) return;
      running = true;
      setPhase("armed");

      const t0 = performance.now();
      const rollMs = still ? STILL_ROLL : ROLL;
      let lastRoll = -1;
      const tick = () => {
        const t = performance.now() - t0;
        const locked = Math.floor(t / STEP);
        const roll = Math.floor(t / rollMs);
        if (roll !== lastRoll) {
          lastRoll = roll;
          for (const g of groups) {
            for (let i = locked; i < g.length; i++) {
              if (g[i].dataset.fixed) continue;
              g[i].textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
          }
        }
        for (const g of groups) {
          for (let i = 0; i < Math.min(locked, g.length); i++) {
            if (g[i].textContent !== g[i].dataset.ch) g[i].textContent = g[i].dataset.ch!;
          }
        }
        if (locked >= longest) {
          settle();
          setPhase("in");
          running = false;
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // Replays on every entry, from either direction. An entry is TWO conditions, and both observers
    // read the SAME root from opposite extremes: `armed` wants ZERO overlap since the last play,
    // `fire` wants FULL overlap. The initial arm deliberately comes from the FIRE observer's first
    // callback. See the doc for why, and for what the 45% inset fixes.
    // A heading taller than the shrunk root can never meet `threshold: 1` and simply never decodes,
    // which leaves it being the title, the resting state anyway.
    let armed = false;
    let first = true;
    const exit = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) armed = true;
      },
      { rootMargin: "-8% 0px -45% 0px" },
    );
    const enter = new IntersectionObserver(
      ([entry]) => {
        if (first) {
          first = false;
          armed = !entry.isIntersecting;
          return;
        }
        if (!armed || !entry.isIntersecting) return;
        armed = false;
        play();
      },
      // The top inset is small and only there to keep a heading from decoding underneath the nav.
      { threshold: 1, rootMargin: "-8% 0px -45% 0px" },
    );
    exit.observe(el);
    enter.observe(el);
    return () => {
      exit.disconnect();
      enter.disconnect();
      cancelAnimationFrame(raf);
      settle();
    };
  }, [still]);

  const lines = Array.isArray(title) ? title : [title];

  return (
    <h2
      ref={ref}
      data-reveal={phase ?? undefined}
      // The split is a rendering detail AT must never meet: one inline-block per glyph makes a screen
      // reader spell "A-B-O-U-T", and mid-decode it would spell noise. Stated once here, letters hidden.
      aria-label={lines.join(" ")}
      className={`font-display font-bold uppercase leading-[0.9] tracking-[-0.02em] ${
        align === "right" ? "text-right" : ""
      }`}
      style={{ fontSize: size ?? "clamp(2.75rem, 8vw, 6rem)" }}
    >
      {lines.map((line, li) => (
        <span key={li} aria-hidden className="sh-line">
          {[...line].map((ch, ci) => (
            <span
              key={ci}
              className="sh-char"
              // The loop writes `textContent` directly, not through state: 60 renders a second of a
              // split heading would be absurd. `data-ch` is what the cleanup puts back, so an unmount
              // mid-decode cannot strand noise.
              data-ch={ch === " " ? "\u00A0" : ch}
              // Whitespace holds, or "SKILLS &" fuses into one token and the word shape goes.
              data-fixed={ch === " " ? "" : undefined}
            >
              {/* An inline-block collapses a plain space, so the word gap is a hard one. */}
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
          {/* A full stop, not a bullet: one accent beat per section without recolouring a letter. In
              `em` so it tracks the clamped heading, `align-baseline` rather than a translate. The
              accent reads by AREA, not contrast, so a period's weight of it would not register.
              Inside the last line to share its baseline, outside `.sh-char` so the decode leaves it. */}
          {mark && li === lines.length - 1 && (
            <span
              aria-hidden
              className="sh-mark mark-r ml-[0.1em] inline-block size-[0.13em] bg-accent align-baseline"
            />
          )}
        </span>
      ))}
    </h2>
  );
}
