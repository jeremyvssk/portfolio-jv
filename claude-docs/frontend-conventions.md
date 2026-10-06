# Frontend conventions

**Read when:** writing or structuring app code (components, routing, data, state, tests), or
deciding file layout. Behavioral rules (Think Before Coding, Simplicity, Surgical Changes,
Goal-Driven, Comments) live in the root and always apply.

## Stack specifics

- **Next.js App Router** + React + TypeScript. **npm** for install/run/scripts.
- **Tailwind** for styling; design tokens as CSS variables (see `design-system.md`).
- **shadcn/ui** (Radix) for accessible primitives where it beats hand-rolling, **not installed**.
- Tests: **none installed.** No Vitest, no Testing Library, no `test` script. Verification is a
  production build plus Playwright's Firefox driven from the npx cache, and, for the hero paint
  engine, offline `node` renders diffed against a recorded baseline.
- **Alignment is measured, not eyeballed**: `npm run probe:align` (needs `npm run probe:serve`).
- **A logo is checked twice, and neither check is a screenshot.** `npm run check:marks` re-derives
  each stack mark's `a`/`k` from the file on disk and fails on drift. `npm run check:legible` asks
  the different question, whether the mark is fit to be drawn at the sizes the site draws it: how much of
  it falls under one device pixel at its smallest box, and how wide its antialias band is. Both are
  offline and take a second. **Do not compare a mark against a reduction of itself**: that ground
  truth is circular, passes a blurred file, and was tried.
- **Two ports, never shared.** `3020` is mine (`npm run dev` / `npm start`); `3199` is the agent's
  (`npm run probe:serve`). A probe that rebuilds under my server is how a screenshot ends up
  describing someone else's build.
  See the note below before answering "does this line up".

## File-top comment (required)

Every `.tsx` / `.ts` file starts with a one-line comment on the first line stating what the
file does. Keep it to *what* and *why*, never *how*.

## Server vs. client components

- Default to **server components**. Add `"use client"` only when you need state, effects,
  browser APIs, or animation (Motion/GSAP).
- Push interactivity to small leaf components; keep pages/layouts server-side where possible.
- Data fetching in server components / route handlers; don't fetch in client components
  unless it's genuinely client-driven (then a hook like React Query is fine).

## Structure (App Router)

Full tree and its rules live in `structure.md`. Read that for file placement. In short:
`app/` routes, `components/` UI, `lib/hero` the DOM-free paint engine, `lib/browser` its DOM half.

Keep components small and single-purpose. Co-locate component-specific helpers; promote to
`lib/` only when reused or when they need to run under `node`.

## Conventions

- **Naming:** components `PascalCase`, files match the component, hooks `useThing`, utilities
  `camelCase`.
- **Styling:** Tailwind utilities first; extract to a component when a class string repeats or
  gets unreadable. Use tokens from the theme, don't hardcode hex/spacing that bypasses the
  system.
- **Accessibility is not optional:** semantic elements, labels, focus states, keyboard paths,
  alt text. The `web-design-guidelines` skill is the review gate.
- **No emojis in code.** Surgical changes only (root rule 3).

## Hero paint engine (`lib/hero/` + `HeroField.tsx` / `HeroPortrait.tsx`)

The page's signature element. Its *visual* spec (colour, composition, contrast floors) lives in
`design-system.md`. This is the implementation, and the long-form reasoning the source files point
at rather than repeat: keep source comments to one line and add the argument here.

### Layout and the DOM-free rule

| Module | Holds |
|---|---|
| `plasma.ts` | trig LUT, the domain-warped 3-sine field, `DOMAIN`, `RATE` |
| `dither.ts` | Bayer matrix, hash, `quantize` |
| `pool.ts` | `Pool`: geometry mirroring `.pool-se` |
| `field.ts` | `Field`: the background painter |
| `portrait.ts` | `Portrait`: the figure's plate, its exit, its wobble |
| `color.ts` | the shared sRGB triple + the parser that reads values out of CSS |
| `browser/glide.ts` | the DOM half: the scroll glide |
| `browser/field.worker.ts`, `browser/plate.worker.ts` | the hero's two canvases, painted off the main thread |
| `browser/canvasHost.ts` | the only two things a worker cannot see: the layout box, and whether it is on screen |

