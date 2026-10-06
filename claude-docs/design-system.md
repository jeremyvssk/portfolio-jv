# Design system (single source of truth)

**Read when:** choosing or applying color, typography, spacing, radii, shadows, or motion
tokens. **Do not invent values that conflict with this file.** If a section is empty, that's
the signal to run the Design Tokens phase (`/design-flow`) with me, not to improvise.

Rule of truth: this file is the human-readable spec; **`src/app/globals.css` is the machine
truth**: `@theme` plus the `--p-*` vars on `:root`. When they drift, the CSS wins and this file
gets updated. Hero paint implementation lives in `frontend-conventions.md`.

## Brand / tone

- Aesthetic direction: **Editorial.** One uninterrupted paper ground; sections divide by
  **ground-tone shifts and whitespace**. Big Rubik headings; type does the heavy lifting.
- Personality in 3 words: _considered, quiet, precise_.
- One deliberate risk: the **hero colour pool** is the page's only large colour, and it washes
  across the hero/about boundary rather than respecting it. WORKS is also a full-bleed carousel
  that breaks the padded grid.

## Color

**Light-only, single palette. No dark mode.** Everything reads from CSS vars: `@theme` maps
Tailwind's `--color-*` utilities onto `--p-*` vars on `:root`.

Warm paper, black ink, one marigold fill.

| Token | Hex | On paper | Role |
|---|---|---|---|
| `--p-paper` | `#f2ece2` | n/a | lightest ground |
| `--p-ground` | `#e0d7c6` | n/a | tonal-drift step (About, Works cards) |
| `--p-ink` | `#161616` | 15.4:1 | all type **and** every focus ring |
| `--p-ink-near` | `#2c2b2a` | 12.0:1 | Services row titles at rest, see below |
| `--p-ink-soft` | `#655e50` | 5.46:1 | meta, captions, secondary |
| `--p-accent` | `#f5a623` | **1.72:1** | fills, see the rule below |
| `--p-line` | `#d0c7b6` | n/a | hairlines: card outlines + list separators only |
| `--p-pool` | `#a4aed6` | n/a | hero pool gradient only (CSS-only, no Tailwind utility) |

Paper's relative luminance is **0.844**. It is a warm hue at that value on purpose, not a
desaturated one: R−B **+16**.

### The accent is a GROUND, not a mark

Marigold is **1.72:1** on paper. It does **not** clear the **3:1** floor WCAG 1.4.11 asks of a
graphic carrying meaning. This palette knowingly walks that back, and the rule follows the
measurement:

**Marigold may be a ground you read black against. It may not be the thing you are trying to
see.** Ink on it is **8.93:1**.

Small marks in this colour read by **area alone**, and 0.42em was never sized for that job.
If a mark turns out to be missing rather than quiet, the fix is **em, ink, or an edge, not a
fourth hue.** That road has been walked three times.

The shape language is unchanged: **drawn squares sized in `em`**, never a `.` character, never a
hairline, never a letter.

Mark sizes were picked off a rendered ladder in Firefox, not derived:

| mark | size | rendered | source |
|---|---|---|---|
| nav active | `0.42em` of `0.9rem` | 6.0px | `Header.tsx` |
| `SectionHeading` | `0.13em` of the clamped heading | ~12px at 6rem | `SectionHeading.tsx` |
| hero name period | the real Rubik glyph at the name's 168px | _unmeasured_ | `.hero-name` |

The nav mark is **0.42em, my call**, stepped down from the 0.58em the ladder picked.

The hero keeps the **glyph** rather than a drawn square: at display scale a period already *is*
an area, and Rubik's is a rounded square to begin with.

### Where the accent is allowed

**One token, one job.** Eight sanctioned places, two shapes:

**Boxes carrying ink** (a ground you read against):
1. works rail active box: `bg-accent` with **ink** digits, **8.93:1**. Never paper digits:
   paper on marigold is 1.72:1 and a 10px numeral there is simply not present;
2. services open row: the `(NN)` index box fills, the title stays ink;
3. the Contact CTA, the one fill doing real work rather than marking state.

**Squares carrying nothing** (an area you notice):
4. nav active link, `0.42em` (desktop + mobile panel);
5-7. `SectionHeading` at About / Works / Skills & Services, `0.13em`;
8. the period on VAASK.

A ninth needs its own entry here. **The bound is one MEANING**: a second location is fine, a
second job is not. It marks *where you are* and *what to press*, never *what the cursor is on*.

