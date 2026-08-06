import { useEffect, useState } from "react";

function LogoMark() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
      <path d="M6 13V7l8 6V7" stroke="#181b1d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Nav({ onOpenTrial }: { onOpenTrial: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <>
      <nav id="nav" className={`l-nav${scrolled ? " scrolled" : ""}`}>
        <div className="l-logo">
          <span className="mark">
            <LogoMark />
          </span>
          Nexo
        </div>
        <div className="l-nav-links">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href="http://localhost:5174/">Widget demo</a>
        </div>
        <div className="l-nav-cta">
          <a className="btn btn-ghost" href="http://localhost:5173/">
            Sign in
          </a>
          <button className="btn btn-primary" onClick={handleOpenTrial}>
            Start free
          </button>
        </div>
        <button
          id="hamburger"
          className="hamburger"
          aria-expanded={menuOpen}
          aria-controls="mobile-panel"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg className="icon-open" viewBox="0 0 20 20" fill="none" stroke="#181b1d" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 6h14M3 10h14M3 14h14" />
          </svg>
          <svg className="icon-close" viewBox="0 0 20 20" fill="none" stroke="#181b1d" strokeWidth="1.6" strokeLinecap="round">
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
        <a href="http://localhost:5174/" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}>
          Widget demo
        </a>
        <div className="l-nav-cta">
          <a className="btn btn-ghost" href="http://localhost:5173/" tabIndex={menuOpen ? 0 : -1}>
            Sign in
          </a>
          <button className="btn btn-primary" tabIndex={menuOpen ? 0 : -1} onClick={handleOpenTrial}>
            Start free
          </button>
        </div>
      </div>
    </>
  );
}
