import type { CSSProperties, ReactNode } from "react";

/**
 * Setup, in the words a first-time visitor would use. Each step carries a
 * small piece of the real product rather than an illustration: the demo
 * workspace's three sources as they are named in it, the embed tag as the
 * console hands it out, and a waiting conversation as the inbox lists it.
 */
function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.5 1.75h4.25l2.75 2.75v7.75h-7z M7.75 1.75v2.75h2.75" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function Sources() {
  return (
    <ul className="mini mini-sources">
      {["Meridian Help Center", "Billing FAQ", "API Reference"].map((name) => (
        <li key={name}>
          <DocIcon />
          <span>{name}</span>
          <em>Ready</em>
        </li>
      ))}
    </ul>
  );
}

function Embed() {
  return (
    <div className="mini mini-embed">
      <code>
        <span className="tag">&lt;script</span> <span className="attr">src</span>=&quot;…/widget.js&quot;{" "}
        <span className="attr">data-api-url</span>=&quot;…&quot; <span className="attr">data-org-key</span>=&quot;…&quot;
        <span className="tag">&gt;&lt;/script&gt;</span>
      </code>
      <span className="mini-launcher" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
          <path
            d="M4 9.5C4 6.46 6.9 4 11 4s7 2.46 7 5.5S15.1 15 11 15c-.63 0-1.24-.06-1.81-.17L6 16.5l.86-2.35C5.13 13.14 4 11.44 4 9.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

function Waiting() {
  return (
    <div className="mini mini-inbox">
      <p className="mini-q">
        <i aria-hidden="true" />
        Can I get a refund for the seats we didn&rsquo;t use last quarter?
      </p>
      <p className="mini-meta">
        Nexo could not answer <span>Nobody has picked this up</span>
      </p>
    </div>
  );
}

const STEPS: { title: string; body: string; ui: ReactNode }[] = [
  {
    title: "Give Nexo your help pages",
    body: "Paste a link to your help centre, or upload PDFs. Nexo answers from what they say.",
    ui: <Sources />,
  },
  {
    title: "Add the chat to your website",
    body: "Paste one line into your site. A chat button appears in the corner, in your brand colour.",
    ui: <Embed />,
  },
  {
    title: "Your team handles the rest",
    body: "Whatever Nexo can't answer lands in your team's inbox with the whole chat, so nobody asks the customer twice.",
    ui: <Waiting />,
  },
];

export function Steps() {
  return (
    <section className="wrap steps reveal" id="how">
      <div className="steps-head" style={{ "--i": 0 } as CSSProperties}>
        <p className="eyebrow">How it works</p>
        <h2>Set up in three steps.</h2>
      </div>
      <ol className="steps-grid">
        {STEPS.map((step, i) => (
          <li className="step" key={step.title} style={{ "--i": i + 1 } as CSSProperties}>
            {step.ui}
            <div className="step-copy">
              <span className="step-num">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
