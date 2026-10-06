// Where a section has to sit when the page is told to go to it. Its own module rather than a
// function in Header.tsx: the rule is the page's, not the bar's, and anything that scrolls the
// document on purpose has to read the same one or two routes land in different places.

/** A section's INK box: its border box less its own padding, in document coordinates. What gets
 *  framed is type, not whitespace that happens to sit inside the box. */
export function inkBox(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const padT = parseFloat(cs.paddingTop) || 0;
  const padB = parseFloat(cs.paddingBottom) || 0;
  const box = el.getBoundingClientRect();
  return {
    top: box.top + window.scrollY + padT,
    height: box.height - padT - padB,
    clear: (parseFloat(cs.scrollMarginTop) || 0) + padT,
  };
}

/**
 * Where a nav click has to leave the page. What gets framed is the section's INK box (its border
 * box less its own padding), so the landing is decided by type rather than by whitespace that
 * happens to sit inside the box, and one rule covers sections of very different heights.
 *
 * Three cases, by how much of the section can be on screen at once, and the last two are what
 * `scroll-margin` can never express, since it only ever states a top edge.
 *
 *  1. FITS UNDER THE NAV -> centred in that space. Top-aligning a short section leaves all its slack
 *     at the foot, which is how About at 1440 ran out of ink 194px early and handed the reader the
 *     WORKS heading.
 *  2. FITS ON SCREEN but not under the nav -> aligned by its LAST line. It borrows the nav's
 *     clearance rather than cutting its own tail: Services is 800px of ink in 768px of room, and
 *     top-aligning it cut row (06) for the sake of whitespace nobody reads.
 *  3. TALLER THAN THE SCREEN -> its first line, and the only clearance it gets is the bar it has to
 *     clear. Nothing can show it whole, so you start at the beginning, but the generous gap is
 *     tuned for a section that fits, and here every pixel of it costs a pixel of content at the far
 *     end. On a 393x851 phone that is the difference between the contact card landing inside the
 *     fold and being cut 39px short of it.
 *
 * Every number is read off the DOM. `clear` is where a top-aligned section already put its ink, so
 * the tuned nav gap is reused rather than re-picked; `bar` is the nav row's own height; `tail` is
 * `clear`'s opposite number at the foot, in rem so it tracks the fluid root like the rest of page.
 */
export function landing(el: HTMLElement) {
  const ink = inkBox(el);
  const vh = window.innerHeight;
  const bar = document.querySelector(".nav-row")?.getBoundingClientRect().bottom ?? 0;
  const tail = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.5;
  const room = vh - ink.clear - tail;
  const target =
    ink.height <= room
      ? ink.top - ink.clear - (room - ink.height) / 2
      : ink.height <= vh - tail
        ? ink.top + ink.height + tail - vh
        : ink.top - bar;
  const max = document.documentElement.scrollHeight - vh;
  return Math.min(Math.max(target, 0), max);
}
