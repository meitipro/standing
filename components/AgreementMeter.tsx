import { formatThreshold } from "@/lib/format";

/**
 * The threshold this capture had to clear.
 *
 * It deliberately does NOT say "4 of 5 validators matched", which is what the
 * brief's screens print. A contract cannot see how many validators agreed or by
 * how much — that lives in the consensus layer and never reaches contract
 * storage. Printing a vote count here would mean inventing one, on the one
 * screen whose entire job is to be quotable.
 *
 * What is true, and what this shows: the claim sets had to overlap by at least
 * this much, the capture cleared it, and the number was on chain when the
 * certificate was issued. The bar is filled to the requirement and marked at
 * it, so it reads as a bar someone got over rather than as a score.
 */
export default function AgreementMeter({
  thresholdBps,
}: {
  thresholdBps: number;
}) {
  const pct = Math.max(0, Math.min(100, thresholdBps / 100));
  return (
    <div>
      <div
        className="meter"
        role="img"
        aria-label={`Required claim overlap ${formatThreshold(
          thresholdBps
        )}, cleared`}
      >
        <span className="meter-fill" style={{ width: `${pct}%` }} />
        <span className="meter-mark" style={{ left: `${pct}%` }} />
      </div>
      <div className="meter-legend">
        <span>required overlap {thresholdBps} bps</span>
        <span style={{ color: "var(--accent)" }}>cleared</span>
      </div>
      <p
        className="small muted pretty"
        style={{ marginTop: 12, lineHeight: 1.5 }}
      >
        This is the overlap threshold the capture cleared. It is not a vote
        count — the contract cannot see how many validators agreed, only that
        the threshold was met.
      </p>
    </div>
  );
}
