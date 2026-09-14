/**
 * Formatting by hand rather than with toLocaleString. These strings render on
 * the server and again in the browser, and a locale or timezone difference
 * between the two is a hydration mismatch on the one value the product is
 * about.
 *
 * Everything is UTC. A certificate never shows a local time, because a reader
 * in another timezone would quote a different moment from the one recorded.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-07-21T14:02:07" becomes { d: "21 Jul 2026", t: "14:02:07" }. */
export function splitStamp(at: string): { d: string; t: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(at ?? "");
  if (!m) return { d: at ?? "", t: "" };
  const [, y, mo, d, hh, mm, ss] = m;
  return { d: `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`, t: `${hh}:${mm}:${ss}` };
}

/**
 * "2026-07-21T14:02:07" becomes { d: "2026-07-21", t: "14:02:07" }. The
 * certificate and the share card print dates this way: a record that will be
 * quoted in a filing should sort as a string and read one way everywhere.
 */
export function splitIso(at: string): { d: string; t: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(at ?? "");
  if (!m) return { d: at ?? "", t: "" };
  return { d: m[1], t: m[2] };
}

/** "21 Jul 2026, 14:02:07 UTC" */
export function formatStamp(at: string): string {
  const { d, t } = splitStamp(at);
  return t ? `${d}, ${t} UTC` : d;
}

/** "21 Jul 2026" */
export function formatDay(at: string): string {
  return splitStamp(at).d;
}

/** "9c41...e0f2": enough to compare by eye, and visibly cut. */
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
  if (url.startsWith("genlayer://")) return `contract ${shortAddress(url.slice(11))}`;
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.host}${path}${u.search}`;
  } catch {
    return url;
  }
}

export function formatCadence(hours: number): string {
  if (hours === 1) return "hourly";
  if (hours === 24) return "daily";
  if (hours === 168) return "weekly";
  if (hours === 720) return "every 30 days";
  if (hours % 24 === 0) return `every ${hours / 24} days`;
  return `every ${hours} hours`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** The current moment in the contract's own format, for due dates. */
export function nowStamp(): string {
  return new Date().toISOString().slice(0, 19);
}

/** Whole days between two stamps, for "watched since" and nothing exact. */
export function daysBetween(a: string, b: string): number {
  const t1 = Date.parse(`${a}Z`);
  const t2 = Date.parse(`${b}Z`);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / 86400000));
}

/** "today", "1 day ago", "12 days ago". */
export function agoLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** A sha256 hex digest, which is what /verify looks up. */
export function isDigest(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}

/**
 * Wei as GEN, exactly, to six decimals. Bigint throughout: a price read from
 * the contract is larger than a float carries without rounding.
 */
export function formatGen(wei: bigint): string {
  const unit = 10n ** 18n;
  const whole = wei / unit;
  const frac = (wei % unit).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  const out = frac ? `${whole}.${frac}` : `${whole}`;
  return out === "0" && wei > 0n ? `${wei} wei` : out;
}
