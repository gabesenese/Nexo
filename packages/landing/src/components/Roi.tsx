import { COMPARISON_CHECKED, PLAN_ROWS, formatCad } from "../pricing";

export function Roi() {
  return (
    <section className="roi">
      <div className="wrap reveal">
        <div className="roi-head" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <p className="eyebrow">What this replaces</p>
            <h2>Your bill does not grow when the AI gets better.</h2>
          </div>
          <p>
            Incumbents charge per resolution, so the bill climbs exactly when the AI starts working. Nexo is flat rate,
            at every volume.
          </p>
        </div>

        <div className="roi-grid" style={{ "--i": 1 } as React.CSSProperties}>
          {PLAN_ROWS.map((row) => (
            <article className="card" key={row.name}>
              <p className="mono" style={{ fontSize: "10.5px", color: "var(--ink-4)", letterSpacing: "0.08em" }}>
                {row.conversations.toLocaleString("en-CA")} / MONTH
              </p>
              <div className="price" data-count={row.price} data-pre="C$">
                {formatCad(row.price)}
              </div>
              <p className="was">{formatCad(row.intercom)} with Intercom</p>
              <div className="meter">
                <i style={{ "--w": row.share } as React.CSSProperties} />
              </div>
              <p className="keep">
                You keep{" "}
                <span data-count={row.keep} data-pre="C$">
                  {formatCad(row.keep)}
                </span>{" "}
                a month
              </p>
            </article>
          ))}
        </div>

        <p className="roi-note" style={{ "--i": 2 } as React.CSSProperties}>
          Intercom publishes Fin at $0.99 USD per resolution ({COMPARISON_CHECKED}). The figures above apply that rate
          at a 50% resolution rate and convert at 1.39 CAD to the dollar. They exclude Intercom&rsquo;s per-seat fees of
          $29 to $132 per seat per month, so a team on their helpdesk pays more than shown, not less. Our own demo
          corpus resolves 66% without a person. Once you are live, the Impact page shows the same arithmetic on your own
          conversations.
        </p>
      </div>
    </section>
  );
}
