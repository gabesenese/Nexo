import { useEffect, useState } from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Marquee } from "./components/Marquee";
import { PhilosophySection } from "./components/PhilosophySection";
import { Features } from "./components/Features";
import { PlatformGrid } from "./components/PlatformGrid";
import { StatsBand } from "./components/StatsBand";
import { Pricing } from "./components/Pricing";
import { Faq } from "./components/Faq";
import { FinalCta } from "./components/FinalCta";
import { Footer } from "./components/Footer";
import { TrialModal } from "./components/TrialModal";
import { useSupportWidget } from "./useSupportWidget";

/**
 * Reveals sections as they arrive rather than animating everything at load.
 * Anything already on screen is revealed immediately, so the top of the page
 * never waits on an observer, and a reduced-motion preference skips the
 * transition entirely rather than shortening it.
 */
function useReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function App() {
  const [trialOpen, setTrialOpen] = useState(false);
  useSupportWidget();
  useReveal();

  const openTrial = () => setTrialOpen(true);

  return (
    <>
      <Nav onOpenTrial={openTrial} />
      <Hero onOpenTrial={openTrial} />
      <Marquee />
      <PhilosophySection />
      <Features />
      <PlatformGrid />
      <StatsBand />
      <Pricing />
      <Faq />
      <FinalCta onOpenTrial={openTrial} />
      <Footer />
      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </>
  );
}