`lib/hero` must stay runnable under plain `node` (no DOM, explicit `.ts` imports, no parameter
properties, see `structure.md`). That is what lets a change be proved pixel-identical: render the
field and the plate at fixed inputs, hash the buffers, diff against the previous hashes. The
headless browser here cannot be trusted to paint a canvas, so this offline path is the only real
regression test the engine has.

### The field

- **Rendering:** canvas at 1/6 scale upscaled with `image-rendering: pixelated`; the Bayer matrix
  plus hash noise dither the result into ~4 density steps. It writes **alpha, not opaque RGB**, so
  paper and the body bloom show through the gaps.
- **Two dials, one job each**: they were one scalar once, and that was the bug. `INTENSITY` 0.55
  governs quantization *character* (steps and ceiling); `SAUCE` is *loudness* and scales the mark.
- **The mark is a BLEND:** the plasma is read twice per cell and averaged, once quantized into
  iso-bands whose edges give a drifting contour line, once as its own smooth height, which becomes
  the body the line sits in. Pure contour put a bright thin stroke on a flat body, and the size of
  that step is what shouted.

  Three constants are load-bearing, in this order:
  1. **The domain stretch** (`DOMAIN.sx` 0.52 / `sy` 1.3). Sampled square, the field closes its
     bands into concentric rings around every local extremum, the posterized-ring look already
     rejected. Stretching x against y elongates each band into a long diagonal sweep, which is the
     difference between reading as a current and reading as radar. **Never sample it square.**
  2. **`base` against `gain`** (0.30 / 1.15 before sauce): the body must be present enough that the
     pools read as pools, and low enough that a contour still stands out against it. Both at once
     is impossible. This pair is the tuning.
  3. **~4 quantization steps, not 6.** A contour needs a hard edge; at 6 its shoulder crosses so
     many levels that it airbrushes and the pixel identity goes with it.

  With only 4 steps the peak alpha is a **step, not a slope**: sauce ≤1.00 lands on the third,
  ≥1.05 crosses to the top. Budget for that when tuning.
- **Drift `RATE` 0.00028** field-time per ms. Measure it as the contour's own sliding speed,
  `|dp/dt| / |grad p|` (level-set velocity, **median** over a patch, since the mean blows up at every
  extremum): ~11 CSS px/s, about two minutes to cross a 1440 hero. **A soft wash has no edge to
  track, so the same drift reads as still.** Budget for that when changing the mark, not the
  loudness.
- **Nothing here reacts to the cursor, and that is a decision rather than an omission.** Two
  pointer versions were built and both were rejected. The field answers only to its own clock,
  which is also what makes it alive on mobile. Do not re-pitch a cursor interaction without new
  direction. See the head of `field.ts`.
- **`Pool` mirrors `.pool-se` and must change with it**: the CSS pool paints underneath as the
  pre-hydration fallback, so disagreement shows as a colour jump the moment the canvas mounts.
  Known and deliberate: the falloff table is 40/76 where the CSS gradient is 42/78.

### The plate

- **`target` (mean ink) is the density decision, and cream paper is why it is high.** Sparse dark
  cells on a light ground integrate to grey and read as fog; the same coverage on a near-black page
  reads as an emerging form. References built on dark grounds look solid at a far thinner plate.
- **`base` comes from a BISECTION against `target`, and the scroll exit must stay out of it.** Tone
  is affine in base, so every other term sums once into `t0` and only the offset is searched,
  which is what makes the shoulder dissolve a tonal gain rather than a blend. A scroll-varying term
  inside the search would drag `base` up as the reader scrolls and redistribute the erased ink into
  the face: the figure would get *darker* on the way out.
