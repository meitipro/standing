import { SAMPLE_MODE } from "@/lib/seed";

/**
 * Shown on every screen until a contract address is configured.
 *
 * This product exists because a convincing fake record is harmful. Serving
 * demonstration certificates without saying so, on a site whose entire purpose
 * is to be quoted as evidence, would be the exact thing it was built to stop.
 *
 * It sits above the masthead rather than inside the page so that it cannot be
 * scrolled past before the first record is read, and it is the one element on
 * the site that is inverted in both themes.
 */
export default function SampleBanner() {
  if (!SAMPLE_MODE) return null;
  return (
    <div className="slab">
      <div
        style={{
          maxWidth: "var(--shell)",
          margin: "0 auto",
          padding: "9px var(--pad)",
          display: "flex",
          gap: 14,
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: "var(--mono)",
          fontSize: 12,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            background: "var(--bg)",
            flex: "none",
          }}
        />
        <span>
          Sample data — the contract is not yet deployed. No record on this page
          is real.
        </span>
      </div>
    </div>
  );
}
