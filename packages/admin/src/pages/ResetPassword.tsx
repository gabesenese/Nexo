import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
      <path d="M6 13V7l8 6V7" stroke="#181b1d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  /** Checked before the form renders, so an expired link is not discovered after typing a password. */
  useEffect(() => {
    api
      .checkResetToken(token)
      .then((r) => setValid(r.valid))
      .catch(() => setValid(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2200);
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

        {valid === null && <div className="sub">Checking your link…</div>}

        {valid === false && (
          <>
            <h1>This link has expired</h1>
            <div className="sub">
              Reset links last an hour and work once. Ask for a new one and it will arrive in a moment.
            </div>
            <p className="auth-alt">
              <Link to="/forgot-password">Send a new link</Link>
            </p>
          </>
        )}

        {valid === true && done && (
          <>
            <h1>Password changed</h1>
            <div className="sub">
              You have been signed out everywhere else. Taking you to sign in…
            </div>
          </>
        )}

        {valid === true && !done && (
          <>
            <h1>Choose a new password</h1>
            <div className="sub">This also signs out anyone using your account elsewhere.</div>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="reset-password">New password</label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Change password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
