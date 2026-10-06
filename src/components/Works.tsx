"use client";
// Works: a ribbon of three projects with the words under the card. Six cards, two per project, so the
// loop always has one waiting offscreen. The engine only writes `--p` (signed slot) per card; where a
// slot lands is `.works-*` CSS, per breakpoint, so the server render is already placed.
// The ribbon, the caption stacking and the reduced-motion call: claude-docs/frontend-conventions.md.
import type { StaticImageData } from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useReducedMotion } from "motion/react";
import seniors from "@/img/work-seniors-d.webp";
import seniorsPhone from "@/img/work-seniors-m.webp";
import tavla from "@/img/work-tavla-d.webp";
import tavlaPhone from "@/img/work-tavla-m.webp";
import launcher from "@/img/work-launcher-d.webp";
import launcherPhone from "@/img/work-launcher-m.webp";
import SectionHeading from "@/components/SectionHeading";

// `ground` is the artwork's mean relative luminance against the 0.178 crossover; Header.tsx reads it
// to flip the nav. Re-measure when an image changes. Tavla .422 (phone .740/.296), Ox Hyprland .316 over its loop
// (phone .318; workspace 1 is jeremy.ee, the dark stretch is a fifth of it), Seniors .701.
// A `clip` is a scripted loop in public/works/<clip>-d|m.*; its stills are the loop's first frame, so
// the poster and the video's start are the same picture. `phone` is the portrait still under md.
type Project = {
  title: string;
  img: StaticImageData;
  phone?: StaticImageData;
  clip?: string;
  ground: "light" | "dark";
  stack: string[];
  desc: string;
  repo?: string;
};

const PROJECTS: Project[] = [
  {
    title: "Tavla",
    img: tavla,
    phone: tavlaPhone,
    clip: "tavla",
    ground: "light",
    stack: ["React", "Spring Boot", "PostgreSQL"],
    repo: "https://github.com/jeremyvssk/tavla",
    desc: "An online shop for chess, Go and backgammon with 1,700+ real products. Results appear as you type. Two-factor login, single-use tokens.",
  },
  {
    title: "Ox Hyprland",
    img: launcher,
    phone: launcherPhone,
    clip: "launcher",
    ground: "light",
    stack: ["Quickshell", "QML", "Hyprland"],
    repo: "https://github.com/jeremyvssk/ox-hyprland",
    desc: "A minimal Linux workspace for developers. Every menu opens fast from one bar, with keyboard or mouse. A solid base to customise.",
  },
  {
    title: "Seniors' Club",
    img: seniors,
    phone: seniorsPhone,
    clip: "seniors",
    ground: "light",
    stack: ["React", "Spring Boot", "PostgreSQL"],
    repo: "https://github.com/jeremyvssk/seniors-club",
    desc: "A social club for older people, built as an MVP. Matching by shared interests and live chat. Every screen is clear and easy to follow.",
  },
];

const N = PROJECTS.length;
const K = 2 * N;
const DUR = 640;
const STAGGER = 24;
// Text leaves in this long, then the next project's words come in.
const SWAP_MS = 170;

// cubic-bezier(x1, y1, x2, y2) as a function of progress, solved the way CSS solves it.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const f = (a: number, b: number) => (t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const X = f(x1, x2);
  const Y = f(y1, y2);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (X(m) < x) lo = m;
      else hi = m;
    }
    return Y((lo + hi) / 2);
  };
}
// Steps: in-out, so a card accelerates away and settles. A released drag is already moving: out only.
const IN_OUT = bezier(0.65, 0, 0.25, 1);
const OUT = bezier(0.2, 0.7, 0.25, 1);

// Signed position of a card in [-K/2, K/2).
const wrap = (v: number, m: number) => ((((v + m / 2) % m) + m) % m) - m / 2;
const mod = (v: number, m: number) => ((v % m) + m) % m;
const slotStyle = (p: number) =>
  ({ "--p": p.toFixed(4), "--q": Math.min(Math.abs(p), 1).toFixed(4), zIndex: Math.round(100 - Math.abs(p) * 10) }) as CSSProperties;