One deliberate inconsistency: "you are here" has two pictures, a square in the nav and a filled
box on the works rail. Defensible because the substrates differ: the rail's slots are bordered
cells, where filling one is the natural selected state; the nav is bare type, where a full stop
is. Revisit only if the rail stops being cells.

**Open:** every accent SQUARE is under the 3:1 non-text floor. That covers nav active (`0.42em`),
`SectionHeading` (`0.13em`), the Services bullet (6px). See the rule above.

### Nav hover is the mark in ink

One square in one place carries both states, separated by **hue**: **ink** (`currentColor`)
means the cursor is on this word, **accent** means you are in this section. Services hover
instead dims the row to `ink-soft`, a different substrate (a full-width list row, not a word
in a bar).

### Services hover: three crossfades, no geometry

Every row answers for itself: bottom hairline `line -> ink` at **300ms expo-out**, index digits
and title `-> ink` at **150ms** standard ease. Nothing is drawn, scaled or moved. Do not
re-pitch dimming the whole list: it turned five titles black at once *on exit*, which made the
loudest thing the section did fire as you left it.

**Why no wipe.** A scaled-in underline has to un-scale on exit, and expo-out spends two thirds of
its 300ms on the last tenth of the distance. Arriving, that tail is off in the periphery;
leaving, it is at the origin you are looking at, so the ink retreats to a stub and hangs there.
That is the "bounce". Colour has no origin, so the same curve is safe on it.

**Two speeds, not one.** Text at 150ms lands first, the rule catches up at 300ms. That pairing is
most of what reads as smooth; matching them flattens it.

**Rest value.** Row titles sit at `ink-near`, **Rubik 600** (see the weight exception below). Full
ink is what the *pointed* row gets, so the loudness did not go away, it became something one row
does instead of something five rows do at rest.

**The rule is the row's own `border-bottom`,** not a drawn element: the row wraps its panel, so an
open row's hairline already sits below the panel and rides down as it opens. `border-bottom-color`
only. Lighting the first row's `border-t` too would read as bracketed rather than underlined.

**HOVER OUTRANKS ACTIVE** (my call). Source order in `globals.css` puts the `:hover` rule
last and restates `background-color`, so pointing at the section you are already in turns its
square black.

**Known cost:** the active square is hidden while the cursor rests on it. The accepted trade,
because position is a fact you can re-read by moving the mouse, where the cursor is a live
answer to "did that register".

The ground flip needs no new rule: `[data-on-dark] .nav-row .nav-link` recolours the link, so
the hover square rides it to paper for free, while the active square declares
`var(--color-accent)` on itself and stays marigold: 1.72:1 on paper, ~9:1 on a dark card. That
gap is the sharpest statement of this hue's problem anywhere on the page: the one place it reads
is the one place the type around it does not.

### Ground rules that bound future colour work

- **Nav ground rule.** Ink and paper are equally legible on a ground of luminance **0.178**:
  `sqrt((L_ink + .05)(L_paper + .05)) - .05`. At that crossover the best contrast obtainable is
  **3.92:1** whichever way type flips, so a bare-type nav over mid-tone photography **cannot
  reach 4.5:1 without a surface.** Anything added to the header needs its own contrast argument.
- **The real constraint is the ground, not the hue.** The page is almost entirely paper at
  luminance 0.844, a field a bright accent has little to be brighter *than*. Fill-only is the
  only honest way to use the accent. **If a dark section ever lands, this reopens.**

### Hero pool (the visual spec)

**ONE pool** (`--p-pool` periwinkle), straddling the hero/about boundary so the two sections read
as one moment. **Do not add a second.** An upper-left pool was built and dropped: it sat under
the trade line and the headline's first rows, which is to say under everything the hero asks you
to read first.

The top-left of the hero is **bare paper by design**: the trade line has that corner to itself.
The name sits off the floor (`mb-[8cqw]` on the `<h1>`) so it clears the arc rather than sitting
inside it.

Rendered in two layers: a smooth CSS gradient (`.hero-pools`, `opacity: .3`) and a dithered
pixel field on top (`HeroField.tsx`). **Both layers ship; the smooth shape underneath is what
holds the pool while the field animates inside it.**

- **The centre sits off-frame** (below the fold, right of the column), so what you see is an
  arc, never a disc. **Radius is what buys the curve**: a shape small enough to fit inside the
  viewport lands as a blob.
