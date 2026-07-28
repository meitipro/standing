import type { Certificate, TimelineEntry, WatchRecord } from "./types";
import { SEED_CERTS, SEED_WATCHES, SAMPLE_MODE } from "./seed";
import { IS_LIVE, STANDING, readClient } from "./chain";

/**
 * The read layer.
 *
 * Reads are cached for a few seconds. Nothing in the product depends on the
 * cache for correctness — a stale read shows an older certificate list, which
 * is a cosmetic bug. No write path reads through here.
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

/* eslint-disable @typescript-eslint/no-explicit-any */

function toNum(v: any): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v ?? 0);
}

/** The contract's `certificate(id)` dict, in the shape the screens want. */
function mapCert(raw: any, id: number): Certificate {
  return {
    id: toNum(raw?.id ?? id),
    url: String(raw?.url ?? ""),
    title: String(raw?.title ?? ""),
    claims: (raw?.claims ?? []).map((c: any) => String(c)),
    textDigest: String(raw?.text_digest ?? ""),
    shotDigest: String(raw?.shot_digest ?? ""),
    cloaking: Boolean(raw?.cloaking),
    thresholdBps: toNum(raw?.threshold_bps),
    textChars: toNum(raw?.text_chars),
    statusCode: toNum(raw?.status_code),
    at: String(raw?.at ?? ""),
    requester: String(raw?.requester ?? ""),
    watchId: toNum(raw?.watch_id),
    watched: Boolean(raw?.watched),
    // Finality lives in the consensus layer, not in contract storage. Until the
    // indexer is wired to transaction status, a record that is readable is
    // reported as provisional rather than claimed as final.
    finalized: false,
  };
}

function mapWatch(raw: any, id: number): WatchRecord {
  return {
    id: toNum(raw?.id ?? id),
    url: String(raw?.url ?? ""),
    owner: String(raw?.owner ?? ""),
    cadenceHours: toNum(raw?.cadence_hours),
    lastChecked: String(raw?.last_checked ?? ""),
    createdAt: String(raw?.created_at ?? ""),
    credits: toNum(raw?.credits),
    certIds: (raw?.cert_ids ?? []).map((c: any) => toNum(c)),
    active: Boolean(raw?.active),
  };
}

async function read(functionName: string, args: any[] = []): Promise<any> {
  const client = readClient();
  return client.readContract({ address: STANDING, functionName, args });
}

/* ---------- certificates ---------- */

export async function totalCerts(): Promise<number> {
  if (!IS_LIVE) return SEED_CERTS.length;
  return cached("total", async () => toNum(await read("total_certs")));
}

export async function getCertificate(id: number): Promise<Certificate | null> {
  if (!IS_LIVE) return SEED_CERTS.find((c) => c.id === id) ?? null;
  return cached(`cert:${id}`, async () => {
    try {
      return mapCert(await read("certificate", [id]), id);
    } catch {
      return null;
    }
  });
}

/** Newest first, which is the only order any screen asks for. */
export async function listCertificates(limit = 20): Promise<Certificate[]> {
  if (!IS_LIVE) return [...SEED_CERTS].reverse().slice(0, limit);
  return cached(`list:${limit}`, async () => {
    const total = toNum(await read("total_certs"));
    const ids: number[] = [];
    for (let i = total - 1; i >= 0 && ids.length < limit; i--) ids.push(i);
    const out = await Promise.all(
      ids.map(async (i) => {
        try {
          return mapCert(await read("certificate", [i]), i);
        } catch {
          return null;
        }
      })
    );
    return out.filter((c): c is Certificate => c !== null);
  });
}

export async function getCertificateByDigest(
  digest: string
): Promise<Certificate | null> {
  const needle = digest.trim().toLowerCase();
  if (!IS_LIVE) {
    return (
      SEED_CERTS.find(
        (c) => c.textDigest === needle || c.shotDigest === needle
      ) ?? null
    );
  }
  return cached(`digest:${needle}`, async () => {
    try {
      const id = toNum(await read("cert_for_digest", [needle]));
      // The contract answers with max u256 for a digest it has never seen,
      // because zero is a real certificate id.
      if (!Number.isFinite(id) || id < 0 || id > 1e15) return null;
      return mapCert(await read("certificate", [id]), id);
    } catch {
      return null;
    }
  });
}

/** Every capture of the same url, oldest first. Drives the "changed since" line. */
export async function historyForUrl(url: string): Promise<Certificate[]> {
  const all = IS_LIVE ? await listCertificates(200) : SEED_CERTS;
  return all.filter((c) => c.url === url).sort((a, b) => a.at.localeCompare(b.at));
}

/* ---------- watches ---------- */

export async function listWatches(): Promise<WatchRecord[]> {
  if (!IS_LIVE) return SEED_WATCHES;
  return cached("watches", async () => {
    const total = toNum(await read("total_watches"));
    const out = await Promise.all(
      Array.from({ length: total }, async (_, i) => {
        try {
          return mapWatch(await read("watch_record", [i]), i);
        } catch {
          return null;
        }
      })
    );
    return out.filter((w): w is WatchRecord => w !== null);
  });
}

export async function getWatch(id: number): Promise<WatchRecord | null> {
  if (!IS_LIVE) return SEED_WATCHES.find((w) => w.id === id) ?? null;
  return cached(`watch:${id}`, async () => {
    try {
      return mapWatch(await read("watch_record", [id]), id);
    } catch {
      return null;
    }
  });
}

/**
 * A watch's captures with the claim diff against the one before.
 *
 * The contract emits the same two lists on every scheduled capture, so an
 * indexer would serve this directly. Recomputing it here keeps the site working
 * against a bare node with no indexer behind it, and the set operations are
 * only meaningful because claims are stored normalised and sorted.
 */
export async function getTimeline(watchId: number): Promise<TimelineEntry[]> {
  const w = await getWatch(watchId);
  if (!w) return [];

  const certs = (
    await Promise.all(w.certIds.map((id) => getCertificate(id)))
  ).filter((c): c is Certificate => c !== null);

  certs.sort((a, b) => a.at.localeCompare(b.at));

  return certs.map((cert, i) => {
    const prev = i > 0 ? new Set(certs[i - 1].claims) : new Set<string>();
    const now = new Set(cert.claims);
    return {
      cert,
      added: i > 0 ? [...now].filter((c) => !prev.has(c)).sort() : [],
      removed: i > 0 ? [...prev].filter((c) => !now.has(c)).sort() : [],
      hasPrevious: i > 0,
    };
  });
}

/* ---------- headline numbers ---------- */

export type Stats = {
  certificates: number;
  watches: number;
  cloakingFlags: number;
  sample: boolean;
};

export async function getStats(): Promise<Stats> {
  const [certs, watches] = await Promise.all([
    listCertificates(200),
    listWatches(),
  ]);
  return {
    certificates: await totalCerts(),
    watches: watches.filter((w) => w.active).length,
    cloakingFlags: certs.filter((c) => c.cloaking).length,
    sample: SAMPLE_MODE,
  };
}
