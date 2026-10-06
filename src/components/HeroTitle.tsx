// Hero, the diagonal cover: trade top-left over a full-bleed rule, availability right-aligned under
// it, place set vertically down the right-hand gutter, name on the floor at lower-left, CTA in the
// opposite corner, and the whole middle given to the colour field and the figure standing in it.
// The trade is read first, which is the right order for someone looking for work; the name is the
// payload and takes the display size, and the load-in follows that reading order.
// Every edge is set from `--gut`; sizing maths lives in `.hero-diag` / `.hero-name`.
// Portrait collapses this to one left-aligned stack: at phone width the trade line alone eats the
// measure, and a vertical mark in a 24px gutter is unreadable.
//
// NO `"use client"`, and no animation library. As a Motion component, Motion stamped its `initial`
// state into the server HTML as an inline `opacity: 0`, so the hero stayed blank until the bundle
// hydrated, invisible on a slow connection and permanently invisible with JS off. The load-in lives
// in the `.reg-*` classes instead, leaving this with no state, no effects and no hooks: it
// renders on the server and ships no JS. The most reliable way to guarantee the name is on the page
// is for nothing to have to run.
//
// Delays and exit values are INLINE because they are the choreography: `--lead` is when an element
// starts leaving and `--rise` is how far it travels, both read off the one `--hero-exit` clock
// HeroExit publishes. Marks go first and travel least, the name last and furthest, so the hero
// decompresses upward with depth rather than sliding off as a sheet. Reading the two columns down
// this file is reading the sequence, which four CSS classes would hide. The exit stays a declaration
// that resolves to rest when the property is absent.

export default function HeroTitle() {
  return (
    // `.hero-band` owns the gutter and is the positioning context for the two marks that live in
    // it. `.hero-diag` carries the container query, so the name measures against the space BETWEEN
    // the gutters and any scrollbar is already subtracted, which `vw` would not do.
    <div className="hero-band flex flex-1 flex-col">
      <div className="hero-diag flex flex-1 flex-col">
          {/* Size is fluid, not stepped: the trade is a first-class hero element, not a caption, so
              it scales with the frame. INK rather than ink-soft: size and weight already separate
              this from a 191px display name by a margin no tint could add to, so colour was carrying
              no hierarchy here.
              Weight 500 and a 0.875rem floor are both measured. At 400 the strokes were the size of
              the field's dither cells and the texture out-textured them; mass is what separates them,
              not new machinery. The floor holds all 30 tracked characters inside a 375 screen
              (30 x (8.4px advance + 2.24px tracking) = 319px against a 327px measure); 1rem does
              not fit. */}
          <p
            className="reg-clip hero-out font-ui font-medium uppercase leading-none tracking-[0.16em] text-ink"
            style={{
              // The `min()` is the ONE-LINE GUARANTEE: a masthead cannot wrap, and below 375 the
              // clamp's 0.875rem floor alone overflows. "FULLSTACK DEVELOPER & DESIGNER" measures
              // 22.80em at this tracking; the divisor is 23 rather than 22.8 because at exactly 22.8
              // sub-pixel rounding still wrapped it at 320. RE-MEASURE the divisor if the words, the
              // family or the 0.16em tracking change.
              fontSize: "min(clamp(0.875rem, 0.625rem + 1.06vw, 1.625rem), calc(100cqw / 23))",
              "--lead": 0.12,
              "--rise": "5rem",
            } as React.CSSProperties}
          >
            <span className="reg-lift inline-block" style={{ "--d": "180ms" } as React.CSSProperties}>
              Fullstack Developer &amp; Designer
            </span>
          </p>

        {/* The masthead rule. Decorative and stated as such: it carries no structure a screen
            reader needs, and an `<hr>` here would announce a thematic break between a job title
            and a name, which is the opposite of what the composition says about them. */}
        <div
          aria-hidden
          className="hero-rule reg-draw hero-out mt-3.5"
          style={{ "--lead": 0.08, "--rise": "4rem" } as React.CSSProperties}
        />

        {/* Availability, right-aligned under the rule. Deliberately no status dot: two words on the
            gutter do the job. */}
        <p
          className="reg-fade hero-out mt-4.5 self-end font-ui uppercase leading-none tracking-[0.14em] text-ink"
          style={{
            fontSize: "clamp(0.75rem, 0.6rem + 0.5vw, 1rem)",
            "--rise": "3rem",
          } as React.CSSProperties}
        >
          Open to work
        </p>

        {/* On the floor, `mt-auto` pinning it. Where the pool's arc crosses the name's lower right,
            the answer is to move the FIGURE into that space rather than lift the name, so the arc
            sits behind the figure rather than behind the type. */}
        <h1 className="hero-name mt-auto font-display font-extrabold uppercase">
          <span
            className="reg-clip hero-out block"
            style={{ "--lead": 0.2, "--rise": "8rem" } as React.CSSProperties}
          >
            <span className="reg-lift block" style={{ "--d": "480ms" } as React.CSSProperties}>
              Jeremy
            </span>
          </span>
          <span
            className="reg-clip hero-out block"
            style={{ "--lead": 0.26, "--rise": "9rem" } as React.CSSProperties}
          >
            <span className="reg-lift block" style={{ "--d": "480ms" } as React.CSSProperties}>
              Vaask
              {/* The full stop: the same square, size and gap as the section headings and the contact
                  card. It lands last. */}
              <span
                aria-hidden
                className="reg-stamp mark-r ml-[0.1em] inline-block size-[0.13em] bg-accent align-baseline"
              />
            </span>
          </span>
        </h1>
      </div>

      {/* The two gutter marks. Both are `hidden sm:block`: below 640 the gutter is 24px, which is
          narrower than the type is tall. The CTA is also landscape-only: on an upright tablet the
          name spans 92% of the measure and the corner CTA landed on VAASK (47px at 768). */}
      <p
        className="hero-meta-v reg-fade hero-out hidden font-ui text-xs uppercase text-ink sm:block"
        style={
          { fontSize: "clamp(0.75rem, 0.6rem + 0.5vw, 1rem)", "--rise": "3rem" } as React.CSSProperties
        }
      >
        Tallinn, EE
      </p>
      {/* `transition-[translate]`, NOT `transition-transform`: the hover lift is a `translate`
          (Tailwind v4's individual property), but `transition-transform` also covers `transform`,
          which `.hero-out` drives from scroll. Transitioning that leaves the CTA easing 150ms behind
          every other element in the exit, exactly the "separate animations" reading the shared clock
          exists to remove. */}
      <a
        href="#contact"
        className="hero-cta reg-fade hero-out hidden rounded-box bg-ink font-ui uppercase tracking-[0.2em] text-accent transition-[translate,background-color,color] duration-150 hover:-translate-y-0.5 hover:bg-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:landscape:block"
        style={{ "--rise": "3rem" } as React.CSSProperties}
      >
        Get in touch
      </a>
    </div>
  );
}
