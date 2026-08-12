import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type KnowledgeGap } from "../api";

function since(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function occurrenceLabel(count: number) {
  return count === 1 ? "Asked once" : `Asked ${count} times`;
}

export function KnowledgeGapsPage() {
  const [gaps, setGaps] = useState<KnowledgeGap[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getKnowledgeGaps().then(setGaps);
  }, []);

  if (!gaps) {
    return (
      <div>
        <div className="page-top">
          <div>
            <h1>Knowledge gaps</h1>
            <div className="sub">Questions your knowledge base could not answer</div>
          </div>
        </div>
        <p className="empty-note">Loading…</p>
      </div>
    );
  }

  const totalAsks = gaps.reduce((sum, g) => sum + g.occurrences, 0);
  const stillWaiting = gaps.reduce((sum, g) => sum + g.unanswered, 0);

  return (
    <div>
      <div className="page-top">
        <div>
          <h1>Knowledge gaps</h1>
          <div className="sub">Questions your knowledge base could not answer</div>
        </div>
      </div>

      {gaps.length === 0 ? (
        <div className="card">
          <p className="empty-note">
            No gaps yet. When Nexo hands a conversation to a human because it wasn't confident
            enough to answer, the question shows up here grouped with others like it.
          </p>
        </div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="kl">Distinct gaps</div>
              <div className="kv">{gaps.length}</div>
            </div>
            <div className="kpi">
              <div className="kl">Conversations lost to them</div>
              <div className="kv">{totalAsks}</div>
            </div>
            <div className="kpi">
              <div className="kl">Still waiting on a human</div>
              <div className="kv">{stillWaiting}</div>
            </div>
          </div>

          <div className="card">
            <h3>Ranked by how often they cost you a handoff</h3>
            <div className="card-sub">
              Answer the top one in your help center and Nexo resolves it next time
            </div>

            {gaps.map((gap) => {
              const open = expanded === gap.id;
              return (
                <div className="gap-row" key={gap.id}>
                  <div
                    className="list-item"
                    data-clickable
                    onClick={() => setExpanded(open ? null : gap.id)}
                  >
                    <div className="gap-count">{gap.occurrences}</div>
                    <div className="list-info">
                      <div className="li-title">{gap.question}</div>
                      <div className="li-sub gap-meta">
                        {occurrenceLabel(gap.occurrences)} · last {since(gap.lastSeen)}
                        {gap.averageConfidence !== null && (
                          <> · confidence {gap.averageConfidence.toFixed(2)}</>
                        )}
                        {gap.unanswered > 0 && (
                          <span className="gap-waiting"> · {gap.unanswered} still waiting</span>
                        )}
                      </div>
                      {/**
                       * The whole point of the page: nothing on the subject
                       * means the content must be written, whereas something
                       * close means it exists and did not carry the answer.
                       * Those are different jobs, so they read differently.
                       */}
                      <div className="gap-coverage">
                        {gap.coverage.covered ? (
                          <>
                            <span className="gap-coverage-label">Closest source</span>
                            <span className="gap-coverage-source">{gap.coverage.source}</span>
                            <span className="gap-coverage-note">
                              covered, but the answer was not confident enough
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="gap-coverage-label none">No source covers this</span>
                            <span className="gap-coverage-note">
                              {gap.coverage.source
                                ? `nearest is ${gap.coverage.source}, and it is not on the subject`
                                : "nothing is indexed yet"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="gap-actions">
                      <button
                        className="btn-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/sources");
                        }}
                      >
                        {gap.coverage.covered ? "Improve source" : "Add knowledge"}
                      </button>
                      <span className="badge neutral">{open ? "Hide" : "Show asks"}</span>
                    </div>
                  </div>

                  {open && (
                    <div className="gap-variants">
                      {gap.variants.map((v) => (
                        <div
                          className="gap-variant"
                          key={v.conversationId}
                          onClick={() => navigate(`/conversations?id=${v.conversationId}`)}
                        >
                          <span className="gap-variant-q">{v.question}</span>
                          <span className="gap-variant-date">{since(v.createdAt)}</span>
                        </div>
                      ))}
                      {gap.occurrences > gap.variants.length && (
                        <div className="gap-variant-more">
                          and {gap.occurrences - gap.variants.length} more
                        </div>
                      )}
                      <button className="btn btn-ghost btn-small" onClick={() => navigate("/sources")}>
                        Add a source that answers this
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
