/**
 * One mark. This shape was copy-pasted into seven files, each with its own
 * baked hex, which is why the two sidebar copies had drifted to different
 * colours. It takes a token so it follows the theme; callers sitting on the
 * ivory badge pass the ink that badge needs, since that ground never changes.
 */
export function Mark({ size = 18, stroke = "var(--accent)" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d={"M3 14V4l12 10V4"}
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
