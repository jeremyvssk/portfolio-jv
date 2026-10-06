# Project Structure

## Directory layout

```
/
├── src/
│   ├── app/                    # App Router: routes, layouts, pages, global CSS
│   │   ├── layout.tsx          # Root layout (fonts, metadata, persistent Header)
│   │   ├── page.tsx            # Home route, the whole site
│   │   ├── not-found.tsx       # The 404, exported as 404.html
│   │   ├── globals.css         # Tailwind base + design tokens (@theme) + all component CSS
│   │   ├── opengraph-image.png # Link preview, resolved absolute via metadataBase
│   │   ├── favicon.ico         # 16px "J." + 32/48px "JV." on ink, Rubik 800
│   │   └── apple-icon.png      # 180px "JV.", full-bleed (iOS applies its own mask)
│   ├── components/             # React components, one per file
│   ├── img/                    # Images imported by the bundler, NOT served from public/
│   │   └── logos/              # Brand marks for the stack wall: alpha-only WebP, used as CSS masks
│   └── lib/
│       ├── hero/               # The hero paint engine. DOM-FREE, see below
│       └── browser/            # The DOM half: Glide, and the two canvas WORKERS
├── public/                     # Copied verbatim into the export
│   ├── contact.php             # The contact send: PHP mail() on the host. The only server code
│   ├── .htaccess               # Serves 404.html for every missing address
│   └── works/                  # The Works clips (mp4, webm, hevc), served as plain files
├── scripts/
│   ├── deploy.sh               # rsync out/ to DEPLOY_TARGET from .env.local
│   ├── pw.mjs                  # Shared Playwright loader + engine/headed selection
│   ├── probe-align.mjs         # Asserts edge alignment across a width ladder
│   ├── probe-frames.mjs        # Frame time and main-thread spend, per section, per width
│   ├── probe-wheel.mjs         # What a real wheel gesture feels like: roughness, latency, coast
│   ├── check-plate-band.mjs    # Offline: the figure's partial upload covers every changed row
│   ├── check-marks.mjs         # Offline: StackWall's a/k constants still match the logo files
│   ├── check-marks-legible.mjs # Offline: each logo survives the smallest size it is drawn at
│   └── mark-set.mjs            # The logo list both mark checks read
├── claude-docs/                # AI context docs (read on demand, never all at once)
├── CLAUDE.md                   # Session behavior and routing rules
├── .env.example                # Documents .env.local (gitignored): DEPLOY_TARGET
├── package.json                # ROOT REQUIRED (npm)
├── next.config.ts              # ROOT REQUIRED, static export (`output: "export"`)
├── tsconfig.json               # ROOT REQUIRED
├── postcss.config.mjs          # ROOT REQUIRED
├── eslint.config.mjs           # ROOT REQUIRED
└── next-env.d.ts               # Auto-generated, do not edit
```

A file named `*.worker.ts` under `lib/browser/` is a **worker entry**, loaded by
`new Worker(new URL("./x.worker.ts", import.meta.url))` and never imported normally. It may import
`lib/hero` (DOM-free) but nothing that touches the document.

**`public/` holds only what cannot be imported**: the server files (`contact.php`, `.htaccess`)
and the Works clips, all copied verbatim into the export. Images live
in `src/img/` and are imported as modules (`import hero from "@/img/…"`), so the bundler hashes
them and a wrong path fails the build. Add an image by importing it.

## Static export: what cannot exist

The site is `output: "export"`, plain files on a PHP host. So: no API routes, server actions,
cookies/headers, middleware, or `next/image` optimisation; the build fails on them. Server logic
goes in PHP under `public/`. Deploy is `npm run deploy` (build, then `scripts/deploy.sh`).

## Why config files stay at root

Next.js, TypeScript, PostCSS and npm all hardcode config discovery to the project root. There
is no `config/` folder. `package.json` is the **project** root config; `src/app/` is the App
Router directory, a different concept entirely.

## `lib/hero` is DOM-free, and that is enforced

Every module under `src/lib/hero/` must run under plain `node`: no `window`, `document`,
`HTMLElement`, observers or `performance`. That is what allows the per-cell maths to be rendered
and diffed offline, which is the only way to verify a canvas here (the headless browser cannot be
trusted to hydrate; see the browser-rendering notes). Anything DOM-touching belongs in
`src/lib/browser/`.

Two consequences of running under `node` directly:

- **Relative imports inside `lib/` carry an explicit `.ts` extension.** Node's ESM resolver does
  not guess extensions. `tsconfig.json` sets `allowImportingTsExtensions` for this.
- **No TypeScript parameter properties** (`constructor(private x: T) {}`). Node's strip-only type
  removal rejects them outright. Declare the field and assign in the body.

Imports from *outside* `lib/` use the alias and no extension: `import { Field } from "@/lib/hero"`.

## `scripts/` is dev tooling, never shipped

Node scripts run by hand against a **production build on localhost** (`next dev` does not hydrate
reliably here). They import `playwright-core` out of the npx cache rather than as a dependency, so
nothing here reaches `package.json`'s `dependencies`. `npm run probe:align` is the one to start with. See
the alignment note in `frontend-conventions.md`.

## Path alias

`@/*` resolves to `src/*`. Example: `import Header from "@/components/Header"`.

## Adding new routes

`src/app/<route>/page.tsx`. Nested layouts go in `src/app/<route>/layout.tsx`. Every route ships:
the export has no environment gate, so do not add dev-only pages.

## Adding new components

Drop them in `src/components/`. Subfolders are fine for grouping. Component-specific helpers
co-locate; promote to `lib/` only when reused or when they need to be node-runnable.
