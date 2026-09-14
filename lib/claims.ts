/**
 * Claim sets as the contract handles them: the digest it stores, and the
 * difference between two captures it judges.
 *
 * `claimsDigest` is `_claims_digest` and `diffClaims` is `_diff`. The verify
 * page recomputes a certificate's digest with the first, and the certificate
 * and watch pages show the second. Both are held to the Python by
 * tests/parity, including the ordering of characters outside the basic plane,
 * where JavaScript's default sort and Python's sorted() disagree.
 *
 * A leaf module, so the parity test imports the real file.
 */

/** Python's string order: by code point, not by UTF-16 unit. */
export function comparePy(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i += 1) {
    const d = (x[i].codePointAt(0) ?? 0) - (y[i].codePointAt(0) ?? 0);
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

export function sortPy(items: readonly string[]): string[] {
  return [...items].sort(comparePy);
}

/** The claims only the earlier capture has, and those only the later has. */
export function diffClaims(
  before: readonly string[],
  after: readonly string[],
): { gone: string[]; fresh: string[] } {
  const a = new Set(before);
  const b = new Set(after);
  return {
    gone: sortPy([...a].filter((c) => !b.has(c))),
    fresh: sortPy([...b].filter((c) => !a.has(c))),
  };
}

/** sha256 of the claims joined by newlines, as hex. */
export async function claimsDigest(claims: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(claims.join("\n"));
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
