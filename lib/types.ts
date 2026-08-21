/** The shape the contract's `certificate(id)` view returns, in camel case. */
export type Certificate = {
  id: number;
  url: string;
  title: string;
  claims: string[];

  /** sha256 of the exact text window every validator re-hashed before agreeing. */
  textDigest: string;

  /**
   * sha256 of the leader's screenshot bytes. Leader attested, not consensus
   * checked — two browsers never produce identical pixels for one page. Every
   * surface that prints it has to say so.
   */
  shotDigest: string;

  cloaking: boolean;

  /**
   * The overlap threshold in force when this was issued, in basis points. NOT
   * the overlap achieved, and not a count of validators: a contract cannot see
   * either of those.
   */
  thresholdBps: number;

  textChars: number;
  statusCode: number;

  /** "2026-07-21T14:02:07", always UTC, always 19 characters. */
  at: string;

  requester: string;
  watchId: number;
  watched: boolean;

  /**
   * Transaction finality, which lives in the consensus layer rather than in
   * contract storage. A record is readable on acceptance and marked
   * provisional until this turns true.
   */
  finalized: boolean;
};

export type WatchRecord = {
  id: number;
  url: string;
  owner: string;
  cadenceHours: number;
  lastChecked: string;
  createdAt: string;
  credits: number;
  certIds: number[];
  active: boolean;
};

/** One capture in a watch timeline, against the capture before it. */
export type TimelineEntry = {
  cert: Certificate;
  added: string[];
  removed: string[];
  /** False for the first capture, which has nothing to compare against. */
  hasPrevious: boolean;
};

/**
 * The three answers the network can reach about a change between two captures.
 *
 * A claim diff can say two claims left and two arrived. It cannot say whether a
 * fee moved from one percent to five or whether the same fee was reworded, and
 * those are the same diff with opposite meanings.
 */
export type VerdictKind = "unchanged" | "reworded" | "material";

export type Assessment = {
  id: number;
  certA: number;
  certB: number;
  url: string;
  verdict: VerdictKind;
  summary: string;
  /** Only ever populated for a material verdict, each naming old and new. */
  changes: string[];
  at: string;
  requester: string;
};

export type WriteStage =
  | "idle"
  | "signing"
  | "sent"
  | "accepted"
  | "finalized"
  | "failed";
