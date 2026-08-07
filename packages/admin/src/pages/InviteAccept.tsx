import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type InviteInfo } from "../api";

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#2f6f5e" strokeWidth="1.4" />
      <path d="M6 13V7l8 6V7" stroke="#181b1d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InviteAcceptPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getInvite(token).then(setInvite).catch((err) => setLoadError((err as Error).message));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.acceptInvite(token, invite?.needsAccount ? { name: name.trim(), password } : { password });
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="brand">
            <LogoMark />
            Nexo
          </div>
          <h1>Invite unavailable</h1>
          <div className="sub">{loadError}</div>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="login-screen">
        <p className="empty-note">Loading…</p>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand">
          <LogoMark />
          Nexo
        </div>
        <h1>Join {invite.organizationName}</h1>
        <div className="sub">
          You've been invited as <strong>{invite.email}</strong>.
          {invite.needsAccount ? " Set a name and password to join." : " Enter your password to join."}
        </div>

        <form onSubmit={handleSubmit}>
          {invite.needsAccount && (
            <div className="field">
              <label htmlFor="invite-name">Your name</label>
              <input id="invite-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label htmlFor="invite-password">Password</label>
            <input
              id="invite-password"
              type="password"
              autoComplete={invite.needsAccount ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={invite.needsAccount ? 8 : undefined}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Joining…" : `Join ${invite.organizationName}`}
          </button>
        </form>
      </div>
    </div>
  );
}
