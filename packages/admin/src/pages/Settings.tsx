import { useEffect, useState } from "react";
import { api, type OrgDetails, type OrgInvite } from "../api";
import { PlanUsageCard } from "../components/PlanUsageCard";
import { WebhookCard } from "../components/WebhookCard";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function inviteLink(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

const WIDGET_COLORS = ["#204c40", "#2f6f5e", "#c9873a", "#181b1d", "#2b3f8a"];

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

  const [widget, setWidget] = useState({ accentColor: "#204c40", welcomeMessage: "" });
  const [savingWidget, setSavingWidget] = useState(false);
  const [widgetSaved, setWidgetSaved] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  async function load() {
    const [data, wc] = await Promise.all([api.getOrg(), api.getWidgetConfig()]);
    setOrg(data);
    setName(data.name);
    setWidget(wc);
  }

  async function copyWidgetKey() {
    if (!org) return;
    await navigator.clipboard.writeText(org.widgetKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1800);
  }

  async function rotateWidgetKey() {
    const ok = window.confirm(
      "Rotate the widget key? Any embeds using the current key will stop working until you update them with the new snippet.",
    );
    if (!ok) return;
    setRotating(true);
    try {
      await api.rotateWidgetKey();
      await load();
    } finally {
      setRotating(false);
    }
  }

  async function saveWidget(e: React.FormEvent) {
    e.preventDefault();
    setSavingWidget(true);
    setWidgetSaved(false);
    setWidgetError(null);
    try {
      const updated = await api.updateWidgetConfig({ ...widget, welcomeMessage: widget.welcomeMessage.trim() });
      setWidget(updated);
      setWidgetSaved(true);
      setTimeout(() => setWidgetSaved(false), 2000);
    } catch (err) {
      setWidgetError((err as Error).message);
    } finally {
      setSavingWidget(false);
    }
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

      <PlanUsageCard />

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
        <h3>Widget</h3>
        <div className="card-sub">The branding your customers see in the chat widget.</div>
        <form onSubmit={saveWidget}>
          <div className="field">
            <label>Accent color</label>
            <div className="onboard-swatches">
              {WIDGET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`onboard-swatch${widget.accentColor === c ? " selected" : ""}`}
                  style={{ background: c }}
                  aria-label={`Choose ${c}`}
                  onClick={() => setWidget((w) => ({ ...w, accentColor: c }))}
                />
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="widget-welcome">Welcome message</label>
            <input
              id="widget-welcome"
              type="text"
              value={widget.welcomeMessage}
              onChange={(e) => setWidget((w) => ({ ...w, welcomeMessage: e.target.value }))}
            />
          </div>
          {widgetError && <p className="error-text">{widgetError}</p>}
          <button type="submit" className="btn btn-primary" disabled={savingWidget || !widget.welcomeMessage.trim()}>
            {savingWidget ? "Saving…" : widgetSaved ? "Saved" : "Save"}
          </button>
        </form>

        <div className="field" style={{ marginTop: 18 }}>
          <label>Widget key</label>
          <div className="card-sub" style={{ marginBottom: 8 }}>
            The public key in your embed snippet. Rotating it disables existing embeds until you update them.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="mono" style={{ flex: 1 }} readOnly value={org?.widgetKey ?? ""} />
            <button type="button" className="btn-small" onClick={copyWidgetKey}>
              {keyCopied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="btn-small danger" onClick={rotateWidgetKey} disabled={rotating}>
              {rotating ? "Rotating…" : "Rotate"}
            </button>
          </div>
        </div>
      </div>

      <WebhookCard />

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
