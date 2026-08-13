import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
      <path d="M6 13V7l8 6V7" stroke="#181b1d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
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

        {/**
         * The confirmation deliberately does not say whether the address had an
         * account. Saying so would turn this screen into a way to find out who
         * uses Nexo, which is the first step of guessing their password.
         */}
        {sent ? (
          <>
            <h1>Check your email</h1>
            <div className="sub">
              If {email.trim()} has a Nexo account, a link to reset the password is on its way. It expires
              in an hour and works once.
            </div>
            <p className="auth-alt">
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h1>Reset your password</h1>
            <div className="sub">We'll email you a link to choose a new one.</div>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Sending…" : "Email me a link"}
              </button>
            </form>

            <p className="auth-alt">
              Remembered it? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
