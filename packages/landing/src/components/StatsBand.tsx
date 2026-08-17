import { useEffect, useRef, useState } from "react";

/**
 * Every figure here is checkable against the product or the price list. The
 * mockup's version included "under 5 days to first live conversation", which
 * is a performance claim with no customers behind it, so it is replaced by the
 * install cost, which anyone can verify by reading the snippet.
 */
const STATS = [
  { pre: "$", to: 0, label: "minimum contract floor" },
  { to: 1, label: "line of code to install" },
  { to: 50, suf: "K", label: "conversations / mo, top plan" },
  { to: 100, suf: "%", label: "Canadian data residency" },
];

const DURATION = 1100;

/**
 * Counts up once, when the band first comes into view. Reduced motion gets the
 * final number immediately rather than a faster count: the animation is
 * decoration, and the number is the information.
 */
function useCountUp(target: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / DURATION, 1);
          /** Ease-out, so it decelerates into the real figure rather than snapping. */
          setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return { ref, value };
}

function Stat({ stat }: { stat: (typeof STATS)[number] }) {
  const { ref, value } = useCountUp(stat.to);
  return (
    <div className="stat-cell" ref={ref}>
      <div className="stat-num">
        {stat.pre && <span className="pre">{stat.pre}</span>}
        {value}
        {stat.suf && <span className="suf">{stat.suf}</span>}
      </div>
      <div className="stat-label">{stat.label}</div>
    </div>
  );
}

export function StatsBand() {
  return (
    <section className="section stats-sec">
      <div className="wrap">
        <div className="section-head">
          <span className="l-eyebrow">Built for growing teams</span>
          <h2>The enterprise outcome, without the enterprise.</h2>
        </div>
        <div className="stats-grid">
          {STATS.map((stat) => (
            <Stat stat={stat} key={stat.label} />
          ))}
        </div>
      </div>
    </section>
  );
}
