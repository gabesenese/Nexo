import { ONBOARDING_URL } from "../config";

export function Hero({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <div className="l-hero">
      {/**
       * Three levels and no more: who it is for, what it does, how to start.
       * This previously stacked six blocks in four typefaces before the visual,
       * including two grey monospace lines doing unrelated jobs, which read as
       * writing piled on writing rather than a hierarchy.
       */}
      <span className="l-eyebrow">For growing support teams</span>
      <h1>
        Every answer has <span className="accent">an exit.</span>
      </h1>
      <p>
        AI support that knows when to answer, and when to bring in a person. Set it up yourself in
        minutes, with no sales call.
      </p>
      <div className="l-hero-ctas">
        <a className="btn btn-primary" href={ONBOARDING_URL}>
          Start free trial
        </a>
        <button className="btn btn-ghost" onClick={onOpenTrial}>
          Talk to us
        </button>
      </div>

      <div className="proof-card">
        <div className="proof-head">
          <div className="proof-mark">N</div>
          <div>
            <div className="proof-title">Nexo Support</div>
            <div className="proof-sub">Usually replies instantly</div>
          </div>
          {/**
           * The honesty label moves onto the thing it describes. As a shouted
           * caption above the card it was a disclaimer competing with the
           * headline; here it sits where someone actually looks to judge
           * whether an image is real, and still says so plainly.
           */}
          <span className="proof-tag">Illustration</span>
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
