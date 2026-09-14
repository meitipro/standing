/* The mark: a square stamp with a clock inside it.
 *
 * Notary stamps are square, clocks are round, and the product is exactly the
 * intersection of the two.
 *
 * Drawn on a 24 unit grid with non scaling strokes so it holds at 16px, which
 * is the smallest size the mark is allowed to appear at alone. Clear space is
 * half the mark height on every side and is the caller's job.
 *
 * Two colours, not one: the stamp is the accent and the clock is ink. That
 * split is what stops it reading as a generic rounded-square app icon at a
 * glance, and it is why the hands are square capped: a round cap at 26px
 * turns the hour hand into a dot.
 */
export default function Mark({
  size = 26,
  frame = "var(--accent)",
  face = "var(--ink)",
}: {
  size?: number;
  frame?: string;
  face?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="2"
        stroke={frame}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="12"
        cy="12"
        r="6.6"
        stroke={face}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
      {/* Hands at 12 and 2. Two hands read as a clock at 16px; three do not. */}
      <path
        d="M12 7.6V12l3.1 2.2"
        stroke={face}
        strokeWidth="1.6"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
