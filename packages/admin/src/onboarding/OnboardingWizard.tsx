import { useState } from "react";
import { CreateAccountStep } from "./steps/CreateAccount";
import { CreateWorkspaceStep } from "./steps/CreateWorkspace";
import { ImportKnowledgeStep } from "./steps/ImportKnowledge";
import { IndexingStep } from "./steps/Indexing";
import { TestNexoStep } from "./steps/TestNexo";
import { CustomizeWidgetStep } from "./steps/CustomizeWidget";
import { InstallStep } from "./steps/Install";

type ImportMethod = "help_center" | "pdf" | "skip";

interface WizardData {
  name: string;
  email: string;
  password: string;
  companyName: string;
  industry: string;
  website: string;
  supportEmail: string;
  importMethod?: ImportMethod;
  helpCenterUrl?: string;
  pdfName?: string;
  widgetColor: string;
  welcomeMessage: string;
}

const INITIAL_DATA: WizardData = {
  name: "",
  email: "",
  password: "",
  companyName: "",
  industry: "",
  website: "",
  supportEmail: "",
  widgetColor: "#204c40",
  welcomeMessage: "",
};

export function OnboardingWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);

  function next(index: number) {
    setStepIndex(index);
  }

  function restart() {
    setData(INITIAL_DATA);
    setStepIndex(0);
  }

  switch (stepIndex) {
    case 0:
      return (
        <CreateAccountStep
          defaultName={data.name}
          defaultEmail={data.email}
          onNext={(patch) => {
            setData((d) => ({ ...d, ...patch }));
            next(1);
          }}
        />
      );
    case 1:
      return (
        <CreateWorkspaceStep
          defaults={data}
          onBack={() => next(0)}
          onNext={(patch) => {
            setData((d) => ({ ...d, ...patch }));
            next(2);
          }}
        />
      );
    case 2:
      return (
        <ImportKnowledgeStep
          defaults={{ method: data.importMethod, helpCenterUrl: data.helpCenterUrl }}
          onBack={() => next(1)}
          onNext={(patch) => {
            setData((d) => ({ ...d, importMethod: patch.method, helpCenterUrl: patch.helpCenterUrl, pdfName: patch.pdfName }));
            next(3);
          }}
        />
      );
    case 3:
      return (
        <IndexingStep skipped={data.importMethod === "skip" || !data.importMethod} onBack={() => next(2)} onNext={() => next(4)} />
      );
    case 4:
      return <TestNexoStep onBack={() => next(3)} onNext={() => next(5)} />;
    case 5:
      return (
        <CustomizeWidgetStep
          defaults={{ color: data.widgetColor, welcomeMessage: data.welcomeMessage }}
          onBack={() => next(4)}
          onNext={(patch) => {
            setData((d) => ({ ...d, widgetColor: patch.color, welcomeMessage: patch.welcomeMessage }));
            next(6);
          }}
        />
      );
    case 6:
      return <InstallStep onBack={() => next(5)} onFinish={restart} />;
    default:
      return null;
  }
}
