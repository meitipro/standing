import type { Assessment, Certificate, Stats, TimelineEntry, WatchRecord } from "./types";
import { IS_LIVE, STANDING, mapStats, readJson } from "./chain";
import { diffClaims } from "./claims";
import { VERDICTS, type Verdict } from "./limits";

/**
 * The read layer, for server components.
 *
 * Every read is one call to a view that returns a page of records as JSON, so
 * a screen costs a handful of requests however much is on chain. Reads are
 * cached for five seconds; no write path reads through here.
 */

const TTL_MS = 5000;

type Entry = { at: number; value: unknown };
const memo = new Map<string, Entry>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

/**
 * A read that must not take the page down with it. Logged rather than
 * swallowed, because "nothing recorded yet" and "cannot reach the chain" look
 * identical from outside and only one of them is normal.
 */
async function safely<T>(what: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!IS_LIVE) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error(`standing: chain read failed (${what}) at ${STANDING}:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapCert(raw: any): Certificate {
  return {
    id: Number(raw.id),
    url: String(raw.url ?? ""),
    kind: raw.kind === "contract" ? "contract" : "page",
    claims: (raw.claims ?? []).map((c: unknown) => String(c)),
    claimsDigest: String(raw.claims_digest ?? ""),
    cloaking: Boolean(raw.cloaking),
    at: String(raw.at ?? ""),
    requester: String(raw.requester ?? ""),
    watchId: raw.watch_id === null || raw.watch_id === undefined ? null : Number(raw.watch_id),
    previous: raw.previous === null || raw.previous === undefined ? null : Number(raw.previous),
  };
}

export function mapWatch(raw: any): WatchRecord {
  return {
    id: Number(raw.id),
    url: String(raw.url ?? ""),
    owner: String(raw.owner ?? ""),
    cadenceHours: Number(raw.cadence_hours ?? 0),
    unit: BigInt(raw.unit ?? 0),
    held: BigInt(raw.held ?? 0),
    capturesLeft: Number(raw.captures_left ?? 0),
    createdAt: String(raw.created_at ?? ""),
    lastChecked: String(raw.last_checked ?? ""),
    nextDue: String(raw.next_due ?? ""),
    active: Boolean(raw.active),
    certCount: Number(raw.cert_count ?? 0),
    lastCert: raw.last_cert === null || raw.last_cert === undefined ? null : Number(raw.last_cert),
    certs: (raw.certs ?? []).map((c: unknown) => Number(c)),
  };
}

export function mapAssessment(raw: any): Assessment {
  const verdict = String(raw.verdict ?? "");
  return {
    id: Number(raw.id),
    certA: Number(raw.cert_a),
    certB: Number(raw.cert_b),
    url: String(raw.url ?? ""),
    // The contract stores only these three. This is the boundary between a
    // string off the chain and a union type, so it is checked, not asserted.
    verdict: ((VERDICTS as readonly string[]).includes(verdict) ? verdict : "unclear") as Verdict,
    lines: (raw.lines ?? []).map((l: any) => ({
      id: String(l.id),
      record: l.record === "later" ? "later" : "earlier",
      claim: String(l.claim),
    })),
    at: String(raw.at ?? ""),
    requester: String(raw.requester ?? ""),
  };
}

/* ---------- the contract ---------- */

export async function getStats(): Promise<Stats | null> {
  return cached("stats", () => safely("stats", null as Stats | null, async () => mapStats(await readJson("stats"))));
}

/* ---------- certificates ---------- */

export async function getCertificate(id: number): Promise<Certificate | null> {
  return cached(`cert:${id}`, () =>
    safely(`certificate ${id}`, null as Certificate | null, async () => {
      const raw = await readJson("certificate", [id]);
      return raw ? mapCert(raw) : null;
    }),
  );
}

/** Newest first, which is the only order any screen asks for. */
export async function listCertificates(limit = 20): Promise<Certificate[]> {
  return cached(`list:${limit}`, () =>
    safely(`certificate list (${limit})`, [] as Certificate[], async () => {
      const stats = mapStats(await readJson("stats"));
      const count = Math.min(limit, 25);
      const start = Math.max(0, stats.certificates - count);
      const page = await readJson<{ items: any[] }>("certificates", [start, count]);
      return page.items.map(mapCert).reverse();
    }),
  );
}

export async function getCertificateByDigest(digest: string): Promise<Certificate | null> {
  const needle = digest.trim().toLowerCase();
  return cached(`digest:${needle}`, () =>
    safely(`digest ${needle}`, null as Certificate | null, async () => {
      const raw = await readJson("cert_for_digest", [needle]);
      return raw ? mapCert(raw) : null;
    }),
  );
}

/** The newest captures of one url, newest first, walked on chain through each certificate's link. */
export async function historyForUrl(url: string, count = 25): Promise<Certificate[]> {
  return cached(`history:${url}:${count}`, () =>
    safely(`history of ${url}`, [] as Certificate[], async () => {
      const page = await readJson<{ items: any[] }>("history", [url, count]);
      return page.items.map(mapCert);
    }),
  );
}

/**
 * A page's captures with the claim diff against the capture before each one,
 * oldest first. The oldest in the window is compared with its own previous
 * capture when it has one, so the first row is never a false "first capture".
 */
export async function getTimeline(url: string): Promise<TimelineEntry[]> {
  const newestFirst = await historyForUrl(url);
  const certs = [...newestFirst].reverse();
  const before = certs[0]?.previous != null ? await getCertificate(certs[0].previous) : null;
  return certs.map((cert, i) => {
    const prev = i > 0 ? certs[i - 1] : before;
    if (!prev) return { cert, added: [], removed: [], hasPrevious: false };
    const { gone, fresh } = diffClaims(prev.claims, cert.claims);
    return { cert, added: fresh, removed: gone, hasPrevious: true };
  });
}

/* ---------- assessments ---------- */

/** The network's judgment of the change between two captures, or null if nobody has asked. */
export async function assessmentForPair(certA: number, certB: number): Promise<Assessment | null> {
  return cached(`assess:${certA}:${certB}`, () =>
    safely(`assessment for ${certA}:${certB}`, null as Assessment | null, async () => {
      const raw = await readJson("assessment_for_pair", [certA, certB]);
      return raw ? mapAssessment(raw) : null;
    }),
  );
}

/* ---------- watches ---------- */

/** The newest watches, newest first. */
export async function listWatches(): Promise<WatchRecord[]> {
  return cached("watches", () =>
    safely("watch list", [] as WatchRecord[], async () => {
      const stats = mapStats(await readJson("stats"));
      const start = Math.max(0, stats.watches - 25);
      const page = await readJson<{ items: any[] }>("watches_page", [start, 25]);
      return page.items.map(mapWatch).reverse();
    }),
  );
}

export async function getWatch(id: number): Promise<WatchRecord | null> {
  return cached(`watch:${id}`, () =>
    safely(`watch ${id}`, null as WatchRecord | null, async () => {
      const raw = await readJson("watch_record", [id]);
      return raw ? mapWatch(raw) : null;
    }),
  );
}
