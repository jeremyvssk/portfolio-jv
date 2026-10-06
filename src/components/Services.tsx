"use client";
// Services: the offer, as a closed index that opens one row at a time. Rows are separated by
// hairlines (the one divider role `design-system.md` sanctions) and carry a mono index, an uppercase
// display name, and a drawn plus that rotates to a minus.
//
// SINGLE-OPEN, deliberately: five panels open at once turns a menu into a wall of copy, and this
// section's job is to let someone scan the offers and drill into the one that is theirs.
//
// The expansion is CSS, not Motion: `.svc-panel` animates a grid track from 0fr to 1fr rather than a
// height, so nothing is measured in JS and the global reduced-motion rule flattens it for free.
//
// The open row reads TWICE, index box filled and toggle turned to a minus, so its state survives a
// glance. The title is never accent, since that colour is fill-only (1.72:1 on paper). Hover and open
// are one set of colour crossfades on the row, argued at `.svc-row` in globals.css.
//
// Top-aligned, never centred: this section changes height on every click, and centred content would
// slide the heading upward each time a panel opened. Panels only ever push downward.
//
// Row 05 is the odd one: it answers "can you actually do it" rather than "what can I buy", and its
// panel is a wall of brand marks rather than a step list. `StackWall.tsx` owns it.
import { useState } from "react";
import { useReducedMotion } from "motion/react";

import { glide } from "@/lib/browser/glide";
import SectionHeading from "./SectionHeading";
import { StackPeek, StackWall } from "./StackWall";

type Service = { title: string } & (
  | { kind: "steps"; what: string; how: string[] }
  /** Row 05: the panel is the logo wall, which carries its own group labels and needs no copy. */
  | { kind: "stack" }
);

// TWO PAIRS, and the copy is what pairs them. 01 and 02 hand off in both directions: the identity
// ends at the site, the site starts from an identity. 03 and 04 split by whether the product exists
// yet, one built to find out, the other built to be run.
//
// NO DASHES in this copy, em or en: they read as machine-written. Commas, colons and full stops only.
const SERVICES: Service[] = [
  {
    title: "Brand identity",
    kind: "steps",
    what:
      "A brand identity that feels like you and speaks to the people you want to reach. We work out what you stand for, then turn it into a logo, colours, type, and the rules that keep it consistent everywhere it shows up. Distinctive enough to remember, familiar enough to trust.",
    how: [
      "Where you sit in your market",
      "References we agree on",
      "Two or three directions",
      "Logo, colour, type",
      "Guidelines and files, documented",
    ],
  },
  {
    title: "Website",
    kind: "steps",
    what:
      "Your identity, built into something people can visit. One page or a full site, sharp and responsive on every screen. Custom built when the site has to stand out, WordPress when editing it yourself and getting live sooner matter more. Hosting and domain handled on Zone, Veebimajutus, or wherever you already are.",
    how: [
      "What the site has to get people to do",
      "Wireframes: what goes where",
      "Design in Figma",
      "Build, with check ins as it goes",
      "Deploy and handover",
    ],
  },
  {
    title: "MVP",
    kind: "steps",
    what:
      "The first step to finding out whether your idea lands. We build the smallest version that still does the job properly, put it in front of real people, then decide the next move from their feedback. Cheaper than guessing, faster than building everything.",
    how: [
      "What it does, and who for",
      "Scope: the shortest route to live",
      "Flows and wireframes",
      "Design and build",
      "Live, then act on the feedback",
    ],
  },
  {
    title: "Custom solutions",
    kind: "steps",
    what:
      "Stores, dashboards, admin panels, workflow tools. The software a team actually works in, built from scratch when that is what you need. When a system is already in place and slowing people down, we go through it and figure out what is realistic to improve, what is worth adding, and what to leave alone.",
    how: [
      "Map the workflow",
      "Scope and priorities",
      "Design the screens people live in",
      "Build, extend, integrate",
      "Handover and support",
    ],
  },
  {
    // The one row that answers "can you actually do it" rather than "what can I buy". The switch
    // is carried by the wall's own group labels, so it needs no sentence to introduce it.
    title: "Stack",
    kind: "stack",
  },
];

/** The height a panel has, or is about to have. Its track is 0fr and its child clips, so the child's
 *  scrollHeight is the only place that number exists before the transition runs. */
