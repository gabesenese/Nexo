import { useEffect, useState } from "react";
import { api, AUDIT_LABELS, can, ROLE_DESCRIPTIONS, ROLE_LABELS, type AuthUser, type InvitableRole, type MemberRole, type AuditEvent, type OrgDetails, type OrgInvite, type OrgMember } from "../api";
import { PlanUsageCard } from "../components/PlanUsageCard";
import { WebhookCard } from "../components/WebhookCard";
import { Select } from "../components/Select";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const WIDGET_SRC = import.meta.env.VITE_WIDGET_URL ?? `${API_URL}/widget.js`;

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
  const [me, setMe] = useState<AuthUser | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("agent");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [widget, setWidget] = useState({ accentColor: "#204c40", welcomeMessage: "" });
  const [savingWidget, setSavingWidget] = useState(false);
  const [widgetSaved, setWidgetSaved] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);

  /** Matches the snippet the onboarding wizard hands out, from the same env vars. */
  const snippet = org
    ? `<script src="${WIDGET_SRC}" data-api-url="${API_URL}" data-org-key="${org.widgetKey}"></script>`
    : "";

  async function copySnippet() {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 1800);
  }

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
    api.me().then(setMe).catch(() => {});
    /** Only settings-writers may read it, so a 403 here just means the card stays hidden. */
    api.getAudit().then((r) => setAudit(r.events)).catch(() => setAudit(null));
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
    setInviteNotice(null);
    setInviting(true);
    try {
      const invited = await api.createInvite(inviteEmail.trim(), inviteRole);
      /**
       * Said plainly rather than assumed. Delivery is deliberately allowed to
       * fail without failing the invite, so the operator has to be told which
       * of the two happened, or they will wait for an email that never went.
       */
      setInviteNotice(
        invited.delivered
          ? `Invitation emailed to ${invited.email}.`
          : `Invite created, but the email could not be sent. Copy the link below and send it yourself.`,
      );
      setInviteEmail("");
      await load();
    } catch (err) {
      setInviteError((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  const owners = org?.members.filter((m) => m.role === "owner") ?? [];

  async function changeRole(member: OrgMember, role: MemberRole) {
    setMemberError(null);
    try {
      await api.setMemberRole(member.id, role);
      await load();
      /** Demoting yourself changes what you may do, so the console has to catch up. */
      if (member.id === me?.id) api.me().then(setMe).catch(() => {});
    } catch (err) {
      setMemberError((err as Error).message);
    }
  }

  async function removeMember(member: OrgMember) {
    if (!window.confirm(`Remove ${member.name} from this workspace? They lose access immediately.`)) return;
    setMemberError(null);
    try {
      await api.removeMember(member.id);
      await load();
    } catch (err) {
      setMemberError((err as Error).message);
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
          <div className="sub">
            Manage your workspace and team
            {me && (
              <>
                {" · "}
                <span className="role-tag">{ROLE_LABELS[me.role]}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <PlanUsageCard />

      {can(me, "settings:write") && (
      <div className="card">
        <h3>Workspace</h3>
        <div className="card-sub">The name your team and customers see.</div>
        <form onSubmit={saveName}>
          <div className="field-row">
            <label htmlFor="ws-name">Workspace name</label>
            <div className="field-control">
              <input id="ws-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <button
              type="submit"
              className="btn btn-primary field-action"
              disabled={savingName || name.trim() === org?.name}
            >
              {savingName ? "Saving…" : nameSaved ? "Saved" : "Save"}
            </button>
          </div>
        </form>
      </div>
      )}

      {can(me, "settings:write") && (
      <>
      <div className="card">
        <h3>Widget</h3>
        <div className="card-sub">The branding your customers see in the chat widget.</div>
        <form onSubmit={saveWidget}>
          <div className="field-row">
            <span className="field-label">Accent color</span>
            <div className="field-control">
              <div className="onboard-swatches">
                {WIDGET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`onboard-swatch${widget.accentColor === c ? " selected" : ""}`}
                    style={{ background: c }}
                    aria-label={`Choose ${c}`}
                    aria-pressed={widget.accentColor === c}
                    onClick={() => setWidget((w) => ({ ...w, accentColor: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="field-row">
            <label htmlFor="widget-welcome">Welcome message</label>
            <div className="field-control">
              <input
                id="widget-welcome"
                type="text"
                value={widget.welcomeMessage}
                onChange={(e) => setWidget((w) => ({ ...w, welcomeMessage: e.target.value }))}
              />
              <p className="field-help">The first thing a visitor sees when they open the chat.</p>
              {widgetError && <p className="error-text">{widgetError}</p>}
            </div>
            <button
              type="submit"
              className="btn btn-primary field-action"
              disabled={savingWidget || !widget.welcomeMessage.trim()}
            >
              {savingWidget ? "Saving…" : widgetSaved ? "Saved" : "Save"}
            </button>
          </div>
        </form>

        <div className="field-row">
          <span className="field-label">Widget key</span>
          <div className="field-control">
            <div className="field-inline">
              <input className="mono" readOnly value={org?.widgetKey ?? ""} aria-label="Widget key" />
              <button type="button" className="btn-small" onClick={copyWidgetKey}>
                {keyCopied ? "Copied" : "Copy"}
              </button>
              <button type="button" className="btn-small danger" onClick={rotateWidgetKey} disabled={rotating}>
                {rotating ? "Rotating…" : "Rotate"}
              </button>
            </div>
            <p className="field-help">
              The public key in your embed snippet. Rotating it disables existing embeds until you update them.
            </p>
          </div>
        </div>

        {/**
         * The snippet used to exist only inside the onboarding wizard, which
         * cannot be revisited once finished. Settings referred to "your embed
         * snippet" while never showing one, so anyone who closed onboarding had
         * no way back to the one thing they need to install Nexo.
         */}
        <div className="field-row">
          <span className="field-label">Install snippet</span>
          <div className="field-control">
            <div className="install-snippet">
              <code>{snippet || "Loading…"}</code>
              <button type="button" className="btn-small" onClick={copySnippet} disabled={!org}>
                {snippetCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="field-help">
              Paste this before the closing <code>&lt;/body&gt;</code> tag on your site. The{" "}
              <code>data-org-key</code> ties the widget to this workspace, so it only ever answers from
              your sources.
            </p>
          </div>
        </div>
      </div>

      <WebhookCard />
      </>
      )}

      <div className="card">
        <h3>Members</h3>
        <div className="card-sub">{org ? `${org.members.length} member${org.members.length === 1 ? "" : "s"}` : "Loading…"}</div>
        {memberError && <p className="error-text">{memberError}</p>}
        {org?.members.map((m) => {
          /**
           * A workspace must keep an owner, and only an owner can move the role
           * in or out of owner. Showing the control anyway would be offering a
           * button whose only outcome is an error message.
           */
          const isLastOwner = m.role === "owner" && owners.length === 1;
          /** Only an owner may act on another owner; promoting to owner is restricted by the options below. */
          const canEditThis =
            can(me, "team:manage") && !isLastOwner && (m.role !== "owner" || me?.role === "owner");

          return (
            <div className="list-item" key={m.email}>
              <div className="avatar mono">{initials(m.name)}</div>
              <div className="list-info">
                <div className="li-title">
                  {m.name}
                  {m.id === me?.id && <span className="recurrence-tag">you</span>}
                </div>
                <div className="li-sub">{m.email}</div>
              </div>
              {canEditThis ? (
                <Select
                  className="assign-select"
                  ariaLabel={`Role for ${m.name}`}
                  value={m.role}
                  onChange={(v) => changeRole(m, v as MemberRole)}
                  options={(me?.role === "owner"
                    ? (["owner", "admin", "agent", "viewer"] as MemberRole[])
                    : (["admin", "agent", "viewer"] as MemberRole[])
                  ).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                />
              ) : (
                <span className="badge neutral mono" title={isLastOwner ? "A workspace needs an owner" : undefined}>
                  {ROLE_LABELS[m.role]}
                </span>
              )}
              {canEditThis && m.id !== me?.id && (
                <button className="btn-small danger" onClick={() => removeMember(m)}>
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      {can(me, "settings:write") && audit && (
        <div className="card">
          <h3>Activity log</h3>
          <div className="card-sub">Who changed what in this workspace.</div>
          {audit.length === 0 ? (
            <p className="empty-note">Nothing has been changed yet.</p>
          ) : (
            audit.slice(0, 12).map((e) => (
              <div className="list-item" key={e.id}>
                <div className="list-info">
                  <div className="li-title">
                    {e.actor?.name ?? e.actor?.email ?? "Nexo"} {AUDIT_LABELS[e.action] ?? e.action}
                    {e.targetLabel && <span className="audit-target"> {e.targetLabel}</span>}
                  </div>
                  <div className="attention-meta">{new Date(e.at).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {can(me, "team:manage") && (
      <div className="card">
        <h3>Invite a teammate</h3>
        <div className="card-sub">
          They join this workspace and see the same data. We email them the invitation.
        </div>
        <form onSubmit={sendInvite}>
          <div className="field-row">
            <label htmlFor="invite-email">Work email</label>
            <div className="field-control">
              <div className="field-inline">
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <Select
                  id="invite-role"
                  ariaLabel="Role"
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v as InvitableRole)}
                  options={[
                    { value: "agent", label: "Agent" },
                    { value: "admin", label: "Admin" },
                    { value: "viewer", label: "Viewer" },
                  ]}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary field-action" disabled={inviting}>
              {inviting ? "Creating…" : "Create invite"}
            </button>
          </div>
        </form>
        {inviteError && <p className="error-text">{inviteError}</p>}
        {inviteNotice && <p className="source-note">{inviteNotice}</p>}

        {org && org.invites.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="card-sub">Pending invites</div>
            {org.invites.map((inv) => (
              <div className="list-item" key={inv.id}>
                <div className="list-info">
                  <div className="li-title">{inv.email}</div>
                  <div className="li-sub mono">{inviteLink(inv.token)}</div>
                </div>
                <span className="badge neutral mono" title={ROLE_DESCRIPTIONS[inv.role]}>{ROLE_LABELS[inv.role]}</span>
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
      )}
    </div>
  );
}