- The radius is capped against layer **width** and **height**, not just `vmax`, and the
  ellipse's long axis follows the viewport's long axis (portrait flip). Uncapped, a phone or an
  ultrawide flattens the arc into a corner wash.
- Use `%`, not `vw`: `%` resolves against the same box the canvas measures.
- **The pool shape is sacred, motion is texture-only.** Static rim; the plasma drifts *inside*
  it; translate-only drift on the CSS layer. **No outline deformation, no discrete interior
  shapes**: both were built and rejected. Do not re-pitch without new direction.
- Periwinkle is 1.86:1 on paper and the page's **only cool note**, the odd colour rather than
  the loudest member of a cool family.
- **Measured contrast floor:** ink against the darkest composited pixel is comfortably AAA.
  **The tint has no headroom:** louder can only come from coverage, never from a deeper blue.
- All hero type is `text-ink`, not `ink-soft`: size and weight already separate a 19.7px
  tracked mono line from a 168px display name past anything a tint could add.

Implementation (the dials, plasma constants, dither and RAF guards) lives in
`frontend-conventions.md`.

## Typography

- **Display / heading: Rubik** (`--font-display`), self-hosted via `next/font/google`, OFL.
  Three weights, three jobs, and every display element must declare the weight it means:
  - **800**: the hero name alone, plus the contact headline.
  - **700**: display mass under a heading (section titles, works captions).
  - **600**: UI-scale display for nav links (0.9rem), the mobile menu, **and Services row titles**.

  One step, not two: 600 at 96px reads as a different voice rather than a lighter one, which is
  why sections landed on 700. **Services rows are the exception, and scale is why:**
  the objection was measured at heading size, and the rows top out at 2.5rem. Rendered and
  pixel-counted in Firefox, one row's ink coverage runs 7.69% at 700 against 6.87% at 600, the
  cheapest 11% of ink available, on the only element the page repeats five times at display size. Set **UPPERCASE**. Rubik's soft letter corners are what motivated
  the radius tokens below.
- **Body / UI: IBM Plex Mono** (`--font-ui`), weights 400/500. All copy, labels, meta.
- **Pairing rationale:** a blunt grotesque against a mono makes rank carried by *kind* of type
  as well as by size. One family for both would rest hierarchy entirely on size.
- Type scale: section headings `clamp(2.75rem, 8vw, 6rem)`; contact `clamp(2.5rem, 9vw,
  6.5rem)`; body `1rem`→`1.125rem` (md); labels/captions/meta `0.75rem`.
  - **Exception:** About body is its own step, `clamp(1.25rem, 2vw, 1.75rem)` at
    `leading-[1.6]`: it is the pitch and it is only two paragraphs. Size and measure are one
    decision: Plex Mono advances ~0.6em per character, so 28px across `max-w-6xl` lands ~64
    characters. Dropping the size would *lengthen* the line.
  - **Exception:** the hero meta foot, `clamp(0.75rem, 0.6rem + 0.5vw, 1rem)`. Its floor is
    fixed by width, not taste (12px is the largest that holds its 30-char item on a 375 screen).
- Weights / line-heights / tracking: headings **700**, `leading-[0.9]`, `tracking-[-0.02em]`,
  uppercase; body `leading-relaxed`; labels/captions uppercase, `tracking-[0.2em]` to `[0.25em]`.
  - **Exception:** the hero name runs `0.82`, because two rows of one size must sit tight to read as
    one mass, and caps-only type has no descenders to collide.
  - **Exception:** the hero trade line is promoted off the caption step to
    `clamp(0.8125rem, 0.55rem + 0.85vw, 1.375rem)` at `tracking-[0.16em]`, a first-class hero
    element, read first, not a caption. Its 13px floor is the largest size that holds all 30
    tracked characters inside a 375 screen.

### The hero name is the DIAGONAL

Trade top-left, meta stack top-right, name bottom-left: the two loud corners sit opposite each
other so the eye crosses the frame and the middle is left to the colour field. Flush left and
**ragged right**: the name is sized to a *fraction* of the measure, not justified to it, and
the rag between JEREMY and VAASK is the shape. Load-bearing, in `.hero-diag`/`.hero-name`:

