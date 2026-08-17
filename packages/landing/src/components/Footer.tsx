import { ONBOARDING_URL } from "../config";

/**
 * The mockup's footer carried four link columns, a newsletter form, social
 * icons and four compliance badges. Everything here resolves to something that
 * exists; the rest is left out rather than rendered as a dead link.
 *
 * Specifically not shipped, and why:
 *   Docs, Changelog, Status, API, About, Careers  — no such pages
 *   Privacy, Terms, DPA                           — these need real documents,
 *                                                   and a footer link is not
 *                                                   the place to promise one
 *   PIPEDA-aligned, GDPR-ready, SOC 2 in progress — compliance claims with
 *                                                   nothing behind them yet
 *   newsletter signup                             — no list and no backend, so
 *                                                   the form would discard what
 *                                                   anyone typed into it
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#platform" },
      { label: "Escalation", href: "#platform" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Philosophy", href: "#product" },
      { label: "Questions", href: "#faq" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="l-logo">Nexo</div>
            <p>
              The resolution system for growing support teams. AI answers, human handoff, one
              product.
            </p>
            <a className="btn btn-primary" href={ONBOARDING_URL}>
              Start free trial
            </a>
          </div>
          {COLUMNS.map((column) => (
            <div className="footer-col" key={column.heading}>
              <h4>{column.heading}</h4>
              {column.links.map((link) => (
                <a href={link.href} key={link.label}>
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <div className="badges">
            <span className="badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
              </svg>
              Canadian data residency
            </span>
          </div>
          <span className="copyright">
            © 2026 Nexo · <span className="maple">Designed and hosted in Canada</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
