const STEPS = [
  {
    n: "01",
    title: "Teach Nexo",
    body: "Point it at what you already have. Fetched, chunked, embedded.",
    img: "/showcase/teach.png",
    alt: "Nexo Knowledge page showing an ingested help-center source, ready to answer from",
  },
  {
    n: "02",
    title: "Nexo answers",
    body: "Grounded in your knowledge. Sourced, every time.",
    img: "/showcase/answer.png",
    alt: "A real Nexo conversation answering a billing question with a citation and confidence score",
  },
  {
    n: "03",
    title: "Nexo knows when to stop",
    body: "Low confidence means a handoff, not a guess.",
    img: "/showcase/escalate.png",
    alt: "A real escalated Nexo conversation with a human agent's reply",
  },
  {
    n: "04",
    title: "Your team sees everything",
    body: "Every conversation. Every escalation. Every reason why.",
    img: "/showcase/operate.png",
    alt: "The real Nexo dashboard showing conversation totals, resolution rate, and recent escalations",
  },
];

export function MeetNexo() {
  return (
    <section className="l-section meet-section">
      <div className="meet-head">
        <span className="l-eyebrow">Meet Nexo</span>
        <h2>From the first customer question to the moment a human takes over.</h2>
        <p>
          This isn't a mockup. It's a real Nexo workspace: a real imported document, a real AI answer, a real
          escalation, and a real reply.
        </p>
      </div>
      <div className="meet-steps">
        {STEPS.map((step) => (
          <div className="meet-step" key={step.n}>
            <div className="meet-step-text">
              <div className="meet-step-n">{step.n}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
            <div className="meet-step-shot">
              <img src={step.img} alt={step.alt} loading="lazy" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