1. **The ink constant IS the layout.** In Rubik ExtraBold, uppercase at `-0.02em`: JEREMY
   **4.136em**, VAASK **3.400em**. Divisors are `ink ÷ target fraction`: **7.43** landscape
   (55.7% of the measure) and **4.50** portrait (92%), matching `.hero-name` in `globals.css`.
   At 1440 the name computes to **168px**.
   **Re-measure on any change of name, family, weight, or tracking.** Rubik needs no
   optical-alignment nudge: J and V both measure a 0.01em left side bearing.
   **The period does not move the type:** both divisors derive from **JEREMY**, the longer row.
   VAASK's constant is not an input to the size, it is only the rag. Adding the period
   therefore only flattens the ragged edge. *(Its exact cost in em is unmeasured under Rubik.)*
   **How to re-measure:** a throwaway page that `@font-face`s the woff2 directly
   and sets the word at a known size (200px) with the real tracking, rendered headless in
   Firefox, then `magick -crop <row> -colorspace gray -threshold 55% -negate -trim -format '%w'`
   for the ink box; `ink_px ÷ 200` is the em value. Validate the method by reproducing the
   *current* constant before trusting a new one.
2. **The hero has its own frame.** `--gut: clamp(1.5rem, 6.67vw, 6rem)` on `.hero-band` (96px
   at 1440), and `--hd-m: 100cqw` is the measure between those gutters. Every edge of the
   composition (trade, rule, name, vertical mark, CTA) is set from `--gut`. The header sits at a
   *different* inset on purpose; if that ever reads wrong, move the header out to `--gut` too
   rather than re-capping the hero.
3. **`cqw`, not `vw`**: a desktop scrollbar the container does not have. The portrait/landscape
   switch is `min-aspect-ratio: 1/1`, not a width, because a portrait tablet is shaped like a
   phone and wants the name to fill the measure.
4. **`letter-spacing` must be declared on whatever carries the font-size.** `em` there computes
   against the *declaring* element's size and then inherits as an absolute length. Declared on
   the wrong element it silently became -0.32px instead of -2.4px and every row overshot the
   measure by 37px.

**The hero name is the page's only wordmark.** It is not repeated in the header. Consequence,
accepted: there is no back-to-top affordance and no nav item for `#top`.

**The header carries no surface** (four links, bare type, no ground), so it **hides while the
page is moving and returns ~1s after it settles**. A bar with no ground cannot survive a 96px
heading passing under it. Full reasoning and the ground-flip rules: `frontend-conventions.md`.

## Spacing & layout

- Spacing scale: Tailwind default (4px base).
- Container widths: content `max-w-page` = `max(72rem, 62vw)` (`--container-page` in `@theme`); the 62vw half only binds past 16:9, on 21:9 and big TVs. Works row is full-bleed.
  Gutters `px-6` (mobile) → `md:px-10`.
- Grid: works 3-up `md:grid-cols-[1fr_1.45fr_1fr]` (centre emphasised). Services is **not a
  grid**: a single-open index of full-column rows on horizontal hairlines. Row anatomy: a
  `md:w-12` mono index, a 2rem gap, the title at `clamp(1.25rem, 3.4vw, 2.5rem)`, toggle pushed
  right. The index's fixed width is what makes the open panel's `md:ps-20` indent land exactly
  on the title's left edge: change one and you change the other. The index hides below `md`:
  it is decoration, and a 375 screen needs the width for the title.
- Services is also the one section **not** vertically centred and **without `min-h-svh`**: its
  height changes on every click, and centred, opening a panel would slide the heading upward.
  Works is the precedent for a content-sized section.
- Section rhythm: `py-20`→`py-32`; anchor offset `scroll-mt-24` under the fixed header.
- Breakpoints: mobile-first; a single `md` (768px) step drives every layout change, with two
  exceptions. The hero headline switches on viewport *shape* (`min-aspect-ratio: 1/1`). The stack
  wall in Services row 05 takes a second step at **1152px**, where it stops being columns at all:
  two columns on the phone, three past `md`, and one left-packed flex line per group past 1152.
  Equal tracks are what a grid is for, and this is a list: at three columns a "Java" badge holds
  a track as wide as "Claude Code" and the wall reads as a grid with holes in it. 1152 is
  `max-w-6xl`, the width at which the section stops growing, and that is what makes the flex line
  safe: it gets the panel's full 992px against 819px for the widest group, so it never wraps and
  never strands a badge alone. Below `md` the wall is capped to its phone width instead of
  gaining a third state.