const panelHeight = (i: number) =>
  document.getElementById(`svc-p-${i}`)?.firstElementChild?.scrollHeight ?? 0;

export default function Services() {
  const [open, setOpen] = useState<number | null>(null);
  const still = useReducedMotion() ?? false;

  // Opening a row can push its own end past the fold, which is the one thing an accordion must not
  // do: you click a thing to read it. So follow it down by exactly the overhang, never more.
  //
  // Measured BEFORE React commits, so two corrections are arithmetic rather than observed: the row
  // that is closing takes its height out of the document (only if it sits ABOVE this one, otherwise
  // it moves nothing here), and the panel's height comes from the child rather than the box, which
  // is still 0fr at this instant. Waiting for `transitionend` would make both exact and cost a
  // 380ms dead beat between the click and the page moving, which reads as a second, unrelated event.
  const reveal = (i: number, prev: number | null) => {
    const trigger = document.getElementById(`svc-t-${i}`);
    const bar = document.querySelector(".nav-row")?.getBoundingClientRect().bottom ?? 0;
    if (!trigger) return;
    const row = trigger.getBoundingClientRect();
    const shift = prev !== null && prev < i ? panelHeight(prev) : 0;
    const tail = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5;
    const over = row.bottom - shift + panelHeight(i) + tail - window.innerHeight;
    // The title's own clearance under the nav, after the commit. It is a CEILING on scrolling down
    // (following the panel must never take the title you clicked under the bar) and, when it is
    // already negative, the correction itself: the row that closes can sit above and be taller than
    // this one needs, so the page RISES and the title passes under the nav with nothing pushing it
    // back. Then `clear` is exactly the overlap, so it is exactly the move. Never `over` there,
    // which would keep going and park the panel's end on the fold instead.
    const clear = row.top - shift - bar;
    const delta = clear < 0 ? clear : Math.max(0, Math.min(over, clear));
    if (delta === 0) return;
    const y = window.scrollY + delta;
    if (still) window.scrollTo(0, y);
    else glide(y);
  };

  // Padding and anchor offset are the page's shared rhythm, argued once in page.tsx. `min-h-svh`
  // is gone with it: closed, this section is 700px on a 390 screen, and the 144px of filler that
  // padded it to a full one all landed after the last row.
  return (
    <section id="services" className="scroll-mt-12 py-16 md:scroll-mt-3 md:py-24">
      <div className="mx-auto w-full max-w-page px-6 md:px-10">
        {/* Two lines by construction: "SKILLS & SERVICES" is ~10.5em of the display face, so it overflows the
            column at the 6rem cap and wraps on every phone width. Left to itself the break point
            would drift between the two words as the viewport changes. */}
        <SectionHeading title={["Skills &", "Services"]} />

        {/* The hover model lives per ROW now (`.svc-row`), not on the list. Nothing here is
            conditioned on the list being hovered, so there is no exit case.
            The `wide:` step is the section's HEIGHT, not its rhythm (see the trigger's padding). */}
        <div className="mt-14 md:mt-20 wide:mt-14">
          {SERVICES.map((s, i) => {
            const isOpen = open === i;
            return (
              // `data-open` rather than `:has([aria-expanded="true"])`: React already knows, and
              // the row's own bottom hairline is the underline, so it needs the state here.
              <div key={s.title} data-open={isOpen} className="svc-row border-b border-line first:border-t">
                {/* h3 wraps the button rather than the reverse: the heading has to stay a heading
                    in the document outline, and the button has to be the whole hit area. */}
                <h3>
                  {/* Row pitch tightens at `wide:` (1920) and only there. The root clamp scales
                      this whole section with the viewport (800px of ink at 1rem, 1063 at the
                      1.333rem 1920 asks for), and 1920 is the width where that outgrows the room
                      `landing()` frames it in. Below it the section fits with 166px to spare and
                      the 1.5rem band is what makes the chip and the title read as a row rather
                      than a line, so it stays. */}
                  <button
                    type="button"
                    id={`svc-t-${i}`}
                    aria-controls={`svc-p-${i}`}
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpen(isOpen ? null : i);
                      if (!isOpen) reveal(i, open);
                    }}
                    className="svc-trigger group flex w-full items-center gap-4 py-5 text-left transition-colors duration-150 md:gap-8 md:py-6 wide:py-5"
                  >
                    {/* Fixed width, so the gutter the panel indents to is a known 5rem (3rem + the
                        2rem gap) rather than whatever the digits measure. Hidden below md: a 375
                        screen needs the width for the title. Open state fills this box rather than
                        recolouring the title: the accent cannot be type, and a 3rem block is the
                        smallest thing on the row that can carry a fill and still read. The row is
                        items-center because baseline-aligning 12px digits against a 2.5rem title hung
                        the number off the title's baseline.
                        `ps-[0.125em]` and `pb-[0.208em]` are OPTICAL CENTRING, measured, one per
                        axis, same technique both times: an asymmetric pad against a `center`
                        alignment moves the ink by exactly half the pad, and `em` keeps it tracking
                        the type through the root clamp.
                        HORIZONTAL: `justify-center` centres the text's layout run, which is wider
                        than its ink at both ends: the trailing letter-space carries no ink, and
                        Plex Mono's parens are not mirror images (2.00px left bearing on `(` against
                        2.20px right on `)` at 12px). Net, the ink sat 0.75px left of centre.
                        VERTICAL: `items-center` centres the LINE BOX, whose ascent (1.042em) and
                        descent (0.278em) are nothing like the ink's (0.764em up, 0.208em down for
                        "(0N)"), so the digits sat fasc - C/2 - (asc-desc)/2 = 0.104em BELOW the
                        chip's own centre. 2px inside a 28px block with two hard edges, which is
                        exactly the kind of thing a solid fill makes impossible to unsee. */}
                    <span className="svc-chip hidden h-7 items-center justify-center rounded-box pb-[0.208em] ps-[0.125em] font-ui text-xs tabular-nums tracking-[0.12em] text-ink-soft transition-colors duration-150 group-aria-expanded:bg-accent group-aria-expanded:text-ink md:inline-flex md:w-12">
                      {`(0${i + 1})`}
                    </span>
                    {/* 600, not the 700 every other display mass wears: six rows of it at 2.5rem
                        measured 7.69% ink coverage against the section heading's own. See
                        design-system.md's weight table for the exception. */}
                    <span
                      className={`svc-title font-display font-semibold leading-[1.05] tracking-[-0.02em] ${
                        s.kind === "stack" ? "shrink-0" : "flex-1"
                      }`}
                      style={{ fontSize: "clamp(1.25rem, 3.4vw, 2.5rem)" }}
                    >
                      {s.title}
                    </span>
                    {/* The strip takes over the title's `flex-1` rather than sitting after a
                        spacer, so it starts at the word and the toggle stays pinned right. Its
                        marks are shorter than the title's line box at every width, so the CLOSED
                        row's height does not move, which is what keeps `reveal()` and `landing()`
                        arithmetic untouched. */}
                    {s.kind === "stack" && <StackPeek />}
                    <span aria-hidden className="svc-toggle shrink-0 self-center" />
                  </button>
                </h3>

                {/* `inert` when closed: the track is 0fr and the child clips, but a zero-height
                    clipped subtree is still read by assistive tech, which would contradict the
                    trigger's aria-expanded="false". */}
                <div
                  id={`svc-p-${i}`}
                  role="region"
                  aria-labelledby={`svc-t-${i}`}
                  inert={!isOpen}
                  className="svc-panel"
                  data-open={isOpen}
                >
                  <div>
                    {s.kind === "stack" ? (
                      <div className="pb-12 md:ps-20">
                        <StackWall />
                      </div>
                    ) : (
                      <div className="grid gap-8 pb-12 md:grid-cols-[1.15fr_0.85fr] md:gap-12 md:ps-20">
                        <div>
                          <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-soft">
                            Description
                          </p>
                          <p className="mt-4 max-w-[30em] font-body leading-relaxed md:text-lg">{s.what}</p>
                        </div>
                        <div>
                          <p className="font-ui text-xs uppercase tracking-[0.2em] text-ink-soft">
                            Process
                          </p>
                          <ol className="mt-4 space-y-2 font-ui text-sm leading-relaxed text-ink-soft">
                            {/* Marks, not numerals: the list is ordered markup so sequence survives
                                for AT, but visually the steps read as the page's mark system, and
                                nothing ever references a step by number. `mt` centres the mark on the
                                first text line. */}
                            {s.how.map((step) => (
                              <li key={step} className="flex gap-3">
                                <span
                                  aria-hidden
                                  className="mark-r mt-[0.4em] size-1.5 shrink-0 bg-accent"
                                />
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
