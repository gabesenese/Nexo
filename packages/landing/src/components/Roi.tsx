import { COMPARISON_CHECKED, PLAN_ROWS, formatCad } from "../pricing";

export function Roi() {
  return (
    <section className="roi">
      <div className="wrap reveal">
        <div className="roi-head" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <p className="eyebrow">What it costs</p>
            <h2>One flat price, not a fee for every answer.</h2>
          </div>
          <p>
            Intercom charges for every question its AI resolves, so the better it works, the more you pay. Nexo is one
            flat monthly price for your plan.
          </p>
        </div>

        <div className="roi-grid" style={{ "--i": 1 } as React.CSSProperties}>
          {PLAN_ROWS.map((row) => (
            <article className="card" key={row.name}>
              <p className="mono" style={{ fontSize: "10.5px", color: "var(--ink-4)", letterSpacing: "0.08em" }}>
                {row.conversations.toLocaleString("en-CA")} CHATS A MONTH
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
          Intercom publishes its AI agent, Fin, at US$0.99 per resolution ({COMPARISON_CHECKED}). The figures above
          assume it resolves half of your chats and convert at 1.39 Canadian dollars to the US dollar. They leave out
          Intercom&rsquo;s seat fees of US$29 to US$132 per person a month, so a team on their helpdesk pays more than
          shown, not less. Once you are live, the Impact page shows the same arithmetic on your own chats.
        </p>
      </div>
    </section>
  );
}
