import { useState } from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Story } from "./components/Story";
import { Steps } from "./components/Steps";
import { FeatureRows } from "./components/FeatureRows";
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

      <div className="shell">
        <Nav onOpenTrial={openTrial} />
        <Hero onOpenTrial={openTrial} />
        <Story />
        <Steps />
        <FeatureRows />
        <Roi />
        <Pricing />
        <Faq onOpenTrial={openTrial} />
        <FinalCta onOpenTrial={openTrial} />
        <Footer />
      </div>

      <MobileCta />
      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </TrialProvider>
  );
}
