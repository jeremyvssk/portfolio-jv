# Animations & motion

**Read when:** the task mentions animate, motion, transition, hover, scroll effect, micro-
interaction, page transition, reveal, or "make it feel alive."

## First: should this move at all?

Motion is UX, not decoration. Animate to communicate: state change, spatial continuity,
hierarchy, feedback. If it doesn't clarify or guide, don't add it. When in doubt, propose the
motion idea and let me approve before implementing (Learning Mode applies).

## Skill routing

- **`motion-framer`** → component state, gesture (hover/tap/drag), layout animations,
  enter/exit (`AnimatePresence`), page transitions, micro-interactions. Default for React UI.
- **`gsap-scrolltrigger`** → scroll-driven sequences, pinning, horizontal scroll, scrubbed
  timelines, complex choreography.
- **Combine:** Motion for state/gesture, GSAP for the scroll timeline. Don't use both on the
  same element for the same property.

## Next.js notes

- Animation components are client components: start the file with `"use client"`.
- Keep motion logic out of server components; wrap only the interactive leaf.
- GSAP in React: use `useGSAP()` for setup + automatic cleanup (prevents leaks on unmount).

## Defaults (don't invent values that fight these)

| Element | Duration | Easing |
|---|---|---|
| Micro (button, toggle, icon) | 100-150 ms | ease-out |
| Standard (cards, reveals, tooltips) | 200-300 ms | ease-out entering, ease-in leaving |
| Large (modals, page/route transitions) | 300-500 ms | ease-in-out or spring |

- **Enter = ease-out** (decelerate in), **exit = ease-in** (accelerate out).
- Springs for anything that should feel physical; tune `stiffness`/`damping`, don't leave
  default bounce on serious UI.
- **Performance:** animate `transform` and `opacity` only. Never animate `width`, `height`,
  `top`, `left`, `margin` (layout thrash). Use `will-change` sparingly.
- **Accessibility:** always honor `prefers-reduced-motion`, and reduce or remove non-essential
  motion, keep essential feedback. Build this into every animated component, not as an
  afterthought.

## Motion personality (match the product, not a reflex)

Portfolio/editorial → confident, smooth, a little expressive. Marketing → snappy, attention-
guiding. Anything transactional → controlled, fast, no gratuitous bounce. State the intended
personality when proposing motion so it reads as deliberate.

## "When motion feels wrong" → fixes

- "Sluggish" → cut duration 30-50%.
- "Janky" → you're animating a layout property; switch to transform/opacity.
- "Robotic" → switch to a spring.
- "Too much" → remove the non-essential ones; motion should be felt, not noticed.
