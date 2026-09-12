import { CONFIDENCE_THRESHOLD } from "../config";

export function Bento() {
  return (
    <section className="wrap bento reveal">
      <article className="card" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="eyebrow">Never guesses</p>
        <h3>A confidence gate on every reply.</h3>
        <p>Below {CONFIDENCE_THRESHOLD} it stops and hands over. Above it, the answer carries the source it came from.</p>
        <div className="gate">
          <i style={{ "--w": "55%" } as React.CSSProperties} />
          <b />
        </div>
        <div className="gate-key">
          <span>ANSWERS</span>
          <span data-count={CONFIDENCE_THRESHOLD} data-dec="2">
            {CONFIDENCE_THRESHOLD}
          </span>
        </div>
      </article>

      <article className="card" style={{ "--i": 1 } as React.CSSProperties}>
        <p className="eyebrow">Always an exit</p>
        <h3>The handoff carries the whole thread.</h3>
        <p>Whoever picks it up sees what was asked, what Nexo read, and why it stopped.</p>
        <div className="claimed">
          <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
            P
          </span>
          Priya claimed this 4 minutes later
        </div>
      </article>

      <article className="card" style={{ "--i": 2 } as React.CSSProperties}>
        <p className="eyebrow">Gets smarter</p>
        <h3>Every handoff is a gap you can close.</h3>
        <p>Nexo groups what it could not answer and names the source it should have lived in.</p>
        <div className="gaplist">
          <div>
            <span className="tally" data-count="9">
              9
            </span>
            Refund policy on annual plans
          </div>
          <div>
            <span className="tally" data-count="6">
              6
            </span>
            SAML and SCIM provisioning
          </div>
          <div className="closed">
            <span className="tally done">0</span>
            Trial length &middot; closed
          </div>
        </div>
      </article>
    </section>
  );
}
