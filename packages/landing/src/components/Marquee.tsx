/**
 * Everything named here is something Nexo actually connects to today: PDFs and
 * a help-centre URL as sources, the embeddable widget, the signed webhook that
 * carries a handoff to whatever helpdesk a team already uses, and SMTP email
 * alerts. Nothing on the roadmap belongs in this strip, because a scrolling
 * list reads as a list of things that work.
 *
 * The track is rendered twice so the loop has an identical second copy to
 * translate onto; the animation moves exactly -50%, which lands the copy where
 * the original started and makes the wrap invisible.
 */
const ITEMS = [
  { label: "PDF docs", path: "M7 3h7l4 4v14H7z M14 3v4h4" },
  { label: "Your website", path: "M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" },
  { label: "Webhook handoff", path: "M4 12a4 4 0 0 1 8 0 4 4 0 0 0 8 0" },
  { label: "Embeddable widget", path: "M8 4l-4 8 4 8M16 4l4 8-4 8" },
  { label: "Email alerts", path: "M3 6h18v12H3zM3 7l9 6 9-6" },
  { label: "Your helpdesk", path: "M4 4h16v12H4zM8 20h8" },
];

export function Marquee() {
  return (
    <section className="marquee-sec">
      <div className="wrap">
        <div className="marquee-label">Connects to what you already have</div>
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((pass) =>
              ITEMS.map((item) => (
                <span className="marquee-item" key={`${pass}-${item.label}`} aria-hidden={pass === 1}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d={item.path} />
                  </svg>
                  {item.label}
                </span>
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