- **The exit converges on NOTHING.** Do not lerp tone toward the tone the field would paint. Three
  things break: `repaint` walks the whole grid and off-silhouette cells are transparent only
  because tone is 0 there, so the plate's own 3:4 **box** sweeps up the page filled with pool ink;
  the field's wash carries no crop-dissolve envelope, so finishing the crossing restores the hard
  verticals the frame ramps exist to hide; and this plate composites *on top* of the field, so pool
  over pool is `1-(1-a)²`: a "merged" cell is twice the density of the ground. A separate layer has
  one way to equal the ground, which is to add nothing to it.
- **The absorption reading is carried by `seed` + `blend` instead**: the departure order is the
  field's own plasma shapes, and a cell's last ink before it goes is `--p-pool`.
- **`spread` delays a cell's start; it must not shorten its life.** Do not rescale to keep the front
  inside one band: at `spread 1` the divisor collapses, a cell's whole exit happens in one row, and
  `blend` silently does nothing because there are no rows left to cross in.
- **Thinning is multiplicative**, never a subtracted constant: proportional thinning holds a cell's
  relative tone, where a constant bleaches the highlights first.
- **The frame ramps take the MAX of three edges, not the sum** (a corner is one cut seen twice), and
  they are **gated** by whether the silhouette actually runs off that edge. Ungated they bleach
  hair and cheek on a tighter crop.
- **The LIVE INDEX is the perf story.** A cell can only change state when its static tone sits
  within `wob` of a quantization boundary, so indexing those once turns a ~70k-cell per-frame loop
  into ~15k. Hoist instance fields into locals inside these loops.

### Guards, both canvases

**Both hero canvases paint on a worker, and that is not an optimisation to be undone.** A per-pixel
loop on the main thread is a per-pixel loop on the thread the page's own scrolling is waiting for:
the wheel filter binds `{ passive: false }` and preventDefaults, so the compositor cannot move the
page until that thread is free. Measured at 3440x1440 in Brave on the GPU, under a real wheel
gesture, moving them off took main-thread time from 11.4ms a frame to 2.4ms and dropped frames from
12% to 0. Anything that puts pixel work back on the main thread, including "just for the fallback",
gives that back. Where `OffscreenCanvas` is missing there is deliberately no canvas at all: the
CSS pool and the still PNG are already the pre-hydration layer and are a composition that works.

Paused off screen via `IntersectionObserver` AND on `visibilitychange`: an IntersectionObserver
never fires for a hidden tab, so the second is not redundant. A single static frame under
`prefers-reduced-motion`, **except** the portrait's scroll cut, which stays live because a frozen
reader still must not meet a headless torso in About. **Soft edges are gradients, not
`filter: blur()`**: a live filter makes Firefox re-rasterize the stack every scroll frame (it tore
as stray straight lines), where a gradient is a plain paint the compositor keeps.

### Custom properties on the scroll path

An **inherited** custom property written once per scroll frame invalidates the inherited style of
every element beneath the one it is written on, whether or not they read it. `--hero-exit` is
`inherits: false` and HeroExit writes it on each `.hero-out` instead: seven writes cost less than
one, because what is expensive is not the write. Registering the *derived* properties (`--u`,
`--lead`, `--span`) was tried and measured nothing: the cost is the readers recomputing
`transform` and `opacity`, which is the animation itself.

## Performance: measure it, and on the right machine

Two rules, both learned by publishing numbers that were about nothing:

- **Headless has no GPU here.** Headless Chromium falls back to SwiftShader and rasterizes on the
  CPU, so every compositing cost reads several times what it is on the card that draws this page.
  `probe-frames`/`probe-wheel` refuse to time anything without `--headed`. Headless is still right
  for pixels and DOM checks.
- **rAF cadence cannot see headroom.** A page using 9ms of a 10ms frame reports the same 10.0 as one
  using 1ms, so a green cadence means nothing on its own. `--cdp` reads Chromium's own counters
  (task, script, style, layout ms per frame), and that is the number that moves.

