import { useEffect, useRef, useState } from "react";
import { ONBOARDING_URL, SIGN_IN_URL } from "../config";
import { Mark } from "./Mark";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function Nav({ onOpenTrial }: { onOpenTrial: () => void }) {
  const [theme, setTheme] = useState(currentTheme);

  const mounted = useRef(false);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      root.setAttribute("data-theme", theme);
      try {
        localStorage.setItem("nexo-theme", theme);
      } catch {
        /* private browsing refuses storage, and the choice is not worth failing over */
      }
    };

    if (!mounted.current) {
      mounted.current = true;
      apply();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }

    root.classList.add("theme-shifting");
    /* The transition has to be committed before the colours change, or the
       browser computes both in one pass and skips straight to the end. */
    void root.offsetHeight;
    apply();

    const done = window.setTimeout(() => root.classList.remove("theme-shifting"), 450);
    return () => window.clearTimeout(done);
  }, [theme]);

  return (
    <header className="navbar">
      <div className="wrap">
        <nav className="navbar-inner">
          <a className="brand" href="#top">
            <Mark />
            Nexo
          </a>
          <div className="navlinks">
            <a href="#product">Product</a>
            <a href="#escalation">Escalation</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="navright">
            <button
              className="theme-toggle"
              type="button"
              aria-label={theme === "light" ? "Switch to dark" : "Switch to light"}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <svg className="sun" width="15" height="15" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M6 1v1.2M6 9.8V11M1 6h1.2M9.8 6H11M2.5 2.5l.85.85M8.65 8.65l.85.85M9.5 2.5l-.85.85M3.35 8.65l-.85.85"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              <svg className="moon" width="15" height="15" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M10 7.2A4.4 4.4 0 0 1 4.8 2 4.5 4.5 0 1 0 10 7.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="nav-talk" type="button" onClick={onOpenTrial}>
              Talk to us
            </button>
            <a className="nav-signin" href={SIGN_IN_URL}>
              Sign in
            </a>
            <a className="btn btn-primary btn-sm" href={ONBOARDING_URL}>
              Start free
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
