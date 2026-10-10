/**
 * Every answer here is checkable against the product or the pricing page. An
 * FAQ is the easiest place on a marketing site to drift into claims nobody
 * verified, so anything that would need a feature we have not built is left
 * out rather than softened. Where the data lives is not answered here until
 * the platform runs somewhere a reader could check.
 */
const ITEMS = [
  {
    q: "What happens when Nexo doesn't know the answer?",
    a: "It says so instead of guessing, and passes the chat to a person on your team. They see the whole conversation, so your customer doesn't have to explain it again.",
  },
  {
    q: "Where do Nexo's answers come from?",
    a: "From the help pages and PDFs you give it, and it points to the one it used. If they don't cover a question, Nexo hands the chat to your team rather than making something up.",
  },
  {
    q: "Do I have to talk to sales?",
    a: "No. Prices are public, plans start at C$249 a month, and every plan includes every feature. Plans differ in how many chats they cover, and Essentials answers from up to 2 sources.",
  },
  {
    q: "What if we get more chats than our plan covers?",
    a: "Nexo keeps answering past your monthly number and tells you. If a month reaches twice your plan, new chats go to your own team instead of Nexo, so no customer is turned away, and chats already under way carry on. It resets at the start of the next month, or when you move up a plan.",
  },
  {
    q: "What counts as a resolved chat?",
    a: "A chat counts as resolved by Nexo only when it was marked resolved, Nexo never passed it to a person, and nobody on your team wrote to the customer. A customer going quiet after an answer is not counted, and if they come back within three days the chat reopens and stops counting.",
  },
  {
    q: "Does it work with the tools we already use?",
    a: "Yes. When Nexo hands a chat to your team, it can also send it to your helpdesk or other tools through Zapier or Make, or straight to your own system.",
  },
];

export function Faq({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="wrap faq reveal" id="faq">
      <div className="faq-head" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="eyebrow">FAQ</p>
        <h2>Questions, before you ask.</h2>
        <p>Something we haven't covered? Ask us, and a person answers.</p>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onOpenTrial}>
          Talk to us
        </button>
      </div>
      <div className="faq-list" style={{ "--i": 1 } as React.CSSProperties}>
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
