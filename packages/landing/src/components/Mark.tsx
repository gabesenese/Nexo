export function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3 14V4l12 10V4"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Tick() {
  return (
    <span className="tick">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="m2.5 6.2 2.2 2.2L9.5 3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** The chip a primary call to action ends on, so the button reads as a way forward rather than a label. */
export function Arrow() {
  return (
    <span className="btn-chip" aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
