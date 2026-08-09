import { useEffect, useState } from "react";
import { ONBOARDING_URL, SIGN_IN_URL, WIDGET_DEMO_URL } from "../config";

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2M10 16v2M18 10h-2M4 10H2M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4M15.5 15.5l-1.4-1.4M5.9 5.9L4.5 4.5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5 7 7 0 1 0 16.5 12.3Z" />
    </svg>
  );
}

type Theme = "light" | "dark";

function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "light",
  );

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("nexo-theme", next);
    setTheme(next);
  }

  return { theme, toggle };
}

export function Nav({ onOpenTrial }: { onOpenTrial: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 860) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function handleOpenTrial() {
    setMenuOpen(false);
    onOpenTrial();
  }

  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <>
      <nav id="nav" className={`l-nav${scrolled ? " scrolled" : ""}`}>
        <div className="l-logo">Nexo</div>
        <div className="l-nav-links">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href={WIDGET_DEMO_URL}>Widget demo</a>
        </div>
        <div className="l-nav-cta">
          <button className="theme-toggle" aria-label={themeLabel} title={themeLabel} onClick={toggle}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <a className="btn btn-ghost" href={SIGN_IN_URL}>
            Sign in
          </a>
          <button className="btn btn-ghost" onClick={handleOpenTrial}>
            Talk to us
          </button>
          <a className="btn btn-primary" href={ONBOARDING_URL}>
            Start free
          </a>
        </div>
        <button
          id="hamburger"
          className="hamburger"
          aria-expanded={menuOpen}
          aria-controls="mobile-panel"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg className="icon-open" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 6h14M3 10h14M3 14h14" />
          </svg>
          <svg className="icon-close" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        </button>
      </nav>

      <div id="mobile-panel" className={`mobile-panel${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        <a href="#product" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>
          Product
        </a>
        <a href="#pricing" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>
          Pricing
        </a>
        <a href={WIDGET_DEMO_URL} tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>
          Widget demo
        </a>
        <div className="l-nav-cta">
          <button
            className="theme-toggle"
            aria-label={themeLabel}
            tabIndex={menuOpen ? 0 : -1}
            onClick={toggle}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
          <a className="btn btn-ghost" href={SIGN_IN_URL} tabIndex={menuOpen ? 0 : -1}>
            Sign in
          </a>
          <button className="btn btn-ghost" tabIndex={menuOpen ? 0 : -1} onClick={handleOpenTrial}>
            Talk to us
          </button>
          <a className="btn btn-primary" href={ONBOARDING_URL} tabIndex={menuOpen ? 0 : -1}>
            Start free
          </a>
        </div>
      </div>
    </>
  );
}
