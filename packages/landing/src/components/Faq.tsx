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
    a: "No. Pricing is public, plans start at C$249 a month, there is no enterprise floor, and you start a trial yourself. Every plan includes the whole product; the price only reflects volume.",
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
  return (
    <section className="wrap faq reveal" id="faq">
      <div className="faq-head" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="eyebrow">FAQ</p>
        <h2>Questions, before you ask.</h2>
      </div>
      <div style={{ "--i": 1 } as React.CSSProperties}>
        {ITEMS.map((item, i) => (
          <details key={item.q} open={i === 0}>
            <summary>
              {item.q}
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 4.5 6 8.5l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
