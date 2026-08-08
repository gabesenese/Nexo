import { useState } from "react";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { MetricsStrip } from "./components/MetricsStrip";
import { PhilosophySection } from "./components/PhilosophySection";
import { KnowledgeSection } from "./components/KnowledgeSection";
import { Pricing } from "./components/Pricing";
import { Footer } from "./components/Footer";
import { TrialModal } from "./components/TrialModal";

export default function App() {
  const [trialOpen, setTrialOpen] = useState(false);

  return (
    <>
      <Nav onOpenTrial={() => setTrialOpen(true)} />
      <Hero onOpenTrial={() => setTrialOpen(true)} />
      <MetricsStrip />
      <PhilosophySection />
      <KnowledgeSection />
      <Pricing />
      <Footer />
      <TrialModal open={trialOpen} onClose={() => setTrialOpen(false)} />
    </>
  );
}
