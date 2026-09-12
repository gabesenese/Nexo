import { ONBOARDING_URL } from "../config";
import { Mark } from "./Mark";

/**
 * Everything here resolves to something that exists. Specifically not shipped,
 * and why:
 *   Docs, Changelog, Status, API, About, Careers  — no such pages
 *   Privacy, Terms, DPA                           — these need real documents,
 *                                                   and a footer link is not
 *                                                   the place to promise one
 *   compliance badges                             — claims with nothing behind
 *                                                   them yet
 *   newsletter signup                             — no list and no backend
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#escalation" },
      { label: "Escalation", href: "#escalation" },
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
    <footer className="foot">
      <div className="wrap">
        <div className="foot-top">
          <div className="foot-brand">
            <div className="brand">
              <Mark />
              Nexo
            </div>
            <p>
              The resolution system for SaaS support teams of two to twenty. AI answers, human handoff, one product.
            </p>
            <a className="btn btn-outline" href={ONBOARDING_URL}>
              Start free trial
            </a>
          </div>
          <div className="fcols">
            {COLUMNS.map((column) => (
              <div className="fcol" key={column.heading}>
                <p className="eyebrow" style={{ color: "var(--ink-4)" }}>
                  {column.heading}
                </p>
                {column.links.map((link) => (
                  <a href={link.href} key={link.label}>
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="fbot">
          <span className="residency">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"
                stroke="var(--ok-fill)"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Canadian data residency
          </span>
          <span>&copy; 2026 Nexo &middot; Designed and hosted in Canada</span>
        </div>
      </div>
    </footer>
  );
}
