import { useState } from "react";
import { WizardShell } from "../WizardShell";
import { Select } from "../../components/Select";

const INDUSTRIES = ["SaaS", "E-commerce", "Property management", "Healthcare", "Financial services", "Other"];

export function CreateWorkspaceStep({
  onSubmit,
  onBack,
  defaults,
}: {
  onSubmit: (data: { companyName: string; industry: string; website: string; supportEmail: string }) => Promise<void>;
  onBack: () => void;
  defaults: { companyName: string; industry: string; website: string; supportEmail: string };
}) {
  const [companyName, setCompanyName] = useState(defaults.companyName);
  const [industry, setIndustry] = useState(defaults.industry || INDUSTRIES[0]);
  const [website, setWebsite] = useState(defaults.website);
  const [supportEmail, setSupportEmail] = useState(defaults.supportEmail);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return setError("Company name is required.");
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ companyName: companyName.trim(), industry, website: website.trim(), supportEmail: supportEmail.trim() });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <WizardShell step={2} total={7} title="Create your workspace" subtitle="This is what your team and customers will see.">
      <form onSubmit={handleSubmit} className="onboard-body">
        <div className="field">
          <label htmlFor="ob-company">Company name</label>
          <input id="ob-company" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ob-industry">Industry</label>
          <Select
            id="ob-industry"
            ariaLabel="Industry"
            value={industry}
            onChange={setIndustry}
            options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
          />
        </div>
        <div className="field">
          <label htmlFor="ob-website">Website</label>
          <input
            id="ob-website"
            type="text"
            placeholder="https://yourcompany.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ob-support-email">Support email</label>
          <input
            id="ob-support-email"
            type="email"
            placeholder="support@yourcompany.com"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="onboard-actions">
          <button type="button" className="onboard-back" onClick={onBack} disabled={submitting}>
            ← Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating workspace…" : "Create workspace"}
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
