import type { Certificate, WatchRecord } from "./types";

/**
 * Demonstration records, used only while NEXT_PUBLIC_STANDING_ADDRESS is unset.
 *
 * They are deliberately built on the RFC 2606 example domains and every screen
 * that renders them says, in words, that they are samples. This product exists
 * because a convincing fake record is harmful, so it must not ship any — the
 * launch checklist's "ten real records seeded before any announcement" means
 * ten genuine captures, made by running the contract, not fourteen invented
 * ones dressed up to look genuine.
 *
 * The digests are real sha256 values over fixed strings, so /verify recomputes
 * and matches against them rather than pretending to.
 */

export const SAMPLE_MODE = !process.env.NEXT_PUBLIC_STANDING_ADDRESS;

const TERMS_BASE = [
  "accounts may be closed with 14 days notice",
  "arbitration venue is london",
  "fee is 1 percent",
  "governing law is england and wales",
  "refund window is 30 days",
];

const TERMS_AFTER_VENUE = [
  "accounts may be closed with 14 days notice",
  "arbitration venue is singapore",
  "fee is 1 percent",
  "governing law is england and wales",
];

const TERMS_AFTER_RETENTION = [
  "accounts may be closed with 14 days notice",
  "arbitration venue is singapore",
  "data is retained for 24 months",
  "fee is 1 percent",
  "governing law is england and wales",
];

const TERMS_AFTER_FEE = [
  "accounts may be closed with 14 days notice",
  "arbitration venue is singapore",
  "data is retained for 24 months",
  "fee is 2.5 percent",
  "governing law is england and wales",
];

const A_DESK = "0x7b2f4c8e19a05d3f6c1b84e27d9a0f5c3e816b4d";
const A_WATCH = "0x2d91f0a7c4b83e15d67a0928f3c5b41e70d8a692";
const A_PRESS = "0xc40b73e9a1d582f6470b3e19c8d25a7f61903b8e";

type Seed = Omit<Certificate, "textDigest" | "shotDigest"> & {
  textDigest: string;
  shotDigest: string;
};

const D: [string, string][] = [
  [
    "cff59f3c06f2c5efb2393c4b15f1f20fdb7e3ee79ed4a14603f37d55f54c2a4a",
    "a3c13d233f9c9344398703850ca1e44201a8bafa7f74c138a0c9c0e80f413eab",
  ],
  [
    "f76ca9b6dad4fe2b3fbd194f0e0400e2c6840f442a6e57f16c3eab62ac3b1a6a",
    "72620321b7f7b22202e75f70046bc707fc399e78543fa0cb61797210f4cbbdf3",
  ],
  [
    "7fda7baca05e4a2c3389c69687a8d1672388356111094d52f646b4c96d68e795",
    "1309154a87818630d0913300dd74d6ce9b9cd488bb077521e18006c5c74a16a4",
  ],
  [
    "9a9c4bb5e0550352b12d6f80e5e3850333bc6b70abc90c335b9d82d3915f8f3e",
    "aff544686af105b96e6eb93c2c2f55b39b679dc0bd57875682bc3994698e6045",
  ],
  [
    "92b78c68bb0c4f9ca446187b919b507b4dd4bff5ff63c6e8df84180dbfc8a59d",
    "79e4ef9136fd1933d35a0cc343cb70fc3487b148158c74758dce74d6e29238f3",
  ],
  [
    "6b70a750d6c1288a645c3121ad948429a66d44b2adeefb2679814cf68d140a3b",
    "5a41afb2f36bfad8514e9016fe1cd9197d42e4b2fdc2242215a6d03df235f0b9",
  ],
  [
    "b2d091f7ddb2b641b68fa7514afc4afa644a27f19e704d7fd8c70393521c7cbe",
    "685243e24a258aaf0c8d008239bc016961215c1dd4750f5b79f88b0e46af965b",
  ],
  [
    "63d6345352ef943bd18ec078234ebf60a8b65babf63ba5c0282e93a90d549c6c",
    "ee04c55def74295d5a9d5b500754ff120c4f093f3370e3ae2ff9f7645f8a9807",
  ],
  [
    "4b43b6b3cf7a6f8463c968ad2ccd4d2d70a0e73dc015d81e7082550d5bc30e93",
    "f484069fd4a215a74ae8d50be835da13237d0c0d000b2fd87a5ea8137facc941",
  ],
  [
    "dc1b62e6dcd4bad5b47619f3ae70118446d6a13eaed2cfb262a88de406c54a98",
    "796f0bea8ee7cff4200a368c4b862c6ee0c49cd5775a1ddb1a3b6be8471e5347",
  ],
  [
    "66dd1feb9e8c2f45b3a44feb70b1a77ecf3e4019211377e7b35a1c715a82af03",
    "8c99d1690295a1d09570c8263e0dc3a6dae8ac9a261deeed594ed41779663a3e",
  ],
  [
    "cd956bb5a2886d7123e1e42c681abbf5b854d8e20fe01b550530b1dea3472197",
    "e8d34fc972df949984e959e021c60f4ee31c8d1f3277dd8fd4840a8c3e80900d",
  ],
  [
    "b28c55ed0b18da25666286984203d07f2b9a55c05e40e9cc4faa11321f48ec3c",
    "0e498d5d862b92a80047aa0427cf5acc7f66910af893971b5cb17c7450572d3e",
  ],
  [
    "d02c1f2b3f2bff8a9f4555b4750da4a5ce1b221b9d9be533a5e6c2a1b9ae9be2",
    "f037cebb60e53d8d49d5a01a98103b1e3ba9d32d48ea48ad8c0d97ebaf2ee702",
  ],
];