Two traps that make a run measure a page that does not exist: a **server started before the last
build** serves a stale chunk manifest, hydration throws, and the page measures beautifully because
it is doing nothing (restart `probe:serve` after every build; the probe now checks for the hero
canvas). And a **wheel aimed outside the real OS window** (which is smaller than an emulated
3440x1440 viewport) comes back `cancelable: false`, so the filter cannot prevent it and the page is
scrolled twice at once.

## Alignment: measure it

"The alignment is off" is the one class of defect a screenshot is worst at. Two failures look
identical on screen and share no cause, so `scripts/probe-align.mjs` checks all three across a ladder of
real widths (320 → 2560) and prints the offset in pixels:

- **PAIRS**: edges that must be equal. Two are worth stating because they are not the same thing:
  a **box** edge (`getBoundingClientRect`) and an **ink** edge (a `Range` over the text). Display
  type has side bearing and mono has letter-spacing on its last glyph, so a heading whose box is
  flush can still read indented.
- **BASELINE**: where a line of type actually sits, which no edge reports. Read off a zero-width
  strut appended to the element; form fields can't hold one, so theirs is computed from the font's
  ascent/descent and its line-height. Needed because `align-items: baseline` is a lie on a
  textarea: it is a scroll container, so its baseline is its bottom edge, not its first line.
- **INK**: a glyph centred inside a filled box, screenshotted at 4x with the ink bounds found in
  real pixels. `items-center` centres the LINE BOX and `justify-center` centres the LAYOUT RUN;
  neither is the ink, and a solid fill makes the difference impossible to unsee. The Services index
  chip carries `ps-[0.125em]`/`pb-[0.208em]` for exactly this, and the probe is what proves the
  correction still holds (measured: 0.13px off centre, every width).

Run it whenever anything is claimed to line up, before answering, not after a screenshot argument.
It needs a **fresh** production build on **3199** serving it (`npm run build && npm run probe:serve`,
restarting that server rather than reusing one): a server left running across a rebuild serves the old HTML against new chunk names, the
stylesheet 500s, and an unstyled page passes most edge checks. The probe aborts if the page has no
CSS rules for exactly that reason.

A check that only means something in one layout must carry its `minWidth`, or it fails on every
phone by correctly describing a stack. Add a pair the moment two things are supposed to line up:
an 18px misalignment at *every* width has shipped before, unseen in five screenshots.

## Component notes

Long-form arguments for three components whose source keeps only a one-line pointer.

### `Header.tsx`: a nav with no ground

The bar is bare type over a page that is not one tone: the works cards are full-bleed artwork, and
bare ink links can fall to ~1.8:1 over a dark one. So it samples what is under it and flips ink to
paper. Deliberately **not** a paper plate (a filled
rectangle is the only UI widget on an otherwise typographic page) and **not**
`mix-blend-difference` (monochrome by construction, can never hold a hue).

Three state channels:

| Channel | Means | Drawn as |
|---|---|---|
| COLOUR | the cursor is here | the word turns steel `#6e7d8c` |
| MARK | the section is in view | trailing square, in the accent |
| GROUND | what I am standing on | ink over paper, paper over ink |

Two channels, two pictures: **one hue each, and they never trade**. Do not put the cursor and the
position on the same object again: sharing the square cost the active section its mark for as long
as you pointed at it, and sharing a pair of brackets before that failed the same way. The bar is
too small to hold two mark systems, so the second one is not a mark at all.

The mark is a **drawn square, not a `.` character**: a period glyph at this size is ~3px of ink and
invisible at accent contrast, so `em` size is the knob, not hue. It is **always rendered** and
toggles opacity; rendering it only when active would re-flow the right-aligned row on every section
change.

