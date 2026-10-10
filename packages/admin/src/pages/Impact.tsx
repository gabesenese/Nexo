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
              <strong className="resolved">{data.resolvedAutomatically.toLocaleString()}</strong>{" "}
              were marked resolved without anyone on your team writing to the customer or taking a
              handoff. <strong>{data.resolvedWithHuman.toLocaleString()}</strong> were resolved with
              your team involved.{" "}
              {data.answeredUnconfirmed > 0 && (
                <>
                  {data.answeredUnconfirmed.toLocaleString()} were answered by Nexo but not marked
                  resolved, so they are not counted as resolutions.{" "}
                </>
              )}
              {data.waitingOnPerson > 0 && <>{data.waitingOnPerson.toLocaleString()} are waiting on your team.</>}
            </p>
          </div>

          <div className="kpis reveal">
            <div className="kpi">
              <div className="kl">Resolved by Nexo alone</div>
              <div className="kv ok" data-count={Math.round(data.automationRate * 100)} data-suf="%">
                {percent(data.automationRate)}
              </div>
              <div className="kpi-note">{data.resolvedAutomatically.toLocaleString()} conversations</div>
            </div>
            <div className="kpi">
              <div className="kl">Resolved with your team</div>
              <div className="kv" data-count={data.resolvedWithHuman}>
                {data.resolvedWithHuman.toLocaleString()}
              </div>
            </div>
            <div className="kpi">
              <div className="kl">Handed off at least once</div>
              <div className="kv" data-count={data.escalated}>
                {data.escalated.toLocaleString()}
              </div>
            </div>
            <div className="kpi">
              <div className="kl">Answered, not confirmed</div>
              <div className="kv" data-count={data.answeredUnconfirmed}>
                {data.answeredUnconfirmed.toLocaleString()}
              </div>
              <div className="kpi-note">Not counted as resolved</div>
            </div>
            <div className="kpi">
              <div className="kl">Waiting on your team</div>
              <div className={`kv${data.waitingOnPerson > 0 ? " warn" : ""}`} data-count={data.waitingOnPerson}>
                {data.waitingOnPerson.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Workload avoided</h3>
            <div className="card-sub">
              Your own operating figures, applied to the {data.resolvedAutomatically.toLocaleString()}{" "}
              conversations Nexo resolved alone
            </div>

            {data.estimated && !editing && (
              <div className="impact-economics reveal">
                <div className="ie-figure">
                  <div className="ie-value" data-count={data.estimated.hoursAvoided}>
                    {data.estimated.hoursAvoided.toLocaleString()}
                  </div>
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

          <div className="card">
            <h3>How Nexo counts a resolution</h3>
            <div className="card-sub">One definition, used everywhere on this page</div>
            <ul className="impact-defs">
              <li>
                <strong>Resolved by Nexo</strong>: Nexo answered, never handed the conversation off,
                nobody on your team wrote to the customer, and the conversation was marked resolved.
              </li>
              <li>
                <strong>Resolved with your team</strong>: marked resolved after your team wrote to
                the customer or took a handoff.
              </li>
              <li>
                <strong>Answered, not confirmed</strong>: Nexo answered and nobody marked it
                resolved. A customer going quiet is not evidence they were helped, so these are never
                counted as resolutions.
              </li>
              <li>
                <strong>Waiting on your team</strong>: handed off and not yet resolved.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
