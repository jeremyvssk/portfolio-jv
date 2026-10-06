// Shared Playwright loader for the probes. playwright-core is NOT a dependency (see the stack table
// in CLAUDE.md). It is resolved out of the npx cache, so the probes stay dev tools rather than
// something the site ships. Set PLAYWRIGHT_CORE to point at it directly if the cache lookup misses.
import { readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The cache can hold several playwright-core versions and only some have a browser downloaded, so
 *  the one to take is the first whose Firefox actually exists on disk, not the first found. */
export async function loadPlaywright() {
  const cache = join(homedir(), ".npm", "_npx");
  const candidates = process.env.PLAYWRIGHT_CORE
    ? [process.env.PLAYWRIGHT_CORE]
    : existsSync(cache)
      ? readdirSync(cache).map((d) => join(cache, d, "node_modules", "playwright-core", "index.js"))
      : [];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const mod = (await import(path)).default;
    try {
      if (existsSync(mod.firefox.executablePath())) return mod;
    } catch {
      // no browser registered for this build; try the next
    }
  }
  return null;
}

/**
 * The browser to probe in. Chromium is driven through an INSTALLED Chromium browser
 * (`CHROMIUM_PATH`, default Brave) rather than a downloaded build: playwright-core speaks CDP to any.
 * Firefox follows the desktop's reduced-motion setting, so it may run the static page.
 *
 * HEADLESS HAS NO GPU: it rasterizes on the CPU, so frame-time numbers must come from
 * `headed: true`. Headless is for pixels and DOM checks.
 */
export function browserFor(pw, engine, headed = false) {
  if (engine !== "chromium") return { type: pw.firefox, opts: { headless: !headed } };
  return {
    type: pw.chromium,
    opts: {
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/brave",
      headless: !headed,
      // A fresh profile: the everyday one would fight the running browser and add its extensions.
      args: headed ? ["--window-position=0,0"] : [],
    },
  };
}

/** Every probe needs the same thing when it cannot find one, so the exit lives here too. */
export async function firefoxOrExit() {
  const pw = await loadPlaywright();
  if (!pw) {
    console.error("No playwright-core with a downloaded Firefox found. Set PLAYWRIGHT_CORE, or run `npx playwright install firefox`.");
    process.exit(2);
  }
  return pw;
}
