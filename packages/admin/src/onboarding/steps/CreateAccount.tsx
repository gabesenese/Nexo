import { useState } from "react";
import { WizardShell } from "../WizardShell";

export function CreateAccountStep({
  onNext,
  defaultName,
  defaultEmail,
}: {
  onNext: (data: { name: string; email: string; password: string }) => void;
  defaultName: string;
  defaultEmail: string;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    if (!email.trim()) return setError("Work email is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setError("");
    onNext({ name: name.trim(), email: email.trim(), password });
  }

  return (
    <WizardShell step={1} total={7} title="Create your account" subtitle="No credit card required to get started.">
      <form onSubmit={handleSubmit} className="onboard-body">
        <div className="field">
          <label htmlFor="ob-name">Name</label>
          <input id="ob-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ob-email">Work email</label>
          <input
            id="ob-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ob-password">Password</label>
          <input
            id="ob-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="onboard-actions">
          <button type="submit" className="btn btn-primary">
            Continue
          </button>
        </div>
      </form>
    </WizardShell>
  );
}
