import { useEffect, useState } from "react";
import { api, type Lead } from "../api";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function when(iso: string) {
  const at = new Date(iso);
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (days < 1) return at.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  if (days < 7) return at.toLocaleDateString("en-CA", { weekday: "short" });
  return at.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    api.listLeads().then(setLeads);
  }, []);

  const header = (
    <div className="page-top">
      <div>
        <h1>Leads</h1>
        <div className="sub">Trial requests from the landing page</div>
      </div>
    </div>
  );

  if (leads?.length === 0) {
    return (
      <div>
        {header}
        <div className="empty-hero">
          <div className="eh-mark">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 6.5h14v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9Z"
                stroke="var(--ok)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="m3.4 7 6.6 5 6.6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <h2>No trial requests yet</h2>
          <p>
            When someone fills in the trial form on your landing page, they land here with their name,
            company and email, so you can answer while the visit is still fresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}

      <div className="card">
        <h3>All leads</h3>
        <div className="card-sub">{leads ? `${leads.length} total` : "Loading…"}</div>
        {leads === null ? (
          <p className="empty-note">Loading…</p>
        ) : (
          leads.map((l) => (
            <div className="list-item" key={l.id}>
              <div className="avatar mono">{initials(l.name)}</div>
              <div className="list-info">
                <div className="li-title">
                  {l.name} · {l.company}
                </div>
                <div className="li-sub">{l.email}</div>
              </div>
              <span className="badge neutral mono">{l.source}</span>
              <span className="lead-when mono" title={new Date(l.createdAt).toLocaleString()}>
                {when(l.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
