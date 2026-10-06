# Design process

**Read when:** designing a new page/section/layout, deciding information architecture,
answering "where should X go", or running a design critique/review.

This extends Learning Mode (root CLAUDE.md). Same loop, design lens: I state intent and sketch
→ you propose 2-3 directions + red-team them → I predict/pick → you build → we review → one-
line retro. Don't hand me a finished design; hand me options to choose and defend.

## Full flow vs. lightweight

- **New page / new feature / unclear requirements** → run `/design-flow`:
  Grill Me → Design Brief → Information Architecture → Design Tokens → Brief to Tasks →
  Frontend Design → (Design Review, run separately). It asks upfront which phases to skip.
- **Contained change** (restyle a section, tweak a component, add one element) → skip the
  ceremony. Propose 2-3 inline, confirm placement, build, offer a quick review.
- **Pure polish** → go straight to `frontend-design` (taste) + the design system.

Don't force the heavy flow on small work; don't skip it on a brand-new page.

## Skills for this domain

- `/design-flow`: process spine; brief → IA → tokens → tasks; `/design-review`.
- `frontend-design` (Anthropic): taste authority; commits to a specific direction, breaks
  generic patterns. Decides *the look*, and is also where **options** come from.
- `modern-web-design`: pattern/trend reference when a proposal needs grounding.
- `web-design-guidelines` (Vercel): correctness gate; a11y, semantics, UX best practices.
  Run as a review pass before "done."

Tie-breaker (root): taste and options → frontend-design, process → design-flow.

## Artifacts

- Brief / IA / task list / review → `.design/<feature-slug>/`.
- Agreed tokens & visual system → mirror into `claude-docs/design-system.md` and the Tailwind
  theme so design and code share one source of truth.

## Review loop (placement correctness)

After building a page, screenshot it and run `/design-review` against the brief + design system.
The Playwright **MCP cannot work here**: it is Chrome-wired. Drive `playwright-core` from the npx
cache against **Firefox** and a **production build**, per the `firefox-for-browser-rendering`
memory. This catches misplacement, sparse layouts, and a11y gaps
before I look. Budget one or two "move this / tighten that" rounds. That iteration is the
design conversation, not a failure.

## Anti-slop checklist (quick gate before "done")

- Typography has a real point of view (not Inter/Roboto default; deliberate pairing + scale).
- Layout takes one intentional risk (asymmetry, overlap, an unexpected grid) where it serves
  the content, not decoration for its own sake.
- Color is a system with intent, not a safe neutral + one accent by reflex.
- Motion is purposeful (see `animations.md`), not sprinkled.
- Hierarchy survives a 5-second squint test.
