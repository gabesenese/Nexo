import { useState } from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { MetricsStrip } from "./components/MetricsStrip";
import { PhilosophySection } from "./components/PhilosophySection";
import { HowItWorks } from "./components/HowItWorks";
import { MeetNexo } from "./components/MeetNexo";
import { PlatformGrid } from "./components/PlatformGrid";
import { EnterpriseComparison } from "./components/EnterpriseComparison";
import { Pricing } from "./components/Pricing";
import { Footer } from "./components/Footer";
import { TrialModal } from "./components/TrialModal";
import { useSupportWidget } from "./useSupportWidget";

export default function App() {
  const [trialOpen, setTrialOpen] = useState(false);
  useSupportWidget();

  return (
    <>
      <Nav onOpenTrial={() => setTrialOpen(true)} />
      <Hero onOpenTrial={() => setTrialOpen(true)} />
      <MetricsStrip />
      <PhilosophySection />
      <HowItWorks />
      <MeetNexo />
      <PlatformGrid />
      <EnterpriseComparison />
      <Pricing />
      <Footer />
      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </>
  );
}