type Engine = { step: (d: number) => void };

// The exact complement of the `min-width: 768px` that sizes `.works`: `max-width: 767px` would leave
// a fractional width (767.5px under browser zoom) matching neither, a portrait card with a desktop clip.
const PHONE = "(width < 768px)";

// One file per visit, chosen once: the first codec this device decodes in hardware, else H.264, the
// cheapest to decode on the CPU. A <source> list takes AV1 wherever it is supported, and most phones
// decode AV1 on the CPU, which stalls a 60fps loop.
const CODECS = [
  [".webm", 'video/webm; codecs="av01.0.09M.08"'],
  [".hevc.mp4", 'video/mp4; codecs="hvc1.1.6.L123.B0"'],
] as const;
async function pickExt() {
  for (const [ext, contentType] of CODECS) {
    try {
      const r = await navigator.mediaCapabilities.decodingInfo({
        type: "file",
        video: { contentType, width: 1620, height: 1080, bitrate: 1e6, framerate: 60 },
      });
      if (r.supported && r.powerEfficient) return ext;
    } catch {}
  }
  return ".mp4";
}

function Clip({ src, poster, playing, rewind }: { src: string; poster: string; playing: boolean; rewind: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Paused, not unmounted, when it leaves the front: it keeps its frame instead of snapping to the poster.
    // Off screen it goes back to frame 0, which is the poster, so the next visit starts the loop.
    if (playing) v.play().catch(() => {});
    else v.pause();
    if (rewind) v.currentTime = 0;
    // `src` too: a new source (the screen crossed 768) loads paused, and must be told to play again.
  }, [playing, rewind, src]);
  return <video ref={ref} aria-hidden muted loop playsInline preload="auto" poster={poster} src={src} />;
}

