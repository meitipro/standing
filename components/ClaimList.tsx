/**
 * Numbered claims, with a diff mode used by the certificate and the watch
 * timelines.
 *
 * Claims arrive normalised and sorted from the contract, which is what makes
 * the diff a set operation rather than a text comparison.
 */
export default function ClaimList({ claims, dense = false }: { claims: string[]; dense?: boolean }) {
  if (claims.length === 0) {
    return <p className="muted small">No claims were recorded.</p>;
  }
  return (
    <ol className={dense ? "claims claims-dense" : "claims"}>
      {claims.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ol>
  );
}

export function ClaimDiff({
  added,
  removed,
  unchangedNote = "claim set identical to the previous capture",
}: {
  added: string[];
  removed: string[];
  unchangedNote?: string;
}) {
  if (added.length === 0 && removed.length === 0) {
    return <p className="small muted">{unchangedNote}</p>;
  }
  return (
    <ul className="claims diff">
      {added.map((c) => (
        <li key={`+${c}`} data-diff="added">
          <span className="sign" aria-hidden="true">
            +
          </span>
          <span className="text">{c}</span>
        </li>
      ))}
      {removed.map((c) => (
        <li key={`-${c}`} data-diff="removed">
          <span className="sign" aria-hidden="true">
            -
          </span>
          <span className="text">{c}</span>
        </li>
      ))}
    </ul>
  );
}
