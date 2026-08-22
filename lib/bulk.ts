import { normaliseUrl } from "./format";

/**
 * Deciding what each pasted line is.
 *
 * This lives here rather than inside the bulk screen because it is the rule
 * that decides what somebody is about to pay for: a line read as a page costs a
 * full capture, a line read as a contract costs a quarter of one, and a line
 * read wrongly costs a transaction that fails after signing. Logic with that
 * job should be testable without a browser.
 */

/** A contract address: 0x and exactly forty hex characters. */
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Hosts that resolve inside a validator's own network. Mirrors the contract. */
const PRIVATE_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254",
  "metadata.google.internal",
];

export type Kind = "page" | "contract" | "bad";

export type Row = {
  raw: string;
  kind: Kind;
  /** Normalised url, or a lowercased address — whatever the chain will key on. */
  key: string;
  problem: string;
  /** Contracts only, filled in later from the contract's own schema. */
  methods: string[];
  duplicate: boolean;
};

export function classify(raw: string): Row {
  const line = raw.trim();
  const base: Row = {
    raw: line,
    kind: "bad",
    key: line,
    problem: "",
    methods: [],
    duplicate: false,
  };

  if (ADDRESS.test(line)) {
    return { ...base, kind: "contract", key: line.toLowerCase() };
  }

  /* Anything 0x shaped but not forty hex is a mistyped address, not a url.
   * Telling someone "that is not a url" about an address they clearly pasted
   * as an address sends them looking in the wrong place. */
  if (/^0x/i.test(line)) {
    return {
      ...base,
      problem: "A contract address is 0x and 40 hex characters. This is not.",
    };
  }

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(line) ? line : `https://${line}`);
  } catch {
    return { ...base, problem: "Not a url and not a contract address." };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ...base, problem: "Only http and https pages can be notarised." };
  }
  if (u.username || u.password) {
    return {
      ...base,
      problem: "A url carrying credentials is not a public page.",
    };
  }

  const host = u.hostname.toLowerCase();
  if (
    PRIVATE_HOSTS.includes(host) ||
    /^(10\.|127\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  ) {
    return { ...base, problem: "Not reachable from the public internet." };
  }

  return { ...base, kind: "page", key: normaliseUrl(line) };
}

/**
 * Classify a whole paste, marking repeats.
 *
 * Duplicates are flagged rather than dropped so the screen can still show the
 * line and say why it will be skipped. Silently removing a line from a list
 * somebody is about to pay for is the wrong kind of helpful.
 *
 * Matching is on the normalised key, so the same page written three different
 * ways is caught — which is the whole reason this is not a Set of raw strings.
 */
export function classifyAll(text: string): Row[] {
  const seen = new Set<string>();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .map((line) => {
      const row = classify(line);
      if (row.kind !== "bad") {
        if (seen.has(row.key)) row.duplicate = true;
        else seen.add(row.key);
      }
      return row;
    });
}