export default function Works() {
  const [active, setActive] = useState(0);
  const [front, setFront] = useState(0);
  // The caption lags `active` by SWAP_MS: the old words leave before the new ones arrive.
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  const [dir, setDir] = useState(0);
  // A card gets its video once it is in front or beside it within 200px of the screen, so the next card
  // is buffered before a flick lands on it; a visitor who never scrolls to Works downloads none. Clips
  // only play once 60% of the strip is on screen, the half-visible rule feeds use, so the loop is not
  // already seconds in when it is first seen.
  const [near, setNear] = useState(false);
  const [view, setView] = useState<"out" | "edge" | "in">("out");
  const [woken, setWoken] = useState<number[]>([]);
  // The card that just left the front plays on until the strip settles, rather than freezing mid-slide.
  const [leaving, setLeaving] = useState(-1);
  // The codec is read once. The shape follows the same breakpoint as the CSS, so a window that crosses
  // 768 swaps to the other file; a browser picks a video source once and never on resize by itself.
  const [ext, setExt] = useState("");
  const [phone, setPhone] = useState<boolean | null>(null);
  const clip = ext && phone !== null ? { phone, ext } : null;
  // Derived during render rather than in an effect: one pass, no extra commit.
  const due = [front, mod(front - 1, K), mod(front + 1, K)].filter((k) => !woken.includes(k));
  if (near && clip && due.length) setWoken([...woken, ...due]);

  const stageRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const swapTimer = useRef(0);
  const lastKey = useRef(0);
  const still = useReducedMotion() ?? false;
  const stillRef = useRef(still);
  useEffect(() => {
    stillRef.current = still;
  }, [still]);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "200px 0px" });
    const seen = new IntersectionObserver(
      ([e]) => setView(e.intersectionRatio >= 0.6 ? "in" : e.isIntersecting ? "edge" : "out"),
      { threshold: [0, 0.6] },
    );
    io.observe(stageRef.current!);
    seen.observe(stageRef.current!);
    const mq = window.matchMedia(PHONE);
    const shape = () => setPhone(mq.matches);
    shape();
    mq.addEventListener("change", shape);
    pickExt().then(setExt);
    return () => {
      io.disconnect();
      seen.disconnect();
      mq.removeEventListener("change", shape);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = [...stage.children] as HTMLElement[];
    // Per-card progress: they share a target but not a clock, which is the follow-through stagger.
    const sv = cards.map(() => 0);
    let target = 0;
    let a = 0;
    let raf = 0;
    // `axis` is a touch gesture's one-time call, 0 until made: 1 the strip owns it, -1 the page does.
    let drag: {
      x0: number;
      y0: number;
      s0: number;
      moved: boolean;
      lastX: number;
      lastT: number;
      v: number;
      X: number;
      axis: number;
    } | null = null;

    const swapTo = (next: number, d: number) => {
      clearTimeout(swapTimer.current);
      setDir(d);
      setPhase("out");
      swapTimer.current = window.setTimeout(() => {
        // Synchronous, so the offscreen "gone" pose is laid out before "in" transitions away from it.
        flushSync(() => {
          setShown(next);
          setPhase("gone");
        });
        void capRef.current?.offsetWidth;
        setPhase("in");
      }, SWAP_MS);
    };

    const draw = () =>
      cards.forEach((c, k) => {
        const p = wrap(k - sv[k], K);
        c.style.setProperty("--p", p.toFixed(4));
        c.style.setProperty("--q", Math.min(Math.abs(p), 1).toFixed(4));
        c.style.zIndex = String(Math.round(100 - Math.abs(p) * 10));
      });
    // Header.tsx re-samples the nav's ground on `transitionend`, which a rAF-driven card never fires.
    const settled = () => {
      setLeaving(-1);
      cards[mod(Math.round(target), K)].dispatchEvent(new Event("transitionend"));
    };

    let cur = 0;
    const commit = (d: number) => {
      const f = mod(Math.round(target), K);
      if (f !== cur) {
        setLeaving(cur);
        cur = f;
      }
      setFront(f);
      const na = mod(Math.round(target), N);
      if (na !== a) {
        a = na;
        setActive(na);
        swapTo(na, d);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const go = (curve: (x: number) => number, dur: number, stagger: number, d: number) => {
      stop();
      if (stillRef.current) {
        sv.fill(target);
        draw();
        settled();
        return;
      }
      const from = sv.slice();
      const t0 = performance.now();
      // The leading card leaves first and the trailing ones follow, up to 3 staggers behind.
      const delay = cards.map((_, k) => (stagger ? Math.max(0, Math.min(3, d * wrap(k - from[k], K) + 1)) * stagger : 0));
      const total = dur + Math.max(...delay);
      const tick = (now: number) => {
        const t = now - t0;
        cards.forEach((_, k) => {
          sv[k] = from[k] + (target - from[k]) * curve(Math.max(0, Math.min(1, (t - delay[k]) / dur)));
        });
        draw();
        if (t < total) raf = requestAnimationFrame(tick);
        else {
          raf = 0;
          sv.fill(target);
          draw();
          settled();
        }
      };
      raf = requestAnimationFrame(tick);
    };
    const step = (d: number) => {
      target = Math.round(target) + d;
      commit(d);
      go(IN_OUT, DUR, STAGGER, d);
    };
    engine.current = { step };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = {
        x0: e.clientX,
        y0: e.clientY,
        s0: 0,
        moved: false,
        lastX: e.clientX,
        lastT: performance.now(),
        v: 0,
        X: 1,
        // A mouse drag cannot scroll the page, so it never needs the call.
        axis: e.pointerType === "mouse" ? 1 : 0,
      };
      stage.setPointerCapture(e.pointerId);
    };
    // Decided once, past 6px, at 45 degrees; the loser gets nothing for the rest of the gesture, so a
    // sideways swipe that drifts down neither scrolls the page nor, when steeper, nudges a card.
    const lock = (x: number, y: number) => {
      if (!drag || drag.axis) return;
      const dx = Math.abs(x - drag.x0);
      const dy = Math.abs(y - drag.y0);
      if (dx * dx + dy * dy < 36) return;
      drag.axis = dx > dy ? 1 : -1;
      if (drag.axis < 0) drag = null;
    };
    // Only a cancelled touchmove stops the page scrolling; pointer events cannot. Non-passive, and on
    // the stage alone, so the rest of the page scrolls without waiting on this.
    const touchMove = (e: TouchEvent) => {
      if (!drag) return;
      // Already scrolling: the browser made the call before we could.
      if (!drag.axis && !e.cancelable) drag = null;
      else lock(e.touches[0].clientX, e.touches[0].clientY);
      if (drag?.axis === 1 && e.cancelable) e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      lock(e.clientX, e.clientY);
      if (!drag || drag.axis !== 1) return;
      const dx = e.clientX - drag.x0;
      if (!drag.moved && Math.abs(dx) < 6) return;
      if (!drag.moved) {
        // Grabbing mid-flight collapses the stagger to one position, so the strip moves as one.
        drag.moved = true;
        stop();
        const m = sv.reduce((x, y) => x + y) / K;
        sv.fill(m);
        drag.s0 = m;
        // Once per gesture: px per slot, from the same --gx the CSS places with.
        drag.X = parseFloat(getComputedStyle(stage).getPropertyValue("--gx")) * cards[0].offsetWidth;
        stage.classList.add("is-grabbing");
      }
      const now = performance.now();
      drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
      drag.lastX = e.clientX;
      drag.lastT = now;
      sv.fill(drag.s0 - dx / drag.X);
      draw();
    };
    const up = (e: PointerEvent) => {
      if (!drag) return;
      const dr = drag;
      drag = null;
      stage.classList.remove("is-grabbing");
      if (!dr.moved) {
        // A tap beside the front card steps toward that side; on the card itself it does nothing.
        const r = cards[mod(Math.round(target), K)].getBoundingClientRect();
        if (e.clientX < r.left) step(-1);
        else if (e.clientX > r.right) step(1);
        return;
      }
      const base = Math.round(dr.s0);
      const moved = sv[0] - base;
      // A flick decides by speed, a slow drag by distance; either way at most one project.
      const d = Math.abs(dr.v) > 0.35 ? (dr.v < 0 ? 1 : -1) : Math.abs(moved) > 0.18 ? Math.sign(moved) : 0;
      target = base + d;
      commit(d);
      go(OUT, 260 + 440 * Math.min(1, Math.abs(target - sv[0])), 0, d);
    };
    // The system took the gesture (an OS edge swipe, say): settle wherever the drag left the strip.
    // Before the strip moved there is nothing to settle, and `s0` is not measured yet.
    const cancel = (e: PointerEvent) => {
      if (drag?.moved) up(e);
      drag = null;
    };

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", cancel);
    stage.addEventListener("touchmove", touchMove, { passive: false });
    return () => {
      stop();
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", cancel);
      stage.removeEventListener("touchmove", touchMove);
      clearTimeout(swapTimer.current);
    };
  }, []);

  // The shorter way round the loop, so 01 to 03 is one step back rather than two forward.
  const goTo = (i: number) => {
    const d = mod(i - active + 1, N) - 1;
    if (d) engine.current?.step(d);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    // Only held-key repeats are paced to one step per trip; a deliberate press is never dropped.
    if (e.repeat && e.timeStamp - lastKey.current < DUR) return;
    lastKey.current = e.timeStamp;
    engine.current?.step(e.key === "ArrowRight" ? 1 : -1);
  };

  // All three projects sit in the same grid cell and only one is visible, so each slot is as tall as
  // its longest project at the current width: nothing below it moves between projects.
  const slot = (render: (p: Project) => React.ReactNode, className: string) => (
    <div className={`works-slot ${className}`}>
      {PROJECTS.map((p, i) => (
        <div key={p.title} data-on={i === shown} aria-hidden={i !== shown}>
          {render(p)}
        </div>
      ))}
    </div>
  );

  return (
    <section id="works" className="works scroll-mt-12 overflow-hidden py-16 md:scroll-mt-3 md:py-24">
      <div className="mx-auto max-w-page px-6 md:px-10">
        <SectionHeading title="Works" />
      </div>

      <div ref={stageRef} role="group" aria-label="Selected work" className="works-stage mt-8 md:mt-10">
        {Array.from({ length: K }, (_, k) => {
          const p = PROJECTS[k % N];
          return (
            <div
              key={k}
              // Read by Header.tsx. Only the front card can be dark: the veil lifts every neighbour.
              data-ground={k === front ? p.ground : "light"}
              className={`works-card${p.ground === "dark" ? " is-dark" : ""}`}
              style={slotStyle(wrap(k, K))}
              aria-hidden={k >= N || undefined}
            >
              <picture>
                {p.phone && <source media={PHONE} srcSet={p.phone.src} />}
                <img
                  src={p.img.src}
                  alt={k < N ? `${p.title} screenshot` : ""}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              {p.clip && clip && woken.includes(k) && (
                <Clip
                  src={`/works/${p.clip}-${clip.phone ? "m" : "d"}${clip.ext}`}
                  poster={(clip.phone && p.phone ? p.phone : p.img).src}
                  playing={view === "in" && (k === front || k === leaving)}
                  rewind={view === "out"}
                />
              )}
              <span aria-hidden className="works-veil" />
            </div>
          );
        })}
      </div>

      <div ref={capRef} className="works-cap" data-swap={phase} style={{ "--d": dir } as CSSProperties}>
        <p aria-live="polite" className="sr-only">
          {PROJECTS[active].title}
        </p>
        {slot((p) => <h3 className="works-title font-display font-bold text-ink-near">{p.title}</h3>, "works-sw works-t")}
        {slot((p) => <p className="works-desc font-body font-medium text-ink">{p.desc}</p>, "works-sw works-d")}
        <div className="works-side">
          {slot(
            (p) => (
              <div className="works-meta">
                <span className="works-stack font-ui font-medium uppercase text-ink-soft">
                  {p.stack.map((s, j) => (
                    <span key={s}>
                      {j > 0 && <span className="works-dot"> · </span>}
                      {s}
                    </span>
                  ))}
                </span>
                {p.repo ? (
                  <a className="works-link font-display font-semibold" href={p.repo} target="_blank" rel="noreferrer">
                    GitHub
                    {/* Drawn, not U+2197: the latin font subsets lack it, so iOS falls back to its emoji. */}
                    <svg aria-hidden viewBox="0 0 10 10" className="size-[0.6em]">
                      <path d="M2 8 8 2M3.5 2H8v4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </a>
                ) : (
                  <span className="works-link is-fill font-display font-semibold">No repo yet</span>
                )}
              </div>
            ),
            "works-sw works-m",
          )}
          <div className="works-nums flex gap-1.5" onKeyDown={onKeyDown}>
            {PROJECTS.map((p, i) => (
              <button
                key={p.title}
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === active}
                aria-label={`Show ${p.title}`}
                // `border-transparent` on the fill (a declared border antialiases a rim on it), ink
                // digits (8.93:1 on accent), and a fixed integer box so the fill's edges land on pixels.
                className="inline-flex h-9 w-11 items-center justify-center rounded-box border border-line ps-[0.15em] font-ui text-[0.625rem] tabular-nums tracking-[0.12em] text-ink-soft transition-colors hover:border-ink-soft md:h-8 aria-current:border-transparent aria-current:bg-accent aria-current:text-ink"
              >
                {`0${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
