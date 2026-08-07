import { useEffect, useState } from "react";
import { api, type OrgDetails, type OrgInvite } from "../api";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function inviteLink(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

export function SettingsPage({ onWorkspaceRenamed }: { onWorkspaceRenamed?: (name: string) => void }) {
  const [org, setOrg] = useState<OrgDetails | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const data = await api.getOrg();
    setOrg(data);
    setName(data.name);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameSaved(false);
    try {
      const updated = await api.renameOrg(name.trim());
      onWorkspaceRenamed?.(updated.name);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
      await load();
    } finally {
      setSavingName(false);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      await api.createInvite(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      await load();
    } catch (err) {
      setInviteError((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function copyLink(invite: OrgInvite) {
    await navigator.clipboard.writeText(inviteLink(invite.token));
    setCopied(invite.id);
    setTimeout(() => setCopied(null), 1800);
  }

  async function revoke(invite: OrgInvite) {
    await api.deleteInvite(invite.id);
    await load();
  }

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Settings</h1>
          <div className="sub">Manage your workspace and team</div>
        </div>
      </div>

      <div className="card">
        <h3>Workspace</h3>
        <div className="card-sub">The name your team and customers see.</div>
        <form onSubmit={saveName} className="settings-row">
          <div className="field" style={{ flex: 1, margin: 0 }}>
            <label htmlFor="ws-name">Workspace name</label>
            <input id="ws-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingName || name.trim() === org?.name}>
            {savingName ? "Saving…" : nameSaved ? "Saved" : "Save"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Members</h3>
        <div className="card-sub">{org ? `${org.members.length} member${org.members.length === 1 ? "" : "s"}` : "Loading…"}</div>
        {org?.members.map((m) => (
          <div className="list-item" key={m.email}>
            <div className="avatar mono">{initials(m.name)}</div>
            <div className="list-info">
              <div className="li-title">{m.name}</div>
              <div className="li-sub">{m.email}</div>
            </div>
            <span className="badge neutral mono">{m.role}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Invite a teammate</h3>
        <div className="card-sub">They join this workspace and see the same data. Share the invite link with them.</div>
        <form onSubmit={sendInvite} className="settings-row">
          <div className="field" style={{ flex: 1, margin: 0 }}>
            <label htmlFor="invite-email">Work email</label>
            <input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="invite-role">Role</label>
            <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={inviting}>
            {inviting ? "Creating…" : "Create invite"}
          </button>
        </form>
        {inviteError && <p className="error-text">{inviteError}</p>}

        {org && org.invites.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="card-sub">Pending invites</div>
            {org.invites.map((inv) => (
              <div className="list-item" key={inv.id}>
                <div className="list-info">
                  <div className="li-title">{inv.email}</div>
                  <div className="li-sub mono">{inviteLink(inv.token)}</div>
                </div>
                <span className="badge neutral mono">{inv.role}</span>
                <button className="btn-small" onClick={() => copyLink(inv)}>
                  {copied === inv.id ? "Copied" : "Copy link"}
                </button>
                <button className="btn-small danger" onClick={() => revoke(inv)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
