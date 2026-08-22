import type {
  Assessment,
  Certificate,
  TimelineEntry,
  WatchRecord,
} from "./types";
import { ORIGIN } from "./chain";

/**
 * The public JSON shape.
 *
 * Snake case, because it mirrors the contract's own view rather than this
 * site's internals, and a consumer should be able to read the same field names
 * off the chain directly if we disappear.
 */
export function certificateJson(cert: Certificate) {
  return {
    id: cert.id,
    url: cert.url,
    title: cert.title,
    claims: cert.claims,
    text_digest: cert.textDigest,
    shot_digest: cert.shotDigest,

    // Named, not implied. The screenshot digest is the leader's and the network
    // never compared it; saying so in the payload is the only way a consumer
    // who never reads our prose finds out.
    digest_attestation: {
      text_digest: "agreed — every validator recomputed it from the same bytes",
      shot_digest: "attested — the leader's image, not compared byte for byte",
    },

    cloaking: cert.cloaking,

    // Not a vote count, and not the overlap achieved. Neither is visible to a
    // contract.
    threshold_bps: cert.thresholdBps,

    text_chars: cert.textChars,
    status_code: cert.statusCode,
    at: `${cert.at}Z`,
    requester: cert.requester,
    watch_id: cert.watched ? cert.watchId : null,
    finalized: cert.finalized,
    proves:
      "Several independent validators saw these claims on this url at this time. Not that the claims are true.",
    url_html: `${ORIGIN}/c/${cert.id}`,
  };
}

/**
 * A verdict, as the chain holds it.
 *
 * `verdict` is the only field a consumer should branch on. It is the string
 * every validator had to reach independently before the transaction landed;
 * `summary` and `changes` are the explanation attached to it, agreed on
 * substance rather than word for word.
 */
export function assessmentJson(a: Assessment) {
  return {
    id: a.id,
    url: a.url,
    compared: { from_certificate: a.certA, to_certificate: a.certB },
    verdict: a.verdict,
    summary: a.summary,
    changes: a.changes,
    at: `${a.at}Z`,
    requester: a.requester,
    means: {
      unchanged: "Nothing of consequence differs between the two captures.",
      reworded:
        "The same facts, stated differently. A reader would act the same way.",
      material:
        "At least one fact a reader would act on is different between the two captures.",
    }[a.verdict],
    proves:
      "Several independent validators each compared the two captures and reached this verdict. It is a judgment about the change, not a claim that either capture is true.",
    url_html: `${ORIGIN}/c/${a.certB}`,
  };
}

export function watchJson(watch: WatchRecord, timeline: TimelineEntry[]) {
  return {
    id: watch.id,
    url: watch.url,
    owner: watch.owner,
    cadence_hours: watch.cadenceHours,
    created_at: `${watch.createdAt}Z`,
    last_checked: watch.lastChecked ? `${watch.lastChecked}Z` : null,
    credits_remaining: watch.credits,
    active: watch.active,
    captures: timeline.map((e) => ({
      certificate_id: e.cert.id,
      at: `${e.cert.at}Z`,
      text_digest: e.cert.textDigest,
      shot_digest: e.cert.shotDigest,
      cloaking: e.cert.cloaking,
      claims: e.cert.claims,
      added: e.added,
      removed: e.removed,
      changed: e.hasPrevious && (e.added.length > 0 || e.removed.length > 0),
    })),
    url_html: `${ORIGIN}/w/${watch.id}`,
  };
}
