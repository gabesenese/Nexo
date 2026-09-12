import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type AuthUser } from "../api";
import { Mark } from "../components/Mark";


export function SignupPage({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await api.signup({
        name: name.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        password,
      });
      onAuthed(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand">
          <Mark />
          Nexo
        </div>
        <h1>Create your account</h1>
        <div className="sub">Start your own Nexo workspace. No credit card required.</div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="signup-name">Your name</label>
            <input id="signup-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="signup-company">Company name</label>
            <input
              id="signup-company"
              type="text"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="signup-email">Work email</label>
            <input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating your workspace…" : "Create account"}
          </button>
        </form>

        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
