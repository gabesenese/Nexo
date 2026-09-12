import { Tick } from "./Mark";

const SOURCES = [
  { name: "Help centre", meta: "1,204 chunks", state: "healthy", on: true },
  { name: "Developer docs", meta: "486 chunks", state: "healthy" },
  { name: "Billing FAQ.pdf", meta: "118 chunks", state: "healthy" },
  { name: "Terms of service", meta: "not cited in any answer yet", state: "unused" },
];

const GROUNDED = [
  "Crawl a help-centre URL or upload a PDF",
  "Hybrid retrieval, semantic and keyword together",
  "Every answer links back to what it used",
  "Nothing invented: grounded, or it hands over",
];

const CITED = [
  "The source behind every answer, named",
  "A confidence score on the reply itself",
  "Reads as a normal conversation to the customer",
];

export function Features() {
  return (
    <>
      <section className="wrap feature reveal">
        <div className="feature-copy" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="eyebrow">Grounded answers</p>
          <h2>Knows your product.</h2>
          <p>
            Point Nexo at the help centre and documentation you already maintain. It fetches, chunks and embeds them,
            then answers from that knowledge and cites the source every time.
          </p>
          <ul className="points">
            {GROUNDED.map((point) => (
              <li key={point}>
                <Tick />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="panel" style={{ "--i": 1 } as React.CSSProperties}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "15px" }}>
            <span style={{ fontSize: "14.5px", color: "var(--ink)", fontWeight: 600 }}>Sources</span>
            <span className="mono" style={{ fontSize: "10.5px", color: "var(--ink-4)" }}>
              4 indexed
            </span>
          </div>
          {SOURCES.map((source) => (
            <div className={`src${source.on ? " on" : ""}`} key={source.name}>
              <div style={{ flex: 1 }}>
                <b>{source.name}</b>
                <small>{source.meta}</small>
              </div>
              <span className={`chip ${source.state === "healthy" ? "chip-ok" : "chip-amber"}`}>{source.state}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap feature feature-flip reveal">
        <div
          className="panel"
          style={{ "--i": 0, display: "flex", flexDirection: "column", gap: "12px" } as React.CSSProperties}
        >
          <div style={{ alignSelf: "flex-start", maxWidth: "88%" }}>
            <p className="mono" style={{ fontSize: "10px", color: "var(--ink-4)", marginBottom: "5px" }}>
              MARA &middot; 9:02 AM
            </p>
            <div className="bub them" style={{ maxWidth: "none", fontSize: "13px" }}>
              How many seats does the Professional plan include?
            </div>
          </div>
          <div style={{ alignSelf: "flex-end", maxWidth: "88%" }}>
            <p className="mono" style={{ fontSize: "10px", color: "var(--ok)", marginBottom: "5px", textAlign: "right" }}>
              NEXO &middot; 9:02 AM
            </p>
            <div className="bub us" style={{ maxWidth: "none", fontSize: "13px" }}>
              Professional includes unlimited seats. The plans differ on conversation volume rather than on how many
              people you put in the workspace.
            </div>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "9px" }}
            >
              <span className="chip chip-ok" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span className="dot" />
                confident 0.86
              </span>
              <span className="chip" style={{ background: "var(--film-2)", color: "var(--ink-3)" }}>
                Billing FAQ
              </span>
            </div>
          </div>
        </div>

        <div className="feature-copy" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="eyebrow">Cited every time</p>
          <h2>Answers you can check.</h2>
          <p>
            Each reply carries the sources it was built from and the confidence behind it, so an operator can see why
            Nexo said what it said instead of taking it on trust.
          </p>
          <ul className="points">
            {CITED.map((point) => (
              <li key={point}>
                <Tick />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
