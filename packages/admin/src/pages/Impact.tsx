import { useEffect, useState } from "react";
import { api, type ImpactSummary } from "../api";

/**
 * en-CA renders CAD as a bare "$", which is the ambiguity the pricing page
 * was fixed to avoid. Prices and figures read as Canadian dollars everywhere.
 */
const NUMBER = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });

function cad(value: number) {
  return `C$${NUMBER.format(value)}`;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ImpactPage() {
  const [data, setData] = useState<ImpactSummary | null>(null);
  const [minutes, setMinutes] = useState("");
  const [cost, setCost] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getImpact().then((d) => {
      setData(d);
      setMinutes(d.assumptions.averageHandleMinutes?.toString() ?? "");
      setCost(d.assumptions.supportHourlyCostCad?.toString() ?? "");
    });
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.setImpactAssumptions({
        averageHandleMinutes: minutes ? Number(minutes) : null,
        supportHourlyCostCad: cost ? Number(cost) : null,
      });
      setData(await api.getImpact());
      setEditing(false);
    } catch (err) {
      setError((err as Error).message || "Could not save those figures.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div>
        <div className="page-top">
          <div>
            <h1>Impact</h1>
          </div>
        </div>
        <p className="empty-note">Loading…</p>
      </div>
    );
  }

  const showForm = editing || !data.estimated;

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Impact</h1>
          <div className="sub">What Nexo handled over the last {data.windowDays} days</div>
        </div>
      </div>

      {data.conversations === 0 ? (
        <div className="card">
          <p className="empty-note">
            No conversations in this window yet. Once customers start talking to Nexo, this page
            shows how much of the work it absorbed.
          </p>
        </div>
      ) : (
        <>
          <div className="card impact-statement">
            <p>
              Over the last {data.windowDays} days your customers started{" "}
              <strong>{data.conversations.toLocaleString()}</strong> conversations.{" "}
              <strong>{data.resolvedAutomatically.toLocaleString()}</strong> were resolved without a
              person ever stepping in. <strong>{data.resolvedWithHuman.toLocaleString()}</strong>{" "}
              needed one of your team.{" "}
              {data.stillOpen > 0 && <>{data.stillOpen.toLocaleString()} are still open.</>}
            </p>
          </div>

          <div className="kpis">
            <div className="kpi">
              <div className="kl">Resolved by Nexo alone</div>
              <div className="kv">{percent(data.automationRate)}</div>
              <div className="kpi-note">{data.resolvedAutomatically.toLocaleString()} conversations</div>
            </div>
            <div className="kpi">
              <div className="kl">Needed a person</div>
              <div className="kv">{data.resolvedWithHuman.toLocaleString()}</div>
            </div>
            <div className="kpi">
              <div className="kl">Handed off at least once</div>
              <div className="kv">{data.escalated.toLocaleString()}</div>
            </div>
            <div className="kpi">
              <div className="kl">Still open</div>
              <div className="kv">{data.stillOpen.toLocaleString()}</div>
            </div>
          </div>

          <div className="card">
            <h3>Workload avoided</h3>
            <div className="card-sub">
              Your own operating figures, applied to the {data.resolvedAutomatically.toLocaleString()}{" "}
              conversations Nexo resolved alone
            </div>

            {data.estimated && !editing && (
              <div className="impact-economics">
                <div className="ie-figure">
                  <div className="ie-value">{data.estimated.hoursAvoided.toLocaleString()}</div>
                  <div className="ie-label">hours your team did not spend</div>
                </div>
                <div className="ie-figure">
                  <div className="ie-value">{cad(data.estimated.costAvoidedCad)}</div>
                  <div className="ie-label">
                    at {cad(data.assumptions.supportHourlyCostCad ?? 0)}/hour and{" "}
                    {data.assumptions.averageHandleMinutes} min per conversation
                  </div>
                </div>
                <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
                  Change these figures
                </button>
              </div>
            )}

            {showForm && (
              <div className="impact-form">
                {!data.estimated && (
                  <p className="empty-note">
                    Nexo will not guess what your support costs. Enter your own two figures and this
                    becomes a number you can take to a budget conversation.
                  </p>
                )}
                <label>
                  Average minutes a person spends on one conversation
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="8"
                  />
                </label>
                <label>
                  Fully loaded support cost per hour (CAD)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="42"
                  />
                </label>
                {error && <p className="error-text">{error}</p>}
                <div className="impact-form-actions">
                  <button className="btn btn-primary" onClick={save} disabled={busy || !minutes || !cost}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                  {editing && data.estimated && (
                    <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
