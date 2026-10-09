import type { CSSProperties } from "react";
import { Tick } from "./Mark";

/**
 * What the team sees, as the real console on the demo workspace, captured by
 * scripts/capture-showcase.mjs. One panel per row, cropped tight and shown
 * near its own size, so the text in the picture reads at the size it reads in
 * the product rather than as a thumbnail of a whole screen.
 */
type Shot = { name: string; width: number; height: number; alt: string };

type Row = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  shot: Shot;
};

const ROWS: Row[] = [
  {
    eyebrow: "For your team",
    title: "Every handoff arrives with the whole story.",
    body:
      "When Nexo passes a chat to your team, it says why. Whoever picks it up sees what the customer asked and what Nexo found, and can answer straight away.",
    points: [
      "Why it was handed over, in plain words",
      "The customer's question, quoted back",
      "Claim it, reply and close it from one inbox",
    ],
    shot: {
      name: "escalate",
      width: 702,
      height: 502,
      alt: "A chat handed to the team in the Nexo inbox: the reason is that the customer asked for a person, their words are quoted, and the conversation sits underneath, ready to claim",
    },
  },
  {
    eyebrow: "Getting better",
    title: "Find out what your help pages are missing.",
    body:
      "Nexo collects every question it couldn't answer and groups them, most asked first. Write the missing page, and Nexo can answer it next time.",
    points: [
      "Grouped by topic, most asked first",
      "The closest page Nexo found, and why it fell short",
      "Add the page, and Nexo uses it the next time someone asks",
    ],
    shot: {
      name: "gaps",
      width: 702,
      height: 460,
      alt: "Knowledge gaps ranked by how often each one sent a chat to a person, with how many times it was asked and the closest help page",
    },
  },
];

function Picture({ shot }: { shot: Shot }) {
  return (
    <>
      <img
        className="shot-img theme-light"
        src={`/product/${shot.name}-light.png`}
        width={shot.width}
        height={shot.height}
        loading="lazy"
        alt={shot.alt}
      />
      <img
        className="shot-img theme-dark"
        src={`/product/${shot.name}-dark.png`}
        width={shot.width}
        height={shot.height}
        loading="lazy"
        alt={shot.alt}
      />
    </>
  );
}

export function FeatureRows() {
  return (
    <div className="wrap rows" id="team">
      {ROWS.map((row, i) => (
        <section className={`row reveal${i % 2 ? " flip" : ""}`} key={row.eyebrow}>
          <div className="row-copy" style={{ "--i": 0 } as CSSProperties}>
            <p className="eyebrow">{row.eyebrow}</p>
            <h2>{row.title}</h2>
            <p className="row-body">{row.body}</p>
            <ul className="points">
              {row.points.map((point) => (
                <li key={point}>
                  <Tick />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <figure className="frame" style={{ "--i": 1 } as CSSProperties}>
            <Picture shot={row.shot} />
          </figure>
        </section>
      ))}
    </div>
  );
}
