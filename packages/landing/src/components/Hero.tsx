import { SIGNUP_OPEN, TRIAL_DAYS } from "../config";
import { StartCta } from "./StartCta";

/**
 * Says what Nexo does in words anyone would use, before any product term. The
 * test is whether someone who has never run a support team could repeat it
 * back. Nothing here says every answer is cited: the server sends an answer
 * the model reported no source for, so the copy says it points to the page it
 * used, which is what it does when it has one.
 */
export function Hero({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="wrap hero" id="top">
      <p className="eyebrow hero-kicker">
        <span className="pulse" aria-hidden="true" />
        {SIGNUP_OPEN ? `${TRIAL_DAYS}-day free trial` : "Now in early access"}
      </p>
      <h1>
        Nexo answers your customers. <span>Your team handles the rest.</span>
      </h1>
      <p className="hero-sub">
        It reads your help pages and answers questions in a chat on your website, pointing to the page it used. When
        it isn&rsquo;t sure, it doesn&rsquo;t guess. It passes the chat to someone on your team.
      </p>
      <div className="hero-cta">
        <StartCta className="btn btn-primary" label="Start free trial" arrow />
        <button className="btn btn-ghost" type="button" onClick={onOpenTrial}>
          Talk to us
        </button>
      </div>
    </section>
  );
}