### A logo has a minimum size, and it belongs to the logo

A mark is not free to be drawn at any size: below a certain box its own thinnest stroke stops
covering a whole device pixel and the mark goes grey, breaks up, or fills its holes shut. **The
binding case is a 1x screen**, which gets half the pixels of a retina one for the same CSS size,
and, because `html`'s clamp pins the root at 16px until 1440, the smallest desktop mark is the one
at **768-1440**, not the one on the widest screen. `check:legible` measures it: how much of a mark
an opening with a half-device-pixel disc removes, on the ink and on the holes both.

Two consequences the layout has to respect:

- **The preview strip on the closed row takes 0.62 of `--logo`, so its marks are drawn at 21px**,
  the smallest box on the page. Only marks whose strokes clear a device pixel there may sit in
  `PEEK`. Java lost 67% of itself at that size; React, at 0.97 device px per orbit, is the sharpest
  illustration of the cliff, holding at 23px and breaking at 21.
- **Detailed artwork is the thing that fails, not the renderer.** Both engines reproduce these
  files faithfully at every size the site uses. Where a mark still reads as mud (PostgreSQL, Linux
  and Java sit at 18-19% loss on a 1x laptop), the levers are simpler artwork or a bigger box.
  **Thickening the strokes is not one of them**; it was tried and reads as a smudge at every size
  above the one it was meant to rescue.

And a mark must be **rendered at the size it ships**, not rendered large and reduced: a multi-step
export gave React a five-pixel antialias band where a direct render gives one, and a soft mask
drawn small reads grey however good the artwork is. `check:legible` fails on a band over 4px.

## Shape & depth

- Radii: one radius per object class, so the page agrees with Rubik's soft letter corners:
  - `--radius-box: 0.375rem` (`rounded-box`): every bordered box/chip/plate. Small on purpose:
    a rectangle with eased corners, never a pill.
    **Known:** at 6px on a small filled box the arc rasterizes into ~3 visible steps at 1x
    ("the corners feel pixelated"); it disappears at 2x. Radius is the only lever: 8px and 10px
    both render smoother, so raising the token is the move if it comes up again.
    The other half is **sizing**: a box sized by its own text came out 41.9 x 33 CSS px on a row
    whose centring put it at x.05, so every edge painted at partial coverage and fringed. The
    works rail buttons are a fixed `w-11 h-9 md:h-8` for that reason: integers land on the
    device grid at 1x. Any small high-contrast fill wants the same treatment.
  - `.mark-r` = `border-radius: 22%`: every em-sized accent/ink MARK. Percentage, not rem, so
    the curve tracks the mark from 12px display squares down to 4px nav marks.
  - Hairline RULES (accordion rows, list separators) stay square: they are lines, not boxes.
- Shadows / elevation: **none**, flatness is the point. Depth comes from the paper gradient +
  grain.
- Borders / dividers: 1px `--color-line` hairlines for **card outlines + list separators only**.
  Sections divide by ground tone and whitespace, not rules.

## Motion tokens

(See `animations.md` for usage.) Still unnamed: values are inlined at their use sites. The
de-facto set, so a fourth is not invented: **`700ms cubic-bezier(0.16, 1, 0.3, 1)`** (expo-out)
for work cards; **`380ms`** on the same expo-out for the services panel; **`140ms ease-out`** for
micro state (the services toggle's rotate); `150ms`/`300ms` `transition-colors`/`opacity` for
link hovers. The Services row pairs both, text at 150ms `cubic-bezier(0.4, 0, 0.2, 1)` against
the rule's 300ms expo-out. `prefers-reduced-motion` is respected globally in `globals.css`, with one carve-out: the
Services row's colour crossfades keep their durations, because a crossfade moves nothing on
screen and flattening it costs a reader the row's only feedback for no motion saved. Everything
geometric, this section's panel included, stays flattened. Promote these to
named tokens when a fourth consumer appears.

**The services panel does not animate height**, which `animations.md` forbids. It is a one-row
grid whose track runs `0fr -> 1fr` (`.svc-panel`), so the browser interpolates a track and the
child clips against it: no height is set or measured in JS, and the global reduced-motion rule
flattens it without a JS gate. `interpolate-size: allow-keywords` would be shorter but Firefox
does not support it, and this page is verified in Firefox.

## Semantic colour

_Not yet needed. Add when forms/states appear._
