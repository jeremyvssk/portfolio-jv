"use client";
// Site header: four nav links flush to the container's right edge, fixed over the page with no ground
// of its own, so it samples what is under it and flips ink to paper over dark artwork.
//
// Three state channels (cursor, section, ground), the per-link probing rules, the 3.92:1 dead zone
// and the glide curve are all argued in claude-docs/frontend-conventions.md. Where a click LANDS is
// `lib/browser/landing.ts`.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cancelGlide, glide } from "@/lib/browser/glide";
import { landing } from "@/lib/browser/landing";
import { startWheel } from "@/lib/browser/wheel";

// Rooted, so the bar still leads home from the 404 page; on home `/#about` is the same page.
const NAV = [
  { label: "About", href: "/#about" },
  { label: "Works", href: "/#works" },
  { label: "Services", href: "/#services" },
  { label: "Contact", href: "/#contact" },
];
const idOf = (href: string) => href.slice(href.indexOf("#") + 1);

export default function Header() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [darkProbes, setDarkProbes] = useState<string[]>([]);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  // Set when a panel link is tapped, consumed by the effect below. The glide cannot run inside the
  // click handler: the panel still owns the scroll lock at that moment, and a locked document
  // cannot be scrolled programmatically either.
  const pending = useRef<string | null>(null);
  const still = useReducedMotion() ?? false;

  // Reduced motion deletes the GLIDE, not the destination: both land on `landing()`, which the
  // browser's own anchor jump would not.
  const glideTo = (hash: string) => {
    const el = document.getElementById(idOf(hash));
    if (!el) return false;
    const target = landing(el);

    const arrive = () => {
      // The hash lands at the END: set any earlier it hands the browser an anchor to jump to and
      // the glide is over before it started. `replaceState` keeps four nav clicks from becoming
      // four back-button steps.
      history.replaceState(null, "", hash);
      // preventDefault kept focus on the link, so a keyboard user would tab on from the nav rather
      // than from the section they asked for. Restore that without re-scrolling.
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    };

    if (still) {
      window.scrollTo(0, target);
      arrive();
      return true;
    }

    glide(target, arrive);
    return true;
  };

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Modified clicks are the browser's business: open-in-new-tab must keep working.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (glideTo(href)) e.preventDefault();
  };

  // The wheel filter lives here because this component is already the page's scroll authority: it
  // owns the glide and the landing rule, and the filter is the third thing running that same curve.
  // Reduced motion gets the browser's own scroll, unfiltered: this is pure motion, so there is
  // nothing to degrade to.
  useEffect(() => {
    const stop = still ? undefined : startWheel();
    return () => {
      cancelGlide();
      stop?.();
    };
  }, [still]);

  // Panel open: lock the document, and let Escape out. `overflow` on the root rather than a fixed
  // body, because the page behind must keep its scroll position, and a fixed body resets it to 0 and
  // the reader lands back at the hero after every close.
  useEffect(() => {
    if (!open) {
      // Runs on the render that CLOSED the panel, so by here the lock is gone and the glide the tap
      // asked for can finally move the document.
      const href = pending.current;
      pending.current = null;
      if (href) {
        if (!glideTo(href)) window.location.assign(href);
      }
      return;
    }
    const root = document.documentElement;
    // `setProperty`/`removeProperty` rather than assigning `style.overflow`: the compiler's
    // immutability rule rejects the assignment, and removing the declaration restores whatever the
    // stylesheet says instead of a value captured at open time.
    root.style.setProperty("overflow", "hidden");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Turning an iPad sideways hides the panel (`desk:hidden`), so close it or the lock outlives it.
    const desk = window.matchMedia("(min-width: 48rem) and (orientation: landscape)");
    const onDesk = () => {
      if (desk.matches) setOpen(false);
    };
    desk.addEventListener("change", onDesk);
    return () => {
      root.style.removeProperty("overflow");
      window.removeEventListener("keydown", onKey);
      desk.removeEventListener("change", onDesk);
    };
    // `glideTo` and `still` are read, not tracked: re-running this on either would re-lock the
    // document mid-gesture. The panel's open/closed state is the only thing that may drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Is a dark works card under the links? Geometry rather than section identity, because the dark
  // thing on this page is a carousel: all five cards sit at the same height and only the front one is
  // ever under the bar. Probed PER LINK, over the WORDS, on MAJORITY coverage. The doc has why each
  // of those three is not the obvious choice.
  useEffect(() => {
    // Bound once to a FIXED set of nodes: the tag is always present and only its value turns, so a
    // `[data-ground="dark"]` query would need re-running every sample.
    const grounds = [...document.querySelectorAll<HTMLElement>("[data-ground]")];
    if (grounds.length === 0) return;
    let dark: HTMLElement[] = [];

    let frame = 0;
    const range = document.createRange();
    const overDark = (el: HTMLElement) => {
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const area = r.width * r.height;
      // A probe its breakpoint has hidden measures 0x0, which is how the media query stays in CSS.
      if (area === 0) return false;
      return dark.some((g) => {
        const d = g.getBoundingClientRect();
        const w = Math.min(r.right, d.right) - Math.max(r.left, d.left);
        const h = Math.min(r.bottom, d.bottom) - Math.max(r.top, d.top);
        return w > 0 && h > 0 && (w * h) / area > 0.5;
      });
    };
    const sample = () => {
      frame = 0;
      // Which cards are dark is a DOM read, not a layout one, so it is free, and while none of them
      // is, there is nothing to be over and the whole sample can be skipped. That is the current
      // state of the works stage: both placeholders measure light, so this ran seven Range rects and
      // five bounding boxes per scroll frame to arrive at an empty array every time.
      dark = grounds.filter((g) => g.dataset.ground === "dark");
      if (dark.length === 0) {
        setDarkProbes((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const links = [...(navRef.current?.querySelectorAll<HTMLElement>(".nav-link") ?? [])];
      const probes: [string, HTMLElement][] = links.map((el) => [el.getAttribute("href") ?? "", el]);
      if (menuRef.current) probes.push(["menu", menuRef.current]);
      const next = probes.filter(([, el]) => overDark(el)).map(([id]) => id);
      // Bail on an unchanged result, or a fresh array re-renders the header 60x a second all page.
      setDarkProbes((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
      );
    };
    // Coalesced to a frame: every sample is a forced layout read across every probe and ground.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sample);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // A card ARRIVING under a stationary bar is the one move scroll cannot report. Stale for the
    // 700ms flight, which nobody is watching: the rail that stepped it is below the fold.
    grounds.forEach((g) => g.addEventListener("transitionend", schedule));
    sample();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      grounds.forEach((g) => g.removeEventListener("transitionend", schedule));
      cancelAnimationFrame(frame);
    };
  }, []);

  // Track which section owns a thin band around 40 to 45% of the viewport height.
  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(idOf(n.href))).filter(
      (el): el is HTMLElement => el !== null,
    );
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const current = sections.find((s) => visible.get(s.id));
        setActiveId(current ? current.id : null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      {/* The column cap sits on this row rather than the fixed header, so the nav lands on the
          COLUMN's right edge. `.nav-row` scopes the ground flip away from the mobile panel below. */}
      <div className="nav-row reg-fade relative mx-auto flex max-w-page items-start justify-end px-6 py-5 md:px-10">
        <nav
          ref={navRef}
          aria-label="Primary"
          // Size on the NAV, not per link, so the em-sized marks track it. `-me-2.5` cancels the last
          // link's padding, which is a touch target rather than ink: without it the bar's ink stops
          // 10px inside the column and misaligns against the hero meta below.
          className="pointer-events-auto -me-2.5 hidden items-center gap-3 font-display text-[0.9rem] font-semibold uppercase leading-none tracking-[0.1em] text-ink desk:flex"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => onNavClick(e, item.href)}
              aria-current={activeId === idOf(item.href) || undefined}
              data-on-dark={darkProbes.includes(item.href) || undefined}
              className="nav-link px-2.5 py-1 transition-colors duration-150"
            >
              {item.label}
              <span
                aria-hidden
                className="nav-mark mark-r ms-[0.18em] inline-block size-[0.42em] align-baseline"
              />
            </a>
          ))}
        </nav>

        {/* One control for both states, and it sits ABOVE the flood (`z-[70]` against the panel's 60)
            so the tap that opened the menu is the tap that closes it. `-me-1` pulls the 32px icon
            box back onto the column's own edge. */}
        <button
          ref={menuRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          data-on-dark={(!open && darkProbes.includes("menu")) || undefined}
          className="burger nav-link pointer-events-auto relative z-70 -me-1 flex text-ink desk:hidden"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* THE FLOOD. Always mounted and driven by `data-open`, so the wipe has an exit as well as an
          entrance: conditional rendering gives you the first and never the second. `inert` when
          closed is what keeps a permanently-mounted, merely-invisible panel out of the tab order and
          off the accessibility tree. */}
      <div
        id="mobile-nav"
        data-open={open}
        inert={!open}
        className="m-nav pointer-events-auto flex flex-col px-6 pb-10 pt-7 desk:hidden"
      >
        {/* `pt-7` puts these caps on the burger's centre line, 36px down (the row's `py-5` plus half
            its 32px box). `pt-6` left them 4px high of the X. */}
        <p
          className="m-item font-ui text-xs uppercase tracking-[0.25em] text-ink-soft"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          Menu
        </p>

        {/* ABSOLUTELY centred, not `flex-1` centred. The "Menu" label above and the floor below are
            different heights, so a flex child that takes the slack centres between THOSE two and
            lands ~12px high on the frame. Pinned to 50% it sits on the screen's own centre line
            whatever the chrome around it does.
            No index numbers and no marks. The nav mark is the ACTIVE-SECTION channel and this panel
            deliberately does not carry that state; 01-04 is an alignment device that needs a shared
            left edge, which a centred stack does not have. */}
        <nav
          aria-label="Primary"
          className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4"
        >
          {NAV.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                pending.current = item.href;
                setOpen(false);
              }}
              // 13.85vw is 54px at 390, measured, not picked. `leading-[0.95]` on its own set a
              // 1.31em pitch, which read as cramped at display size; `gap-4` takes it to 1.54em,
              // and the padding keeps every target over the 44px minimum on its own.
              className="m-item px-3 py-2 text-center font-display text-[clamp(2.75rem,13.85vw,4.5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-ink transition-opacity duration-150 active:opacity-60"
              style={{ "--i": i + 1 } as React.CSSProperties}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* The floor, on the hero's own diagonal: the signature in one corner, the one action in the
            other. */}
        {/* `items-stretch`, so the two corners are one strip rather than two boxes that happen to
            share a bottom edge. Bottom-aligned they did share it, but the button stood 15px taller
            than the signature and its mass rose well above the type's cap, so the pair read as
            misaligned even though the floor line was exact. Stretched, the button's 44px sets the
            strip and the signature centres inside it, so both blocks agree on a centre AND a floor.
            44 is the button's own minimum: the tap target, not a size choice. */}
        <div
          className="m-item mt-auto flex items-stretch justify-between gap-4"
          style={{ "--i": NAV.length + 1 } as React.CSSProperties}
        >
          <span className="self-center font-ui text-[0.625rem] uppercase leading-relaxed tracking-[0.2em] text-ink-soft">
            Jeremy Vaask
            <br />
            &copy; 2026
          </span>
          {/* `mailto`, not `#contact`: on a phone the contact section's own button is a second tap
              away and this one is already under the thumb. Ink on marigold is 8.93:1. */}
          <a
            href="mailto:jvaaskj@gmail.com"
            onClick={() => setOpen(false)}
            className="inline-flex items-center rounded-box bg-accent px-5 py-3.5 font-ui text-xs uppercase tracking-[0.2em] text-ink"
          >
            Get in touch
          </a>
        </div>
      </div>
    </header>
  );
}
