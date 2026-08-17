import { useState } from "react";

/**
 * Every answer here is checkable against the product or the pricing page. An
 * FAQ is the easiest place on a marketing site to drift into claims nobody
 * verified, so anything that would need a feature we have not built is left
 * out rather than softened.
 */
const ITEMS = [
  {
    q: "What happens when Nexo doesn't know?",
    a: "It says so and hands the conversation to a person rather than guessing. The handoff carries the whole thread, what the customer asked, and what Nexo did or didn't find, so whoever picks it up is not starting from scratch.",
  },
  {
    q: "Do I have to talk to sales?",
    a: "No. Pricing is public, plans start at C$249/mo, there is no enterprise floor, and you start a trial yourself. Every plan includes the whole product; the price only reflects volume.",
  },
  {
    q: "What does Nexo answer from?",
    a: "Sources you give it: a help-centre URL it crawls, or PDFs you upload. It answers from those and cites which one it used. It does not answer from general knowledge about the world.",
  },
  {
    q: "Where does our data live?",
    a: "Canadian data residency by default. That is a deliberate choice rather than a side effect of where a cloud region happened to be.",
  },
  {
    q: "Does it work with our helpdesk?",
    a: "Handoffs post to a signed webhook, so they reach whatever your team already uses, including through Zapier or Make. That is helpdesk-agnostic on purpose: picking one vendor to integrate with first is a decision we would rather make with a customer than guess at.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="section-head">
          <span className="l-eyebrow">FAQ</span>
          <h2>Questions, before you ask.</h2>
        </div>
        <div className="faq-wrap">
          {ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className={`faq-item${isOpen ? " open" : ""}`} key={item.q}>
                <button
                  className="faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  {item.q}
                  <span className="faq-icon" aria-hidden="true" />
                </button>
                {/**
                 * Height is set inline because the open transition needs a real
                 * pixel value to animate to, and the answers differ in length.
                 */}
                <div className="faq-a" style={{ maxHeight: isOpen ? 320 : 0 }}>
                  <div className="faq-a-inner">{item.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
