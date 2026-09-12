import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type InviteInfo } from "../api";
import { Mark } from "../components/Mark";


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
            <Mark />
            Nexo
          </div>
          <h1>Invite unavailable</h1>
          <div className="sub">{loadError}</div>
          {/** An expired invite used to end here, with nothing to click. */}
          <p className="auth-alt">
            Ask whoever invited you for a new one. Already have a Nexo account?{" "}
            <Link to="/login">Sign in</Link>
          </p>
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
          <Mark />
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
