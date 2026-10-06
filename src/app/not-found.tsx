// 404: the hero's cover with 404 as its payload. The export writes it to 404.html, and
// `public/.htaccess` serves that for every missing address.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found · Jeremy Vaask",
};

// The address is the visitor's, which a static file cannot know. Inline and in place, so it runs
// before the first paint and the line never shows its placeholder; `suppressHydrationWarning` lets
// React keep the text it finds.
const address = `(function(){var e=document.getElementById("nf-addr"),p=location.pathname;try{p=decodeURI(p)}catch(_){}e.textContent=e.title=location.host+p})()`;

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      {/* The hero's frame and floor, on `svh`: there is no About below to keep off the first screen.
          The floor gives way under 800px tall so a phone on its side still fits. `overflow-y-clip`
          cuts Rubik's empty descent, which hangs past the floor and scrolled the page 41px. */}
      <section className="flex min-h-svh flex-col overflow-y-clip pb-6 pt-24 md:pt-28 md:landscape:pb-[min(6rem,12svh)]">
        <div className="hero-band flex flex-1 flex-col">
          <div className="hero-diag flex flex-1 flex-col">
            {/* The trade line's slot and size, holding the address they tried. */}
            <p
              className="font-ui font-medium uppercase leading-none tracking-[0.16em] text-ink"
              style={{ fontSize: "min(clamp(0.875rem, 0.625rem + 1.06vw, 1.625rem), calc(100cqw / 23))" }}
            >
              <span id="nf-addr" className="nf-addr" suppressHydrationWarning>
                jeremy.ee
              </span>
            </p>
            <script dangerouslySetInnerHTML={{ __html: address }} />
            <div aria-hidden className="hero-rule mt-3.5" />
            <p
              className="mt-4.5 self-end font-ui uppercase leading-none tracking-[0.14em] text-ink"
              style={{ fontSize: "clamp(0.75rem, 0.6rem + 0.5vw, 1rem)" }}
            >
              Page not found
            </p>
            <h1 className="nf-num mt-auto font-display font-extrabold uppercase">
              404
              <span
                aria-hidden
                className="mark-r ml-[0.06em] inline-block size-[0.13em] bg-accent align-baseline"
              />
            </h1>
          </div>

          {/* Under the number on a phone; the hero CTA's corner once the screen is wide enough. One
              phrase a line, so the rag is set rather than left to the measure. */}
          <div className="nf-out">
            <p className="font-ui uppercase text-ink">
              <span>This page does not exist.</span> <span>It may have moved,</span>{" "}
              <span>or the link has a typo.</span>
            </p>
            {/* A full load, not <Link>: Header binds its section and ground probes once at mount,
                and a client hop from here would leave them bound to this page's none. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="nf-btn rounded-box bg-ink font-ui uppercase tracking-[0.2em] text-accent transition-[translate,background-color,color] duration-150 hover:-translate-y-0.5 hover:bg-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Back home
            </a>
          </div>

          <p
            className="hero-meta-v nf-meta hidden font-ui uppercase text-ink sm:block"
            style={{ fontSize: "clamp(0.75rem, 0.6rem + 0.5vw, 1rem)" }}
          >
            Error 404
          </p>
        </div>
      </section>
    </main>
  );
}
