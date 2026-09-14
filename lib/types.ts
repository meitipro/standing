import type { Verdict } from "./limits";

/** A certificate as the contract's `certificate(id)` view returns it, in camel case. */
export type Certificate = {
  id: number;
  /** The normalised page url, or genlayer:// and an address for a contract snapshot. */
  url: string;
  kind: "page" | "contract";
  /** Sorted for a page. In the order the views were read for a contract. */
  claims: string[];
  /** sha256 of the claims joined by newlines. Anyone can recompute it. */
  claimsDigest: string;
  /** The validators agreed the screenshot does not show what the text states. */
  cloaking: boolean;
  /** "2026-07-21T14:02:07", always UTC, always 19 characters. */
  at: string;
  requester: string;
  watchId: number | null;
  /** The previous certificate of the same url, or null for the first. */
  previous: number | null;
};

export type WatchRecord = {
  id: number;
  url: string;
  owner: string;
  cadenceHours: number;
  /** The capture price locked when the watch opened, in wei. */
  unit: bigint;
  /** Wei held for the watch's unspent captures. */
  held: bigint;
  capturesLeft: number;
  createdAt: string;
  /** Empty until the first capture. */
  lastChecked: string;
  /** Empty when the next capture is due immediately. */
  nextDue: string;
  active: boolean;
  certCount: number;
  lastCert: number | null;
  /** The watch's certificates, oldest first. Empty in a list read. */
  certs: number[];
};

/** One capture of a page, against the capture before it. */
export type TimelineEntry = {
  cert: Certificate;
  added: string[];
  removed: string[];
  /** False for the first capture, which has nothing to compare against. */
  hasPrevious: boolean;
};

export type AssessmentLine = {
  id: string;
  record: "earlier" | "later";
  claim: string;
};

export type Assessment = {
  id: number;
  certA: number;
  certB: number;
  url: string;
  verdict: Verdict;
  /** For a material verdict, the claims that carry the difference. */
  lines: AssessmentLine[];
  at: string;
  requester: string;
};

export type Stats = {
  owner: string;
  fee: bigint;
  assessFee: bigint;
  snapshotFee: bigint;
  feesAccrued: bigint;
  prepaidHeld: bigint;
  certificates: number;
  watches: number;
  assessments: number;
};

export type WriteStage = "idle" | "signing" | "sent" | "accepted" | "failed";
