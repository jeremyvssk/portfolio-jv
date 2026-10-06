// Home: a single-scroll portfolio (hero, about, works, services, contact) on one paper ground.
//
// One `max-w-page` column (72rem, wider on 21:9, see globals.css) in every section. Whitespace is the only section divider, so every section
// carries `py-16 md:py-24`: 128px/192px between sections, twice a heading's gap to its own content.
// That `py` also feeds `landing()` (lib/browser/landing.ts), which frames each section's ink under
// the nav on anchor jumps, so changing the rhythm moves every anchor landing.
// Images are bundler imports from `src/img`, so a wrong path fails the build instead of 404ing.
import img2918Plate from "@/img/img2918.png";
import img2918 from "@/img/img2918.webp";
import ContactFloor from "@/components/ContactFloor";
import ContactForm from "@/components/ContactForm";
import HeroExit from "@/components/HeroExit";
import HeroField from "@/components/HeroField";
import HeroPortrait from "@/components/HeroPortrait";
import HeroTitle from "@/components/HeroTitle";
import SectionHeading from "@/components/SectionHeading";
import Services from "@/components/Services";
import Works from "@/components/Works";

const LINKS = [
  { label: "Email", text: "jvaaskj@gmail.com", href: "mailto:jvaaskj@gmail.com" },
  { label: "GitHub", text: "github.com/jeremyvssk", href: "https://github.com/jeremyvssk" },
  { label: "LinkedIn", text: "linkedin.com/in/jeremyvaask", href: "https://www.linkedin.com/in/jeremyvaask/" },
];

export default function Home() {
  return (
    <main>
      {/* HERO + ABOUT share one wrapper so the pool straddles the join and they read as one moment.
          `.hero-pools` is the smooth CSS pool (the no-JS fallback); HeroField paints the dithered one on top. */}
      <div id="hero-scope" className="relative isolate overflow-x-clip">
        {/* Publishes `--hero-exit` on the hero's readers; renders nothing. */}
        <HeroExit />
        <div aria-hidden className="hero-pools">
          <div className="pool-se" />
        </div>
        <HeroField />
        {/* THE FIGURE. Treatment defaults live in `lib/hero`, placement in `.hero-plate`. */}
        <HeroPortrait
          className="hero-plate"
          src={img2918.src}
          still={img2918Plate.src}
        />

        {/* HERO. Markup in HeroTitle, sizing in `.hero-diag` / `.hero-name`. No horizontal padding:
            `.hero-band` owns the gutter. The 1.5rem/6rem floor matches `--gut`, so the name sits as far off the
            bottom as off the side. Upright tablets keep 1.5rem so the name covers the shoulders' fade.
            `lvh` plus the toolbar's height (`100lvh - 100svh`) on the floor: iOS Safari draws the page
            under its toolbars, so an `svh` hero showed About's heading on load. The name stays where
            `svh` put it; on screens without toolbars the two units are equal and nothing moves. */}
        <section
          id="top"
          className="flex min-h-lvh flex-col pb-[calc(1.5rem+100lvh-100svh)] pt-24 md:pt-28 md:landscape:pb-[calc(6rem+100lvh-100svh)]"
        >
          <HeroTitle />
        </section>

      {/* ABOUT. Statement-scale copy across the full column: `min(6vw, 2.125rem)` sets each paragraph
          in 3 to 4 long lines from 1024 up and ~30 characters a line on a phone. The second paragraph steps in by 1em from lg (`ms`, so
          the whole block moves). `md:landscape:-mt-[8svh]` pulls it into the
          hero's empty tail, the one gap that is deliberately not the section rhythm. Landscape only: an
          upright iPad Pro showed About's heading on its first screen. */}
      <section
        id="about"
        className="scroll-mt-12 py-16 md:scroll-mt-3 md:py-24 md:landscape:-mt-[8svh]"
      >
        <div className="mx-auto w-full max-w-page px-6 md:px-10">
          <SectionHeading title="About" />
          {/* Weight 500: this copy stands on the pool. */}
          <div className="mt-14 space-y-[1.5em] font-body text-[min(6vw,2.125rem)] font-medium leading-[1.5] md:mt-20">
            <p>
              I&rsquo;m a fullstack developer and designer, working across
              websites, MVPs, and production tools. I design interfaces that
              resonate with the brand and build the reliable code that brings
              them to life.
            </p>
            <p className="lg:ms-[1em]">
              Before I build anything I want to understand the product: what we
              are making, why, and how much of it is realistic to build. I also
              bring a background in marketing, which is where I learned how a
              brand has to fit the people it wants to reach.
            </p>
          </div>
        </div>
      </section>

      </div>

      {/* WORKS. A full-bleed, centre-locked carousel that deliberately breaks the grid. */}
      <Works />

      {/* SERVICES. A single-open index; its own component because it holds state. */}
      <Services />

      {/* CONTACT. "Let's talk" is the section heading, so there is no label or rule above it. The
          channels as Services-style rows, the form in a box under them, then the floor: the hero's
          field returning as ground the page ends on. No bottom padding, because the floor IS the bottom. */}
      <section id="contact" className="scroll-mt-12 pt-16 md:scroll-mt-3 md:pt-24">
        <div className="mx-auto w-full max-w-page px-6 md:px-10">
          {/* Its own, larger scale: this heading is the ask, not a label. The ink runs 5.64em, so the 2.75rem
              floor still fits a 320px screen. */}
          <SectionHeading title={"Let\u2019s talk"} size="clamp(2.75rem, 9vw, 7.5rem)" />
          <ul className="ct-links">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="ct-lk"
                  {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
                >
                  <span className="ct-ix">{l.label}</span>
                  <span className="ct-v font-display font-semibold">
                    {l.text}
                    <span aria-hidden className="ct-arw font-ui">
                      &#8599;
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <ContactForm />
        </div>
        <div className="ct-floor">
          <ContactFloor />
          <div className="ct-base mx-auto w-full max-w-page px-6 md:px-10">
            <a
              href="https://github.com/jeremyvssk/portfolio-jv"
              target="_blank"
              rel="noreferrer"
              className="ct-sign font-ui"
            >
              2026 Jeremy Vaask<span className="sr-only">, source code on GitHub</span>
              {/* Drawn, not U+2197: the latin font subsets lack it, so iOS falls back to its emoji. */}
              <svg aria-hidden viewBox="0 0 10 10" className="arw size-[0.6em]">
                <path d="M2 8 8 2M3.5 2H8v4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </a>
            {/* A plain anchor: the nav's glide belongs to the nav. */}
            <a href="#top" className="ct-top font-ui">
              Back to top <span aria-hidden className="arw">&#8593;</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
