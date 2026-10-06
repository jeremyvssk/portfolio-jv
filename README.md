# jeremy.ee

My portfolio site. Live at **[jeremy.ee](https://jeremy.ee)**.

I'm Jeremy Vaask, a fullstack developer and designer in Tallinn. I designed and built this
site. It is one page: a hero, About, Services, Works and Contact.

## The idea

I wanted a site that feels free. Most sites are built out of boxes: cards, panels, a grid you can
see. This one has almost none. The layout is open and minimal, and what holds it together is
alignment, type and spacing instead of containers.

That is the part I wanted to show. A complex design is easy to keep tidy when every piece sits in a
box. Without boxes, everything has to line up on its own or it looks like a mistake. I also wanted
the site to feel like me, not like a template.

## How I built it

I started in Figma. The wireframe, the overall concept and the main design were drawn there first,
then built in code.

The fine-tuning happened with Claude Code, and most of it outside the codebase. When part of the
design looked off and the fix was clear enough not to need a new drawing, Claude built a preview
page (a Claude artifact) showing the fix, or a few versions of it, with real renders of the site and
measurements. I decided there, and only the version I picked was written into the code. The trial
versions never touched the repo, so it stays clean and I know where everything is and how it works.

With no boxes, a few pixels off is visible. So the
alignment is tested: a Playwright script checks that edges meet at 13 screen widths, from a 320px
phone to a 2560px monitor. I added it after an 18px misalignment, present at every width, got past
five rounds of screenshots. Other scripts measure frame time and how scrolling feels.

The scripts did a lot of the polishing, but much of the testing was manual. I ran the site on my own
screens, and when something felt off I went through the code to find the cause and confirm it.
Some problems I spotted in the code first.

The site is made to work on any screen, from a small phone to an ultrawide monitor, and that is
checked rather than assumed.

## Stack

- Figma for the wireframe and design
- Next.js 16 (App Router) and React 19, exported as static files
- TypeScript and Tailwind CSS 4
- Motion for component animation, CSS keyframes for entrances
- Canvas 2D on Web Workers for the hero
- PHP for the contact form, hosted on Zone.ee

## Worth a look

**The hero is drawn on worker threads.** The dithered background and my portrait are painted pixel
by pixel. On the main thread that made scrolling stutter, so both canvases are handed to Web Workers
with `OffscreenCanvas`. Main thread time on the hero went from 11.4ms to 2.4ms per frame, and
dropped frames from about 12% to 0. See `src/lib/browser/field.worker.ts` and `plate.worker.ts`.

**The paint engine has no DOM.** Everything in `src/lib/hero/` runs under plain Node. That lets me
render frames offline, hash the pixels and compare them before and after a change. It is how I
checked that splitting the engine into classes changed nothing on screen.

**One number drives the hero's exit.** `src/components/HeroExit.tsx` writes a single CSS property,
`--hero-exit`, that goes from 0 to 1 as you scroll, and every part of the exit reads it. It is set
only on the 7 elements that use it, which cut style work from 1.31ms to 0.25ms per frame.

**The page does not wait for JavaScript.** Entrances are CSS keyframes, so nothing is hidden until
hydration. In a browser without `OffscreenCanvas` the hero keeps its static version instead of
moving the work back onto the main thread.

**A static site with one small server file.** The contact form posts to `public/contact.php`, about
50 lines: field limits, a honeypot for bots and a guard against header injection. There is no Node
server to keep running.

## Run it

```sh
npm ci
npm run dev      # http://localhost:3020
npm run build    # static export to out/
npm start        # serves out/ on port 3020
```

The contact form only sends from a PHP host, so it will not send locally.

The checks run against the production build, in a Firefox that Playwright drives:

```sh
npx playwright install firefox   # once
npm run build
npm run probe:serve              # serves out/ on port 3199, leave it running
npm run probe:align              # in a second terminal; also probe:frames, probe:wheel
```

`npm run deploy` builds and uploads `out/` with rsync to the server set in `.env.local`. See
`.env.example`.

## Layout

```
src/app/          the page, root layout, 404 and global CSS
src/components/   one component per file
src/lib/hero/     the paint engine, no DOM
src/lib/browser/  the canvas workers, scroll and nav glide
src/img/          images, imported so the build checks every path
public/           contact.php and the Works videos
scripts/          probes and the deploy script
claude-docs/      the reference docs Claude Code reads
```

## How I work with Claude Code

I use Claude Code as a tool with a defined job, and the setup is in this repo for anyone to read.

- **Context on demand.** `CLAUDE.md` loads every session, so it holds only behaviour rules and a
  routing table. The detail lives in `claude-docs/` (design system, code conventions, structure,
  motion, design process), and each file is read only when the task matches it. The context stays
  small and on topic.
- **One source of truth.** Design tokens are defined in `claude-docs/design-system.md` and the
  Tailwind theme. Claude uses those values and does not invent new ones.
- **Working rules.** Ask when something is unclear instead of guessing. Write the simplest code
  that solves it. Touch only what the task needs, so every changed line traces back to a request.
  Nothing is done until it has been checked.
- **The decisions are mine.** For anything new it works as a reviewer before it writes: I state the
  goal and the approach, it pokes holes in them, and I review every diff. The point is that I can
  explain and defend everything here.
- **Skills by step.** Each step (visual direction, design process, accessibility review, motion)
  has one assigned skill, with tie-break rules so two never run on the same step.
- **Guardrails.** Separate ports for my dev server and its test server, Playwright checks against a
  production build, and docs that state rules rather than history, so they stay in sync with the
  code.

## Rights

The code is here to read. The photos, design and writing are mine and are not licensed for reuse.
The tool logos in `src/img/logos/` belong to their owners and are only used to name the tools I
work with.
