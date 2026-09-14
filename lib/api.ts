import type { Assessment, Certificate, TimelineEntry, WatchRecord } from "./types";
import { ORIGIN } from "./chain";

/**
 * The public JSON shape.
 *
 * Snake case, because it mirrors the contract's own views, and a consumer
 * should be able to read the same field names off the chain directly.
 */

const RECORDS = {
  page:
    "Independent validators each read this url at this time and confirmed every claim below against their own copy of the page.",
  contract:
    "Every validator read these views of that contract at this time and computed the same lines.",
};

export function certificateJson(cert: Certificate) {
  return {
    id: cert.id,
    url: cert.url,
    kind: cert.kind,
    claims: cert.claims,
    claims_digest: cert.claimsDigest,
    cloaking: cert.cloaking,
    at: `${cert.at}Z`,
    requester: cert.requester,
    watch_id: cert.watchId,
    previous: cert.previous,
    records: RECORDS[cert.kind],
    url_html: `${ORIGIN}/c/${cert.id}`,
  };
}

const MEANS = {
  material:
    "The two captures state different values for the same fact, and a reader would act differently because of it.",
  immaterial: "No claim in one capture contradicts a claim in the other in a way a reader would act on.",
  unclear:
    "The model gave different answers when the two captures were shown in opposite orders, so neither answer was stored.",
};

export function assessmentJson(a: Assessment) {
  return {
    id: a.id,
    url: a.url,
    compared: { from_certificate: a.certA, to_certificate: a.certB },
    verdict: a.verdict,
    lines: a.lines,
    at: `${a.at}Z`,
    requester: a.requester,
    means: MEANS[a.verdict],
    url_html: `${ORIGIN}/c/${a.certB}`,
  };
}

export function watchJson(watch: WatchRecord, timeline: TimelineEntry[]) {
  return {
    id: watch.id,
    url: watch.url,
    owner: watch.owner,
    cadence_hours: watch.cadenceHours,
    unit_wei: watch.unit.toString(),
    held_wei: watch.held.toString(),
    captures_left: watch.capturesLeft,
    created_at: `${watch.createdAt}Z`,
    last_checked: watch.lastChecked ? `${watch.lastChecked}Z` : null,
    next_due: watch.nextDue ? `${watch.nextDue}Z` : null,
    active: watch.active,
    certificates: watch.certs,
    page_history: timeline.map((e) => ({
      certificate_id: e.cert.id,
      taken_by_this_watch: e.cert.watchId === watch.id,
      at: `${e.cert.at}Z`,
      claims_digest: e.cert.claimsDigest,
      cloaking: e.cert.cloaking,
      claims: e.cert.claims,
      added: e.added,
      removed: e.removed,
    })),
    url_html: `${ORIGIN}/w/${watch.id}`,
  };
}
