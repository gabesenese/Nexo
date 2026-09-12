import { useEffect } from "react";

/**
 * The console runs the landing's reveal, but at 620ms rather than 900ms. The
 * landing is read once at a stroll; this is a tool someone drives all day, and
 * the slower curve started to feel like waiting. Easing, travel and stagger are
 * the landing's, so the two still read as one product.
 *
 * Everything is authored at its final value, so a page is correct with
 * scripting off and for anyone who asked for reduced motion. Only once both are
 * ruled out does `js-motion` go on the document.
 */
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const decimals = Number(el.dataset.dec ?? 0);
  const prefix = el.dataset.pre ?? "";
  const suffix = el.dataset.suf ?? "";
  const format = new Intl.NumberFormat("en-CA");
  const duration = 900;
  let started: number | null = null;

  const settled = decimals ? target.toFixed(decimals) : format.format(target);

  function frame(now: number) {
    if (started === null) started = now;
    const progress = Math.min((now - started) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    el.textContent =
      prefix + (decimals ? value.toFixed(decimals) : format.format(Math.round(value))) + suffix;
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.textContent = prefix + settled + suffix;
    }
  }

  el.textContent = prefix + (decimals ? (0).toFixed(decimals) : "0") + suffix;
  requestAnimationFrame(frame);
}

/**
 * Every page fetches before it renders, so the blocks to animate do not exist
 * when the route changes. A one-shot pass over the DOM found an empty page and
 * left the real content hidden. The mutation observer picks blocks up whenever
 * they actually arrive.
 */
export function useMotion(key: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    root.classList.add("js-motion");
    const seen = new Set<HTMLElement>();
    const staged = new Set<HTMLElement>();

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          const figures = entry.target.querySelectorAll<HTMLElement>("[data-count]");
          if (figures.length) {
            window.setTimeout(() => figures.forEach(countUp), 200);
          }
          reveal.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );

    const scan = () => {
      const content = document.querySelector(".content");
      if (!content) return;

      /* Top-level blocks arrive as a unit, in source order. A grid that carries
         `reveal` itself is left alone: it staggers its own children. */
      [...content.children].forEach((node, index) => {
        const el = node as HTMLElement;
        if (seen.has(el)) return;
        seen.add(el);
        if (!el.classList.contains("reveal")) {
          el.classList.add("reveal", "solo");
          el.style.setProperty("--i", String(index));
          staged.add(el);
        }
        reveal.observe(el);
      });

      content.querySelectorAll<HTMLElement>(".reveal").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        reveal.observe(el);
      });
    };

    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      reveal.disconnect();
      for (const el of seen) el.classList.remove("in");
      for (const el of staged) {
        el.classList.remove("reveal", "solo");
        el.style.removeProperty("--i");
      }
    };
  }, [key]);
}
