import { getAddress } from "viem";

import { checkUrl, withScheme } from "./url";

/**
 * Deciding what each pasted line is.
 *
 * This is the rule that decides what somebody is about to pay for: a page
 * costs a capture, a contract a quarter of one, and a line read wrongly costs
 * a transaction that is refused after signing. Pages go through the same
 * guard the contract runs, so a line marked ready here is one the contract
 * accepts.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type Kind = "page" | "contract" | "bad";

export type Row = {
  raw: string;
  kind: Kind;
  /** The url the contract will store, or the checksummed address. */
  key: string;
  problem: string;
  /** Contracts only, filled in from the contract's own schema. */
  methods: string[];
  duplicate: boolean;
};

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

export function classify(raw: string): Row {
  const line = raw.trim();
  const base: Row = { raw: line, kind: "bad", key: line, problem: "", methods: [], duplicate: false };

  if (ADDRESS.test(line)) {
    return { ...base, kind: "contract", key: getAddress(line.toLowerCase()) };
  }

  /* 0x shaped but not forty hex is a mistyped address, not a url. Saying
   * "that is not a url" about it sends someone looking in the wrong place. */
  if (/^0x/i.test(line)) {
    return { ...base, problem: "A contract address is 0x and 40 hex characters. This is not." };
  }

  const checked = checkUrl(withScheme(line));
  if (!checked.ok) return { ...base, problem: sentence(checked.reason) };
  return { ...base, kind: "page", key: checked.url };
}

/**
 * Classify a whole paste, marking repeats rather than dropping them, so the
 * screen can still show the line and say why it will be skipped. Matching is
 * on the key, so one page written three ways is caught.
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
