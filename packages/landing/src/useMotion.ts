import { useEffect } from "react";

/**
 * Everything is authored at its final value, so the page reads correctly with
 * scripting off and for anyone who has asked for reduced motion. Only once
 * both of those are ruled out does `js-motion` go on the document and the
 * hidden-then-revealed states apply.
 */
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const decimals = Number(el.dataset.dec ?? 0);
  const prefix = el.dataset.pre ?? "";
  const format = new Intl.NumberFormat("en-CA");
  const duration = 1150;
  let started: number | null = null;

  const settled = decimals ? target.toFixed(decimals) : format.format(target);

  function frame(now: number) {
    if (started === null) started = now;
    const progress = Math.min((now - started) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    el.textContent = prefix + (decimals ? value.toFixed(decimals) : format.format(Math.round(value)));
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.textContent = prefix + settled;
    }
  }

  el.textContent = prefix + (decimals ? (0).toFixed(decimals) : "0");
  requestAnimationFrame(frame);
}

export function useMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const navbar = document.querySelector(".navbar");
    const mobileCta = document.getElementById("mobile-cta");
    const hero = document.querySelector(".hero");

    const onScroll = () => {
      navbar?.classList.toggle("is-stuck", window.scrollY > 40);
      if (hero && mobileCta) {
        const past = hero.getBoundingClientRect().bottom < 0;
        mobileCta.classList.toggle("up", past);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) {
      return () => window.removeEventListener("scroll", onScroll);
    }

    root.classList.add("js-motion");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          const figures = entry.target.querySelectorAll<HTMLElement>("[data-count]");
          if (figures.length) {
            window.setTimeout(() => figures.forEach(countUp), 280);
          }
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      root.classList.remove("js-motion");
    };
  }, []);
}
