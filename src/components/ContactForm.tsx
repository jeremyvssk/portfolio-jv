"use client";
// The contact form: a hairline box of three stacked fields, each written on its own line, and Send
// in the box's corner. Posts to `/contact.php` and resolves on this page. The whole reason it is
// not a `mailto:` is that a mail client opening IS the ending.
import { useEffect, useRef, useState } from "react";

type State = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const [state, setState] = useState<State>("idle");
  // Echoed back in the confirmation: their own name and address prove the right thing went.
  const [from, setFrom] = useState({ name: "", email: "" });
  const sentRef = useRef<HTMLDivElement>(null);
  const sent = state === "sent";

  // The form goes inert under the confirmation, which drops focus off Send; land it on the answer.
  useEffect(() => {
    if (sent) sentRef.current?.focus({ preventScroll: true });
  }, [sent]);

  // A press on a row's label area focuses its field on the press, as the field itself would. Left to
  // the label, focus waits for the release: Firefox drops it if the mouse moved 3px, and a double
  // click blurs the field. Taps still get the label's own activation.
  function onRowPress(e: React.MouseEvent<HTMLFormElement>) {
    const t = e.target as HTMLElement;
    if (e.button !== 0 || t.classList.contains("cf-in")) return;
    const field = t.closest(".cf-row")?.querySelector<HTMLElement>(".cf-in");
    if (!field) return;
    e.preventDefault();
    field.focus();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/contact.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setFrom({
          name: String(body.name).trim().split(/\s+/)[0].replace(/[.,]+$/, ""),
          email: String(body.email).trim(),
        });
      }
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      {/* One grid cell for both, so the confirmation takes the form's exact box and nothing below
          it moves. A shorter box made the page jump 232px on a phone. */}
      <div className="cf-stack">
        <form
          onSubmit={onSubmit}
          onMouseDown={onRowPress}
          noValidate={false}
          inert={sent}
          data-gone={sent || undefined}
          className="cf-box rounded-box"
        >
          <p className="cf-lab">Send a message</p>
          <label className="cf-row">
            <span className="cf-ix">Name</span>
            <input
              className="cf-in"
              name="name"
              type="text"
              required
              maxLength={80}
              autoComplete="name"
              placeholder="Your name"
            />
          </label>
          <label className="cf-row">
            <span className="cf-ix">Email</span>
            <input
              className="cf-in"
              name="email"
              type="email"
              required
              maxLength={160}
              autoComplete="email"
              placeholder="your@email.com"
            />
          </label>
          <label className="cf-row">
            <span className="cf-ix">Message</span>
            <textarea
              className="cf-in cf-area"
              name="message"
              required
              maxLength={4000}
              placeholder="A project, a question, anything"
            />
          </label>

          {/* Honeypot. Off-screen rather than `display: none`, which the cruder scripts skip. Anything
              that fills it is not a person, and that is the entire spam defence: a timing gate is
              client-supplied and forgeable, so it would buy nothing this does not already. Named and
              labelled so browser autofill has nothing to match. A field autofill recognises, like
              "company", gets filled from saved details and the real message is dropped as spam. */}
          <div className="cf-hp" aria-hidden>
            <label>
              Leave this blank
              <input name="leave_blank" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="cf-foot">
            <button
              type="submit"
              disabled={state === "sending"}
              className="cf-send rounded-box bg-ink font-ui uppercase tracking-[0.2em] text-accent"
            >
              {state === "sending" ? (
                "Sending…"
              ) : (
                <>
                  Send{" "}
                  {/* Drawn, not U+2197: the latin font subsets lack it, so iOS falls back to its emoji. */}
                  <svg aria-hidden viewBox="0 0 10 10" className="inline size-[0.75em] align-[-0.05em]">
                    <path d="M2 8 8 2M3.5 2H8v4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        {sent && (
          <div ref={sentRef} tabIndex={-1} className="cf-sent">
            <p className="font-display text-[clamp(2.25rem,7vw,3.5rem)] font-extrabold uppercase leading-[0.86] tracking-[-0.02em] text-ink">
              Sent
              <span
                aria-hidden
                className="mark-r ml-[0.08em] inline-block size-[0.13em] bg-accent align-baseline"
              />
            </p>
            <p className="cf-stmt cf-reply">
              Thanks, {from.name}. I will reply to {from.email}.
            </p>
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className="cf-err">
        {state === "error"
          ? "That did not go through. Write to jvaaskj@gmail.com instead and I will still get it."
          : ""}
      </p>
    </>
  );
}
