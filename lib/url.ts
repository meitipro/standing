/**
 * The contract's url guard, in the browser.
 *
 * contracts/standing.py refuses and normalises every url in `_check_url`
 * before a fee is taken. This is the same function written again, so the site
 * can refuse a url before anybody signs and send exactly the string the
 * contract will store. tests/parity holds the two together on every case
 * contracts/test_helpers.py prints.
 *
 * It follows Python's urlsplit rather than the browser's URL parser. The two
 * disagree about default ports, dot segments, percent-encoding and bracketed
 * hosts, and one disagreement is enough for a watch lookup to miss.
 *
 * A leaf module: it imports no sibling, so the parity test imports the real
 * file rather than a copy.
 */

export const MAX_URL = 2048;

export const REFUSALS = {
  R_URL_EMPTY: "that url is empty or too long",
  R_URL_CHARS: "a url is printable ascii with no spaces, percent-encode anything else",
  R_URL_BAD: "that is not a url the contract can read",
  R_URL_SCHEME: "only http and https pages can be notarised",
  R_URL_CREDENTIALS: "a url carrying credentials is not a public page",
  R_URL_HOST: "that url has no host",
  R_URL_PRIVATE: "that address is not reachable from the public internet",
} as const;

export type Refusal = keyof typeof REFUSALS;

export type Checked =
  | { ok: true; url: string }
  | { ok: false; refusal: Refusal; reason: string };

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "169.254.169.254",
  "metadata.google.internal",
  "instance-data",
];

const BLOCKED_PREFIXES = ["10.", "127.", "192.168.", "169.254.", "0."];

/** The characters Python's str.strip() removes, so trimming agrees with it. */
const PY_SPACE = new Set<number>([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0,
  0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
  0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
]);

function pyStrip(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && PY_SPACE.has(value.charCodeAt(start))) start += 1;
  while (end > start && PY_SPACE.has(value.charCodeAt(end - 1))) end -= 1;
  return value.slice(start, end);
}

const SCHEME_CHAR = /^[A-Za-z0-9+.-]$/;

/** urllib.parse.urlsplit, for the printable ascii this is ever handed. */
function split(url: string) {
  let scheme = "";
  let rest = url;
  const colon = rest.indexOf(":");
  if (colon > 0 && /^[A-Za-z]$/.test(rest[0])) {
    const candidate = rest.slice(0, colon);
    if ([...candidate].every((c) => SCHEME_CHAR.test(c))) {
      scheme = candidate.toLowerCase();
      rest = rest.slice(colon + 1);
    }
  }
  let netloc = "";
  if (rest.slice(0, 2) === "//") {
    let end = rest.length;
    for (const c of "/?#") {
      const at = rest.indexOf(c, 2);
      if (at >= 0) end = Math.min(end, at);
    }
    netloc = rest.slice(2, end);
    rest = rest.slice(end);
  }
  const hash = rest.indexOf("#");
  if (hash >= 0) rest = rest.slice(0, hash);
  let query = "";
  const mark = rest.indexOf("?");
  if (mark >= 0) {
    query = rest.slice(mark + 1);
    rest = rest.slice(0, mark);
  }
  return { scheme, netloc, path: rest, query };
}

function hostOf(netloc: string): string {
  const info = netloc.slice(netloc.lastIndexOf("@") + 1);
  const colon = info.indexOf(":");
  return (colon >= 0 ? info.slice(0, colon) : info).toLowerCase();
}

function isPrivate172(host: string): boolean {
  if (!host.startsWith("172.")) return false;
  const piece = host.split(".");
  if (piece.length < 2 || !/^[0-9]+$/.test(piece[1])) return false;
  const second = parseInt(piece[1], 10);
  return second >= 16 && second <= 31;
}

function refuse(refusal: Refusal): Checked {
  return { ok: false, refusal, reason: REFUSALS[refusal] };
}

/** Exactly what `_check_url` does: the stored url, or the refusal it raises. */
export function checkUrl(input: string): Checked {
  const raw = pyStrip(String(input));
  const length = [...raw].length;
  if (length === 0 || length > MAX_URL) return refuse("R_URL_EMPTY");
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x21 || code > 0x7e) return refuse("R_URL_CHARS");
  }
  const parts = split(raw);
  if (parts.netloc.includes("[") || parts.netloc.includes("]")) return refuse("R_URL_BAD");
  if (parts.scheme !== "http" && parts.scheme !== "https") return refuse("R_URL_SCHEME");
  if (parts.netloc.includes("@")) return refuse("R_URL_CREDENTIALS");
  const host = hostOf(parts.netloc);
  if (host === "") return refuse("R_URL_HOST");
  if (BLOCKED_HOSTS.includes(host) || BLOCKED_PREFIXES.some((p) => host.startsWith(p))) {
    return refuse("R_URL_PRIVATE");
  }
  if (host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    return refuse("R_URL_PRIVATE");
  }
  if (isPrivate172(host)) return refuse("R_URL_PRIVATE");
  const path = parts.path !== "" ? parts.path : "/";
  let rebuilt = `${parts.scheme}://${parts.netloc.toLowerCase()}${path}`;
  if (parts.query !== "") rebuilt += `?${parts.query}`;
  return { ok: true, url: rebuilt };
}

/**
 * What a person types, before the guard sees it. A bare host gets https:// in
 * front; anything that already names a scheme is left for the guard to judge.
 */
export function withScheme(input: string): string {
  const value = pyStrip(String(input));
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ? value : `https://${value}`;
}
