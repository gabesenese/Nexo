import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type AuthUser } from "../api";

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
      <path d="M6 13V7l8 6V7" stroke="#181b1d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoginPage({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await api.login(email.trim(), password);
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
          <LogoMark />
          Nexo
        </div>
        <h1>Sign in</h1>
        <div className="sub">Sign in to your Nexo workspace.</div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <div className="field-label-row">
              <label htmlFor="login-password">Password</label>
              <Link className="field-hint-link" to="/forgot-password">
                Forgot?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-alt">
          New to Nexo? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
