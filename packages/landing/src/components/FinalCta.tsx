import { StartCta } from "./StartCta";

export function FinalCta({ onOpenTrial }: { onOpenTrial: () => void }) {
  return (
    <section className="wrap closer-wrap">
      <div className="closer reveal solo">
        <p className="eyebrow">Get started</p>
        <h2>Let Nexo answer what it can.</h2>
        <p>
          Give it your help pages, add the chat to your website, and let your team spend their time on the chats that
          need a person.
        </p>
        <div className="hero-cta">
          <StartCta className="btn btn-primary" label="Start free trial" arrow />
          <button className="btn btn-ghost" type="button" onClick={onOpenTrial}>
            Talk to us
          </button>
        </div>
      </div>
    </section>
  );
}