The hover hue is fixed rather than derived, and it has to clear **3:1 on both grounds** because the
bar flips: steel measures 3.59:1 on paper and 3.13:1 on a dark card. That is the test every
candidate failed: ink-soft is 5.46/2.06, marigold is 1.72/6.53. It is also the hero pool's own
family walked 85% toward ink, so it is not a fourth hue on the page. The rule therefore has to
outrank the ground flip (`.nav-row a.nav-link:hover`), or a hovered word over a dark card stays
paper.

**Where a nav click lands** is `landing()`, not `scroll-margin`. It frames the section's **ink box**
(border box less its own padding), so whitespace inside the section cannot decide the landing:

- **Fits under the nav** (ink ≤ viewport − clearance − tail) → **centred** in that space.
  Top-aligning a short section leaves its slack at the FOOT, which is how About at 1440 ran out of
  ink 194px early and put the WORKS heading on screen.
- **Fits on screen** but not under the nav → aligned by its **last line**. It borrows the nav's
  clearance rather than cutting its own tail: Services is 800px of ink in 768px of room, and
  top-aligning it cut row (06) for whitespace nobody reads.
- **Taller than the screen** → its **first** line, cleared only by the nav bar's own height. Nothing
  can show it whole, so you start at the beginning, but the generous clearance is tuned for a
  section that fits, and here every pixel of it costs a pixel at the far end. At 393x851 that is
  exactly the difference between the contact card landing inside the fold (ink top 72, card bottom
  850) and being cut 39px short of it.

Every number is read off the DOM: the clearance is `scrollMarginTop + padding-top` (the gap a
top-aligned section already landed at, reused rather than re-picked), `bar` is `.nav-row`'s height,
and the tail is `1.5rem` so the whole rule tracks the fluid root. Measured at 1440x900 it lands
About at ink-top 241, Works and Services both at ink-bottom 876, Contact at 824.

**A section cannot always be shown alone**, and no landing can fix that: it is the section rhythm.
Works on a 393x851 phone is 530px of ink between two 128px gaps: hiding About's last line needs
scroll ≥ 1635 and hiding the Services heading needs ≤ 1570, so one of them is on screen by up to
65px whatever you do. It clears at 1440 (817px of ink between 192px gaps leaves a 300px window) and
would clear on the phone only if the mobile gap went from 128 to ~161, i.e. `py-16` → `py-20`, which
is the whole page's rhythm and not this section's.

**Opening a Services row follows it down** (`reveal()`), by exactly the overhang past the fold and
never past the row's own clearance under the nav: you must still see the title you clicked. It is
measured BEFORE React commits, so two things are arithmetic rather than observed: the panel's height
comes from the child's `scrollHeight` (its own track is still `0fr`), and a row closing ABOVE this
one has its height subtracted, since the document shrinks by it. Waiting for `transitionend` would
make both exact and cost a 380ms dead beat between click and movement.

**Reduced motion takes the same target**, instantly, never the browser's own anchor jump, which
honours `scroll-margin` and nothing else and so lands somewhere `landing()` did not choose.

The ground flip is asked **per link, not per bar**. Right-aligned, the row spans 842 to 1266 at 1440,
so two links sit on the front card while two hang onto paper: coverage peaks at 0.442 and never
reaches a 0.5 majority, so a bar-level test flipped *nothing* and left two links on dark artwork at
~3.65:1. Two details learned by watching it fail: the probe is the **words, not the box** (link
padding is a touch target and hangs off a card's edge while every glyph sits on it, and measuring boxes
held links at 1.8:1, so a Range over the contents is what gets measured), and coverage is a
**majority, not full**, so a word straddling an edge takes the side carrying most of its ink.

**Known limits**, both inherent rather than pending. Ink and paper are equally legible at ground
luminance **0.178**, where the best obtainable contrast is **3.92:1**, under AA whichever way the
bar flips; only a surface closes that, and a surface is what this page rejected twice. And a 96px
section heading passes *through* the links, a collision the flip does not address.

