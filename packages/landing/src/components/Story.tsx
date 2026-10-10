import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Two conversations from Meridian, the demo workspace, word for word, in the
 * widget's own design: one Nexo answers from a help page, one it cannot
 * answer and hands to a person. The workspace name, accent and welcome are the
 * values its widget config serves. Built in HTML rather than shown as a
 * screenshot, so the text stays sharp at any size and the messages can arrive
 * in the order they happened.
 *
 * Every element is authored in its final state. A beat appears at its time, a
 * blip shows for a while and goes, and a fade starts visible and goes. With no
 * script, or with reduced motion, the page shows how each conversation ended.
 */
const WELCOME = "Hi! Ask me anything. I'll cite my sources, and you can talk to a human any time.";
const ORG = "Meridian (demo)";
const INITIALS = "MD";

type Timing = { t: number; d?: number };

function at({ t, d }: Timing): CSSProperties {
  return { "--t": `${t}ms`, ...(d ? { "--d": `${d}ms` } : {}) } as CSSProperties;
}

function Beat({ t, className = "", children }: { t: number; className?: string; children: ReactNode }) {
  return (
    <div className={`beat ${className}`} style={at({ t })}>
      {children}
    </div>
  );
}

function Typing({ t, d }: Timing) {
  return (
    <span className="chat-typing blip" style={at({ t, d })} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Status({ children, tone = "ok", className = "", timing }: { children: ReactNode; tone?: "ok" | "warn"; className?: string; timing?: Timing }) {
  return (
    <span className={`chat-status ${className}`} style={timing ? at(timing) : undefined}>
      <i className={tone} aria-hidden="true" />
      {children}
    </span>
  );
}

function Chat({ status, footer, children }: { status: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="chat" aria-hidden="true">
      <div className="chat-head">
        <span className="chat-avatar">{INITIALS}</span>
        <span className="chat-head-text">
          <span className="chat-title">{ORG} Support</span>
          <span className="chat-statuses">{status}</span>
        </span>
      </div>
      <div className="chat-thread">
        <div className="chat-ai">{WELCOME}</div>
        {children}
      </div>
      <div className="chat-foot">
        <div className="chat-composer">
          Ask a question…
          <span className="chat-send">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3m0 0L4 7m4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className="chat-meta">
          {footer}
          <span className="chat-powered">Powered by Nexo</span>
        </div>
      </div>
    </div>
  );
}

function TalkToPerson({ className = "", timing }: { className?: string; timing?: Timing }) {
  return (
    <span className={`chat-human ${className}`} style={timing ? at(timing) : undefined}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.75 13.5c.6-2.5 2.75-3.75 5.25-3.75s4.65 1.25 5.25 3.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      Talk to a person
    </span>
  );
}

function Launcher() {
  return (
    <span className="chat-launcher" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
        <path d="M5 7.25l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** When it knows: the Billing FAQ answers, at 0.96 confidence in the record. */
function Answered() {
  return (
    <Chat status={<Status>Usually replies instantly</Status>} footer={<TalkToPerson />}>
      <Beat t={500} className="chat-you">
        Do you offer a discount for annual billing?
      </Beat>
      <div className="chat-cell">
        <Typing t={1150} d={950} />
        <Beat t={2100} className="chat-ai">
          Annual billing is 2 months free compared to paying monthly. You can switch from Settings then Billing.
          <span className="chat-source beat" style={at({ t: 2500 })}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 1.75h4.25l2.75 2.75v7.75h-7z M7.75 1.75v2.75h2.75" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            Billing FAQ
          </span>
        </Beat>
      </div>
    </Chat>
  );
}

/** When it does not: 0.2 confidence, handed over, and Dana Reyes on the demo team replies. */
function HandedOver() {
  return (
    <Chat
      status={
        <>
          <Status className="fade" timing={{ t: 5000 }}>
            Usually replies instantly
          </Status>
          <Status tone="warn" className="blip" timing={{ t: 5000, d: 2200 }}>
            A person is joining you
          </Status>
          <Status className="beat" timing={{ t: 7200 }}>
            Chatting with a support specialist
          </Status>
        </>
      }
      footer={<TalkToPerson className="fade" timing={{ t: 5000 }} />}
    >
      <Beat t={3300} className="chat-you">
        Can I get a refund for the seats we didn&rsquo;t use last quarter?
      </Beat>
      <div className="chat-cell">
        <Typing t={3950} d={850} />
        <Beat t={4800} className="chat-ai">
          I don&rsquo;t have documentation about refunds for unused seats.
        </Beat>
      </div>
      <div className="chat-cell">
        <div className="chat-notice blip" style={at({ t: 5400, d: 1800 })}>
          <strong>Connecting you with a person</strong>A support specialist will reply right here.
        </div>
        <Beat t={7200} className="chat-person">
          <span className="chat-author">Support specialist</span>
          <span className="chat-bubble">Thanks for waiting. I&rsquo;ve looked into this and I&rsquo;m taking care of it now.</span>
        </Beat>
      </div>
      <Beat t={8300} className="chat-you">
        That worked, thank you.
      </Beat>
    </Chat>
  );
}

const SCENES = [
  {
    step: "1",
    title: "When Nexo knows the answer",
    body: "It replies straight away, and shows which of your help pages the answer came from.",
    chat: <Answered />,
  },
  {
    step: "2",
    title: "When it doesn't",
    body: "It says so instead of guessing, and someone from your team takes over in the same chat.",
    chat: <HandedOver />,
  },
];

export function Story() {
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Plays once, when most of the stage is in view, rather than when its top
   * edge first peeks in: the story is told to someone who is looking at it.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("play");
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="story-wrap" id="story" aria-label="Two real conversations">
      <div className="story reveal solo" ref={ref}>
        {SCENES.map((scene) => (
          <div className="scene" key={scene.step}>
            <div className="scene-copy">
              <span className="scene-step">{scene.step}</span>
              <div>
                <h2>{scene.title}</h2>
                <p>{scene.body}</p>
              </div>
            </div>
            <div className="chat-frame">
              {scene.chat}
              <Launcher />
            </div>
          </div>
        ))}
      </div>
      <p className="story-note">Two real conversations from Meridian, our demo company, word for word.</p>
    </section>
  );
}
