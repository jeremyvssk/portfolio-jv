# Skills index

**Read when:** unsure which skill fits, or two seem to compete. The root CLAUDE.md has the
fast tie-breakers; this is the full map. Reflects the skills actually installed in this
project. If a skill isn't listed here, it isn't installed, so don't go looking for it.

## In scope: use these

### Design process (the spine)
- `grill-me`, `design-brief`, `information-architecture`, `design-tokens`, `brief-to-tasks`,
  `design-review`: the brief → IA → tokens → build → review phases.
- `design-flow`: orchestrator that runs the phases above in order.
- **Use for:** any new page/feature, IA, the full design sequence.

### Taste / visual direction
- `frontend-design` (Anthropic): the look authority; anti-slop direction; proposes 2-3
  distinct directions. **Wins ties on "the look" and on "give me options."**
- `modern-web-design`: trend/pattern reference (micro-interactions, scrollytelling, etc.).
- **Use for:** committing to an aesthetic, breaking generic patterns, sourcing patterns.

### Components (pre-built)
- `animated-component-libraries`: Magic UI + React Bits (Tailwind/Motion components).
- **Use for:** reaching for a ready-made animated component instead of hand-rolling one.

### Correctness / accessibility / prose
- `web-design-guidelines` (Vercel): the review pass before "done", covering semantics, ARIA,
  contrast, focus, keyboard.
- `writing-guidelines`: voice/tone/clarity pass on any UI copy or docs.

### Animation / motion (web)
- `motion-framer` → component/gesture/layout/micro-interaction/page transitions.
- `gsap-scrolltrigger` → scroll-driven, pinning, scrubbed timelines.
- `vercel-react-view-transitions` → route/shared-element transitions via the View Transition API.
- `emil-design-eng` → the feel pass on something built: whether it should animate at all,
  easing and duration, press and hover feedback, interruptibility. Reviews, never picks a look.
- Lighter helpers: `animejs`, `lottie-animations`, `react-spring-physics`,
  `scroll-reveal-libraries` (AOS). **Prefer Motion/GSAP first**; reach for these only for a
  specific need (SVG morph, AE-exported JSON, spring physics, simple fade-on-scroll).

### Stack / frontend (React + Next.js)
- `vercel-react-best-practices` → performance patterns, data fetching, bundle.
- `vercel-composition-patterns` → compound components, render props, context (React 19).
- `vercel-optimize` → Vercel cost/perf optimization on a deployed app.
- **Use for:** implementation patterns, App Router, component architecture.

### Deploy
- `deploy-to-vercel` → push live / preview deployments.
- `vercel-cli-with-tokens` → token-based Vercel CLI (non-interactive auth, env vars).

### Meta
- `skill-creator` → author or edit a skill. Use only when building/maintaining skills.

## Pruned: do not look for these
The 3D/WebGL, asset-authoring, mobile, and heavy-scroll skills were **removed** from this
project (they're banned in the root CLAUDE.md "Out of scope" list). If a task genuinely needs
3D or native, ask before reinstalling, and don't try to invoke a skill that isn't here.
