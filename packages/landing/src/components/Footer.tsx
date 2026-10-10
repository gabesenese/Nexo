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
      { label: "See it work", href: "#story" },
      { label: "How it works", href: "#how" },
      { label: "Pricing", href: "#pricing" },
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
              Nexo answers your customers from your own help pages, and hands the rest to your team.
            </p>
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
        {/** Residency and hosting claims return once the platform runs somewhere a reader could check them. */}
        <div className="fbot">
          <span>&copy; 2026 Nexo</span>
          <span>Every answer has an exit.</span>
        </div>
      </div>
    </footer>
  );
}
