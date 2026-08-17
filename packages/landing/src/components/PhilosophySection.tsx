/**
 * Four lines, not six. This used to state the same idea three times over:
 * the headline, then the answers/escalates pair, then an italic couplet about
 * the smartest AI. The couplet is gone because the headline already makes the
 * point and the product sections below demonstrate it, which is stronger than
 * saying it a third time.
 */
export function PhilosophySection() {
  return (
    <section className="section why" id="product">
      <div className="wrap">
        <h2>
          Customers don't care if it's AI or a human.{" "}
          <span className="accent">They care about getting an answer.</span>
        </h2>
        <div className="why-lines">
          <div className="why-line">Nexo answers when it's confident.</div>
          <div className="why-line esc">Nexo escalates when it isn't.</div>
        </div>
        <p className="why-sig">From question to resolution.</p>
      </div>
    </section>
  );
}
