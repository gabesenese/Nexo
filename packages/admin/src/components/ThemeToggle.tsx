import { useEffect, useRef, useState } from "react";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/**
 * The same cross-fade the landing uses. A permanent transition on every element
 * would tax hover and scroll, so one is switched on for the length of the
 * change and taken off again.
 */
export function ThemeToggle() {
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

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to the ${next} theme`}
      title={`Switch to the ${next} theme`}
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 1.4v1.5M8 13.1v1.5M14.6 8h-1.5M2.9 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13.5 9.9A5.9 5.9 0 0 1 6.1 2.5a5.9 5.9 0 1 0 7.4 7.4Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
