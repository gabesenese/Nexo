import { useEffect, useState } from "react";
import { api, type Lead } from "../api";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    api.listLeads().then(setLeads);
  }, []);

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Leads</h1>
          <div className="sub">Trial requests from the landing page</div>
        </div>
      </div>

      <div className="card">
        <h3>All leads</h3>
        <div className="card-sub">{leads ? `${leads.length} total` : "Loading…"}</div>
        {leads?.map((l) => (
          <div className="list-item" key={l.id}>
            <div className="avatar mono">{initials(l.name)}</div>
            <div className="list-info">
              <div className="li-title">
                {l.name} · {l.company}
              </div>
              <div className="li-sub">{l.email}</div>
            </div>
            <span className="badge neutral mono">{l.source}</span>
            <span className="li-sub" style={{ flexShrink: 0, marginLeft: 12 }}>
              {new Date(l.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
        {leads?.length === 0 && <p className="empty-note">No leads yet. They'll show up here when someone submits the trial form on the landing page.</p>}
      </div>
    </div>
  );
}