function cert(
  id: number,
  url: string,
  title: string,
  at: string,
  claims: string[],
  extra: Partial<Certificate> = {}
): Certificate {
  return {
    id,
    url,
    title,
    claims,
    textDigest: D[id][0],
    shotDigest: D[id][1],
    cloaking: false,
    thresholdBps: 6000,
    textChars: 14000,
    statusCode: 200,
    at,
    requester: A_DESK,
    watchId: 0,
    watched: false,
    finalized: true,
    ...extra,
  };
}

const W = { watched: true, watchId: 0, requester: A_WATCH };

export const SEED_CERTS: Certificate[] = [
  cert(0, "https://example.com/terms", "Terms of Service — Example Co", "2026-06-09T09:14:22", TERMS_BASE, { ...W, textChars: 11840 }),
  cert(1, "https://example.com/terms", "Terms of Service — Example Co", "2026-06-16T09:14:51", TERMS_BASE, { ...W, textChars: 11840 }),
  cert(2, "https://example.xyz/tokenomics", "Tokenomics — Example Protocol", "2026-06-19T11:31:40", [
    "cliff is 12 months",
    "team allocation is 20 percent",
    "unlock is linear over 24 months",
  ], { watched: true, watchId: 1, textChars: 6420 }),
  cert(3, "https://example.com/terms", "Terms of Service — Example Co", "2026-06-23T09:15:03", TERMS_AFTER_VENUE, { ...W, textChars: 11602 }),
  cert(4, "https://example.com/terms", "Terms of Service — Example Co", "2026-06-30T09:14:37", TERMS_AFTER_VENUE, { ...W, textChars: 11602 }),
  cert(5, "https://example.net/pricing", "Pricing — Example Cloud", "2026-07-02T16:45:09", [
    "enterprise plan is 400 dollars per month",
    "free tier includes 1000 requests per month",
    "overage is billed at 2 dollars per thousand requests",
    "pro plan is 40 dollars per month",
  ], { watched: true, watchId: 2, requester: A_PRESS, textChars: 4980 }),
  cert(6, "https://example.com/terms", "Terms of Service — Example Co", "2026-07-07T09:15:12", TERMS_AFTER_VENUE, { ...W, textChars: 11602 }),
  cert(7, "https://example.com/terms", "Terms of Service — Example Co", "2026-07-14T09:14:58", TERMS_AFTER_RETENTION, { ...W, textChars: 11907 }),
  cert(8, "https://example.org/status", "System Status — Example Org", "2026-07-19T22:08:44", [
    "all systems operational",
    "no incidents reported in the last 90 days",
  ], {
    // The most valuable line the product can produce: the rendered image did
    // not show what the text said.
    cloaking: true,
    requester: A_PRESS,
    textChars: 2140,
  }),
  cert(9, "https://example.com/terms", "Terms of Service — Example Co", "2026-07-21T09:15:26", TERMS_AFTER_FEE, { ...W, textChars: 11913 }),
  cert(10, "https://example.xyz/tokenomics", "Tokenomics — Example Protocol", "2026-07-21T14:02:07", [
    "cliff is 12 months",
    "no lockup applies to ecosystem funds",
    "team allocation is 12 percent",
    "unlock is linear over 36 months",
  ], { watched: true, watchId: 1, textChars: 6884 }),
  cert(11, "https://docs.example.com/rate-limits", "Rate limits — Example API", "2026-07-24T08:20:15", [
    "burst limit is 100 requests per second",
    "limits reset at midnight utc",
    "rate limit is 10000 requests per hour",
  ], { requester: A_PRESS, textChars: 3312 }),
  cert(12, "https://example.xyz/roadmap", "Roadmap — Example Protocol", "2026-07-26T13:37:02", [
    "audit is scheduled for the fourth quarter",
    "mainnet launch is planned for september 2026",
    "staking opens after the audit completes",
  ], { textChars: 5106 }),
  // Accepted but not yet finalized, so the provisional state has something to
  // render.
  cert(13, "https://example.com/terms", "Terms of Service — Example Co", "2026-07-28T09:14:44", TERMS_AFTER_FEE, {
    ...W,
    textChars: 11913,
    finalized: false,
  }),
];

export const SEED_WATCHES: WatchRecord[] = [
  {
    id: 0,
    url: "https://example.com/terms",
    owner: A_WATCH,
    cadenceHours: 168,
    lastChecked: "2026-07-28T09:14:44",
    createdAt: "2026-06-09T09:12:00",
    credits: 34,
    certIds: [0, 1, 3, 4, 6, 7, 9, 13],
    active: true,
  },
  {
    id: 1,
    url: "https://example.xyz/tokenomics",
    owner: A_DESK,
    cadenceHours: 720,
    lastChecked: "2026-07-21T14:02:07",
    createdAt: "2026-06-19T11:30:00",
    credits: 6,
    certIds: [2, 10],
    active: true,
  },
  {
    id: 2,
    url: "https://example.net/pricing",
    owner: A_PRESS,
    cadenceHours: 720,
    lastChecked: "2026-07-02T16:45:09",
    createdAt: "2026-07-02T16:44:00",
    credits: 0,
    certIds: [5],
    active: false,
  },
];
