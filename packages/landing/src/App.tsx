import { useState } from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { ProductPanel } from "./components/ProductPanel";
import { PhilosophySection } from "./components/PhilosophySection";
import { Bento } from "./components/Bento";
import { Features } from "./components/Features";
import { Roi } from "./components/Roi";
import { Pricing } from "./components/Pricing";
import { Faq } from "./components/Faq";
import { FinalCta } from "./components/FinalCta";
import { Footer } from "./components/Footer";
import { MobileCta } from "./components/MobileCta";
import { TrialModal } from "./components/TrialModal";
import { TrialProvider } from "./TrialContext";
import { useSupportWidget } from "./useSupportWidget";
import { useMotion } from "./useMotion";

export default function App() {
  const [trialOpen, setTrialOpen] = useState(false);
  useSupportWidget();
  useMotion();

  const openTrial = () => setTrialOpen(true);

  return (
    <TrialProvider value={openTrial}>
      <div className="mesh" aria-hidden="true" />
      <svg className="grain" aria-hidden="true">
        <filter id="landing-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#landing-grain)" />
      </svg>

      <div className="shell">
        <Nav onOpenTrial={openTrial} />
        <Hero onOpenTrial={openTrial} />
        <ProductPanel />
        <PhilosophySection />
        <Bento />
        <Features />
        <Roi />
        <Pricing />
        <Faq />
        <FinalCta onOpenTrial={openTrial} />
        <Footer />
      </div>

      <MobileCta />
      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </TrialProvider>
  );
}
