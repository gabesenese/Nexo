import { ONBOARDING_URL } from "../config";

export function Hero({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <div className="l-hero">
      <span className="l-eyebrow">● Built for growing support teams</span>
      <h1>
        Every answer has <span className="accent">an exit.</span>
      </h1>
      <p>AI support that knows when to answer, and when to bring in a person.</p>
      <div className="l-hero-ctas">
        <a className="btn btn-primary" href={ONBOARDING_URL}>
          Start free trial
        </a>
        <button className="btn btn-ghost" onClick={onOpenTrial}>
          Talk to us
        </button>
      </div>
      <div className="l-hero-note">Set it up yourself in minutes. No sales call required.</div>

      <div className="proof-label">This is the actual product, not a mockup</div>
      <div className="proof-card">
        <div className="proof-head">
          <div className="proof-mark">N</div>
          <div>
            <div className="proof-title">Nexo Support</div>
            <div className="proof-sub">Usually replies instantly</div>
          </div>
        </div>
        <div className="proof-msg user">
          I was charged twice this month and I'm not sure why. Can someone look into my account?
        </div>
        <div className="proof-msg bot">
          I can see our billing policy, but this involves account-specific details I don't have full visibility into.
          <div className="proof-flag">Handing this to a human</div>
        </div>
        <div className="proof-handoff">
          <span className="label">Handed off to a human</span>
          A team member has this conversation's full history and will follow up here.
        </div>
      </div>
    </div>
  );
}
