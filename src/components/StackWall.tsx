// StackWall: the logo wall inside Services row 05, and the four-mark preview on its closed trigger.
//
// Every logo is a CSS MASK, not an image: a box painted in `currentColor` with the brand's alpha
// punched through it. So a red logo, a black logo and a gradient logo all arrive as the page's own
// ink, inherit the row's colour crossfade, and pass contrast wherever the text does.
//
// Two numbers ship with each mark, both measured off the file on disk:
//   a:  the trimmed aspect ratio.
//   k:  the size of the mark's LONGEST edge, 1.105 * min(1, (pi/4 / silhouette coverage) ^ 0.394).
//       Read it as a KEYLINE: every mark is contained in one square, and the coverage term can only
//       pull a mark INSIDE that square, never push it past.
//       Coverage is measured on the SILHOUETTE (the alpha with its holes flooded shut) and not on
//       the ink, because a ring reads exactly as large as the disc it encloses. Ink is what drew
//       WordPress 4% wider than Next.js: two circles of one diameter, and the hollow one collected a
//       bonus for being hollow. Both constants fall out of the silhouette reading. pi/4 is a disc's
//       share of its own box, so a disc is drawn at the full keyline and only a mark FULLER than a
//       disc is pulled in; 0.394 puts a filled square (coverage 1) at 1/1.10 of that disc, which is
//       the classic optical correction for round against square.
//       Marks are FLUSH START in that square, never centred, because the wall's first column shares
//       its left edge with every other Services row's body copy, so a centred mark would inset the
//       whole section's spine by a different amount on every line.
// Spring is the one mark redrawn heavier than its own artwork: the phone draws these at 23px, where
// the hairline outside its disc lands on partial alpha and the rim tears open. Thickening is a last
// resort, not the first move. React was thickened too and read as a smudge at every size above the
// phone, which is worse than the defect. It ships at its own weight again.
import type { CSSProperties } from "react";

import claudecode from "@/img/logos/claudecode.webp";
import docker from "@/img/logos/docker.webp";
import figma from "@/img/logos/figma.webp";
import java from "@/img/logos/java.webp";
import js from "@/img/logos/js.webp";
import linux from "@/img/logos/linux.webp";
import nextjs from "@/img/logos/nextjs.webp";
import postgres from "@/img/logos/postgres.webp";
import react from "@/img/logos/react.webp";
import spring from "@/img/logos/spring.webp";
import supabase from "@/img/logos/supabase.webp";
import ts from "@/img/logos/ts.webp";
import vscode from "@/img/logos/vscode.webp";
import wordpress from "@/img/logos/wordpress.webp";

type Brand = {
  name: string;
  src: string;
  a: number;
  k: number;
};

// Ordered by what I reach for first, so reading it left to right is a ranking. Append with care.
const GROUPS: { label: string; brands: Brand[] }[] = [
  {
    label: "Languages & frameworks",
    brands: [
      { name: "TypeScript", src: ts.src, a: 1.000, k: 1.005 },
      { name: "JavaScript", src: js.src, a: 1.000, k: 1.005 },
      { name: "Java", src: java.src, a: 0.723, k: 1.105 },
      { name: "Spring", src: spring.src, a: 1.000, k: 1.084 },
      { name: "React", src: react.src, a: 1.123, k: 1.105 },
      { name: "Next.js", src: nextjs.src, a: 1.000, k: 1.102 },
    ],
  },
  {
    // Short on purpose. Docker sits in "Tools I use" because it stands my local environment up
    // rather than orchestrating anything a client receives, and Supabase is a backend platform,
    // not only a store, so the label still holds at two. Nothing is padded in to fill the row.
    label: "Data & infrastructure",
    brands: [
      { name: "PostgreSQL", src: postgres.src, a: 0.973, k: 1.105 },
      { name: "Supabase", src: supabase.src, a: 0.977, k: 1.105 },
    ],
  },
  {
    // Three pairs (the machine, where code is written and inspected, then the visual work), which
    // is what the phone's two columns read as. At three they are a ranking and nothing else.
    label: "Tools I use",
    brands: [
      { name: "Linux", src: linux.src, a: 0.828, k: 1.105 },
      { name: "Docker", src: docker.src, a: 1.422, k: 1.105 },
      { name: "Claude Code", src: claudecode.src, a: 1.600, k: 1.105 },
      { name: "VS Code", src: vscode.src, a: 1.000, k: 1.105 },
      { name: "Figma", src: figma.src, a: 0.695, k: 1.105 },
      { name: "WordPress", src: wordpress.src, a: 1.000, k: 1.100 },
    ],
  },
];

// Four, not fourteen: a preview that shows everything removes the reason to open the row. Which
// four is not free, though: the peek takes 0.62 of `--logo`, so at 768-1440 on a 1x screen these
// are drawn at 21px, the smallest box on the page. Only marks that survive there can sit here, and
// `check:legible` is what says which. Java was in this list and lost 67% of itself there, its steam
// being finer than a device pixel; React is no better and is the clearest case of why: its orbits
// measure 0.97 device px at 21px and 1.05 at 23px, so the same mark holds on one screen and breaks
// on the next. Only marks whose thinnest stroke clears a device pixel at 21px can sit here. These
// four do, and they sample the row in order: language, framework, design, tool.
const PEEK = ["TypeScript", "Next.js", "Figma", "Claude Code"];

const ALL = GROUPS.flatMap((g) => g.brands);

function Mark({ brand }: { brand: Brand }) {
  return (
    <span
      aria-hidden
      className="mk"
      style={{ "--a": brand.a, "--k": brand.k, "--mask": `url(${brand.src})` } as CSSProperties}
    />
  );
}

export function StackWall() {
  return (
    <div className="stk">
      {GROUPS.map((g) => (
        <div key={g.label} className="stk-grp">
          <p className="stk-lbl font-ui text-xs uppercase tracking-[0.2em] text-ink-soft">{g.label}</p>
          <div className="stk-row">
            {g.brands.map((b) => (
              <span key={b.name} className="bdg">
                <span className="bdg-m">
                  <Mark brand={b} />
                </span>
                <span className="bdg-n font-ui text-ink-near">{b.name}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sits inside the closed row's trigger. Decorative: the panel below carries the names. */
export function StackPeek() {
  return (
    <span aria-hidden className="stk-peek min-w-0 flex-1 text-ink-soft">
      {PEEK.map((n) => {
        const b = ALL.find((x) => x.name === n);
        return b ? <Mark key={n} brand={b} /> : null;
      })}
    </span>
  );
}