The nav glide is **constant-rate exponential decay** (~0.92 of the distance retained per 60fps
frame), not a fixed-duration tween: every trip settles in about the same 1.4s regardless of length.
A fixed duration makes the Contact trip crawl and the About trip snap; a fixed speed does the
reverse. Reduced motion **deletes** this effect rather than degrading it: it moves the viewport up
to 6500px, so the movement *is* the effect and the honest fallback is the browser's instant jump.

### `SectionHeading.tsx`: the decode trigger

An entry is **two conditions**, and both observers read the same `-8% 0px -45% 0px` root from
opposite extremes: `armed` wants zero overlap since the last play, `fire` wants full overlap
(`threshold: 1`). Same rectangle, opposite ends.

The lower 45% inset is what makes both scroll directions agree. "Fully visible" alone triggers at
opposite ends of the screen depending on travel: coming down a heading enters from the bottom and
would fire at 68% down, playing the whole 240ms decode in the corner of your eye; coming up it
enters from the top and travels into view, which always looked right. Requiring it to clear the
lower 45% moves the downward trigger to ~45% down and leaves the upward one alone. About needs this
most, sitting 8px below the fold.

The initial arm comes from the **fire** observer's first callback, not the exit one: at load the
question is "have you read it yet", not "is it off screen". An observer reports current state before
any crossing, so a heading already at reading position stays disarmed, while one that loaded below
the trigger root (deep links land that way) still arms.

Reduced motion **still decodes**, because the effect contains no motion: glyphs are replaced in
place, and the flag is asking about movement and parallax. What is honoured: the churn drops to one
noise state per lock instead of ~25 a second. Movement off, information on.

Slots sweep **by line**, so the cost is the longest line rather than the sum; a continuous sweep made
"Skills & Services" 720ms against About's 225ms and you waited on a heading you had already read.

### `Works.tsx`: the ribbon

Six cards, two per project, each at `wrap(k - s, 6)`: every card moves one slot at one speed, and the
wrapping card always crosses offscreen. The engine writes only `--p` (signed slot) and `--q`
(`min(|p|, 1)`) per card; `.works-card` turns them into position, scale and veil with the section's
`--cw` / `--gx` / `--gs` / `--gv`, so the server render is already placed and every breakpoint lives in
CSS. A drag reads `--gx` once per gesture to follow the finger 1:1.

Steps run cubic-bezier(.65,0,.25,1) over 640ms with a 24ms follow-through stagger; a released drag
runs an ease-out only, because it is already moving. A tap beside the front card steps that way.

The caption lays every project into one grid cell and shows one, so each slot is as tall as its
longest project **at the current width**: nothing below it moves between projects, at any size,
without a hand-tuned line count. The words leave in 160ms toward the old side and arrive in 300ms from
the new one; `flushSync` pins the offscreen pose before the arrival transitions away from it.

Layout: below md the name and the numbers share a line; from md the caption is two columns as wide as
the card (words left; stack, link and numbers right). `--cw` is floored at 620px from md so a tablet's
caption keeps two real columns, and capped at 720px because the screenshots are ~1000px wide.

Clips: a project with `clip` plays a scripted loop from `public/works/<clip>-d|m.{webm,hevc.mp4,mp4}`
(AV1, HEVC, H.264, first playable wins). Below md the card is portrait (430/573), the shape of the phone
loops; the `<picture>` still is the loop's first frame, so there is no jump when it starts. A card
gets its `<video>` the first time it is in front while the strip is within 200px of the screen,
`preload="none"`, and pauses in place when it leaves the front. `.works-stage` is `isolation:
isolate` so the cards' z-index never climbs over the header's menu.

Reduced motion: the ribbon jumps and the words crossfade in place (150ms, no slide). The clips still
play: they are the content of the card, not interface motion. A rAF card never
fires `transitionend`, so the engine dispatches one on the front card when it settles; Header.tsx
re-samples the nav's ground on it. `data-ground` is measured per artwork against 0.178; only the
front card can be dark, since the veil lifts every neighbour.

## Stack skills

See `skills-index.md`: it is the full map of what is installed.
