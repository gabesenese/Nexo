const QUEUE = [
  { age: "2d 17h", tone: "hot", title: "Refund on an annual plan", meta: "unassigned · confidence 0.31", sel: true },
  { age: "6h 12m", tone: "warm", title: "SSO login loops back", meta: "Priya" },
  { age: "3h 40m", tone: "warm", title: "CSV export on Essentials", meta: "unassigned" },
  { age: "58m", tone: "", title: "Quebec data agreement", meta: "unassigned" },
  { age: "12m", tone: "", title: "Widget inside an iframe", meta: "resolved by Nexo" },
];

export function ProductPanel() {
  return (
    <section className="wrap stage" id="escalation">
      <div className="halo" aria-hidden="true" />
      <div className="shot">
        <div className="shot-bar">
          <span className="mono" style={{ fontSize: "11px", color: "var(--ink-4)", letterSpacing: "0.05em" }}>
            ACME ANALYTICS
          </span>
          <span className="dot" style={{ background: "var(--ink-4)" }} />
          <span style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>Inbox</span>
          <span className="chip chip-amber">12 waiting</span>
          <span style={{ flex: 1 }} />
          <span className="live">
            <span className="dot" />
            LIVE
          </span>
        </div>

        <div className="shot-body">
          <div className="queue">
            <div className="filters">
              <span className="on">Open 12</span>
              <span>Mine 3</span>
              <span>Escalated 5</span>
            </div>
            {QUEUE.map((row) => (
              <div className={`qrow${row.sel ? " sel" : ""}`} key={row.title}>
                <div className={`age ${row.tone}`}>{row.age}</div>
                <div>
                  <h4>{row.title}</h4>
                  <small>{row.meta}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="detail">
            <div className="detail-head">
              <h4>Refund on an annual plan cancelled early</h4>
              <div style={{ display: "flex", gap: "7px" }}>
                <span className="ghost-sm">Claim</span>
                <span className="ghost-sm ok">Resolve</span>
              </div>
            </div>

            <div className="why">
              <p className="eyebrow" style={{ marginBottom: "11px", color: "var(--ink-4)" }}>
                Why Nexo stopped
              </p>
              <dl className="why-grid">
                <dt>Confidence</dt>
                <dd className="mono" style={{ color: "var(--ember)" }}>
                  0.31 &middot; below 0.55
                </dd>
                <dt>Reason</dt>
                <dd>Refund terms differ by contract.</dd>
                <dt>Sources read</dt>
                <dd style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <span className="chip chip-ok">Billing FAQ</span>
                  <span className="chip chip-ok">Terms</span>
                </dd>
              </dl>
            </div>

            <div className="bubbles">
              <div className="bub them">
                I cancelled in March but was billed for the full year. Can I get the remaining nine months back?
              </div>
              <div className="bub us">
                Annual plans bill for the full term, but I am not certain that covers your contract, so I am bringing in
                a person.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="float float-a">
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <span className="avatar">P</span>
          <div>
            <div style={{ fontSize: "12.5px", color: "var(--ink)", fontWeight: 600 }}>Priya joined</div>
            <div style={{ fontSize: "11px", color: "var(--ink-4)" }}>from the Acme support team</div>
          </div>
        </div>
        <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.5, marginTop: "12px" }}>
          She can see the whole thread and why Nexo stopped, so the customer does not repeat themselves.
        </p>
        <p className="eyebrow" style={{ marginTop: "12px", color: "var(--ink-4)" }}>
          Customer side
        </p>
      </div>

      <div className="float float-b">
        <p className="eyebrow" style={{ color: "var(--ink-4)" }}>
          Confidence
        </p>
        <div style={{ fontSize: "34px", color: "var(--ink)", letterSpacing: "-0.04em", marginTop: "6px", fontWeight: 600 }}>
          0.31
        </div>
        <div className="meter">
          <i style={{ "--w": "31%" } as React.CSSProperties} />
        </div>
        <p style={{ fontSize: "11.5px", color: "var(--ink-4)", marginTop: "9px" }}>
          Threshold 0.55. Below it, a person takes over.
        </p>
      </div>
    </section>
  );
}
