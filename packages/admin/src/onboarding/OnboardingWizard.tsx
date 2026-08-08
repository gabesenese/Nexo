import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AuthUser } from "../api";
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
  widgetColor: string;
  welcomeMessage: string;
}

interface IndexResult {
  sourceName: string;
  chunkCount: number;
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
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [indexResult, setIndexResult] = useState<IndexResult | null>(null);

  const next = (index: number) => setStepIndex(index);
  const skipped = data.importMethod === "skip" || !data.importMethod;

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
          onSubmit={async (patch) => {
            const user = await api.signup({
              name: data.name,
              email: data.email,
              password: data.password,
              companyName: patch.companyName,
            });
            setData((d) => ({ ...d, ...patch }));
            setAuth(user);
            next(2);
          }}
        />
      );
    case 2:
      return (
        <ImportKnowledgeStep
          defaults={{ method: data.importMethod, helpCenterUrl: data.helpCenterUrl }}
          onNext={(patch) => {
            setData((d) => ({ ...d, importMethod: patch.method, helpCenterUrl: patch.helpCenterUrl }));
            setPendingFile(patch.file ?? null);
            next(3);
          }}
        />
      );
    case 3:
      return (
        <IndexingStep
          method={data.importMethod ?? "skip"}
          helpCenterUrl={data.helpCenterUrl}
          file={pendingFile}
          onDone={(result) => {
            setIndexResult(result);
            next(4);
          }}
        />
      );
    case 4:
      return (
        <TestNexoStep
          orgKey={auth?.organization.slug ?? ""}
          hasKnowledge={!skipped && (indexResult?.chunkCount ?? 0) > 0}
          onNext={() => next(5)}
        />
      );
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
      return (
        <InstallStep
          orgKey={auth?.organization.slug ?? ""}
          onBack={() => next(5)}
          onFinish={() => navigate("/", { replace: true })}
        />
      );
    default:
      return null;
  }
}
