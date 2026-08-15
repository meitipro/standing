/**
 * Formatting is done by hand rather than with toLocaleString, because these
 * strings are rendered on the server and again in the browser, and any locale
 * or timezone difference between the two shows up as a hydration mismatch on
 * the one number the whole product is a claim about.
 *
 * Everything here is UTC. The certificate never shows a local time, because a
 * reader in another timezone would quote a different moment than the one the
 * validators agreed on.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-07-21T14:02:07" -> { d: "21 Jul 2026", t: "14:02:07" } */
export function splitStamp(at: string): { d: string; t: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(at ?? "");
  if (!m) return { d: at ?? "", t: "" };
  const [, y, mo, d, hh, mm, ss] = m;
  return {
    d: `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`,
    t: `${hh}:${mm}:${ss}`,
  };
}

/**
 * "2026-07-21T14:02:07" -> { d: "2026-07-21", t: "14:02:07" }
 *
 * The certificate hero and the share card print the date this way rather than
 * as "21 Jul 2026". A record that will be quoted in a filing should sort and
 * compare as a string, and there is exactly one way to read 2026-07-21 no
 * matter which side of the Atlantic the reader is on.
 */
export function splitIso(at: string): { d: string; t: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(at ?? "");
  if (!m) return { d: at ?? "", t: "" };
  return { d: m[1], t: m[2] };
}

/** "21 Jul 2026 · 14:02:07 UTC" */
export function formatStamp(at: string): string {
  const { d, t } = splitStamp(at);
  return t ? `${d} · ${t} UTC` : d;
}

/** "21 Jul 2026" */
export function formatDay(at: string): string {
  return splitStamp(at).d;
}

/** "9c41...e0f2" — enough to compare by eye, never enough to rely on. */
export function shortDigest(hex: string, head = 4, tail = 4): string {
  if (!hex) return "";
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}...${hex.slice(-tail)}`;
}

/** "0x7b2f...6b4d" */
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr ?? "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** "example.xyz/tokenomics", which is how a reader refers to a page. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.host}${path}${u.search}`;
  } catch {
    return url;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function formatCadence(hours: number): string {
  if (hours === 1) return "hourly";
  if (hours === 24) return "daily";
  if (hours === 168) return "weekly";
  if (hours === 720) return "monthly";
  if (hours % 24 === 0) return `every ${hours / 24} days`;
  return `every ${hours} hours`;
}

export function formatThreshold(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)} percent`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Whole days between two stamps. Used for "watched since" and for nothing that
 * has to be exact.
 */
export function daysBetween(a: string, b: string): number {
  const t1 = Date.parse(`${a}Z`);
  const t2 = Date.parse(`${b}Z`);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / 86400000));
}

/** "today", "1 day ago", "12 days ago". Never "0 days ago". */
export function agoLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function addHours(at: string, hours: number): string {
  const t = Date.parse(`${at}Z`);
  if (Number.isNaN(t)) return at;
  return new Date(t + hours * 3600000).toISOString().slice(0, 19);
}

/**
 * The same normalisation the contract's `_check_url` performs, done here so a
 * url the client sends and the url the contract stores are the same string.
 *
 * They have to match exactly, because both the watch index and the "which
 * certificate did I just create" lookup are keyed on the stored url. The
 * contract lowercases the host, gives an empty path a "/", keeps the query and
 * drops the fragment — the fragment never reaches a server, so leaving it on
 * would let one page look like two different ones.
 *
 * Throws on anything that is not a url. The contract refuses those too, with a
 * better message; this only has to avoid sending an obvious non-url.
 */
export function normaliseUrl(raw: string): string {
  const value = raw.trim();
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const u = new URL(withScheme);
  const path = u.pathname === "" ? "/" : u.pathname;
  return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
}

/** A sha256 hex digest, which is the only thing /verify will look up. */
export function isDigest(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}
