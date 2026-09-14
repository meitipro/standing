/**
 * The contract's limits, for the screens that have to respect them before
 * anyone signs. Every value is compared with contracts/standing.py by
 * tests/parity, so tightening one there fails here until this follows.
 *
 * A leaf module, so the parity test imports the real file.
 */

export const LIMITS = {
  MIN_CLAIMS: 2,
  MAX_CLAIMS: 6,
  MIN_FEE: 4,
  ASSESS_DIVISOR: 2,
  SNAPSHOT_DIVISOR: 4,
  MIN_CADENCE_HOURS: 1,
  MAX_CADENCE_HOURS: 720,
  MIN_WATCH_CAPTURES: 4,
  MAX_WATCH_CAPTURES: 400,
  MAX_BULK_TARGETS: 10,
  MAX_STATE_METHODS: 8,
  MAX_PAGE: 25,
  CONTRACT_SCHEME: "genlayer://",
} as const;

/** What an assessment can store. The model itself only ever answers the first two. */
export const VERDICTS = ["material", "immaterial", "unclear"] as const;

export type Verdict = (typeof VERDICTS)[number];
