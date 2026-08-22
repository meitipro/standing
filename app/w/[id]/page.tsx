import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClaimDiff } from "@/components/ClaimList";
import CopyButton from "@/components/CopyButton";
import ChangeVerdict from "@/components/ChangeVerdict";
import { assessmentForPair, getTimeline, getWatch } from "@/lib/store";
import {
  agoLabel,
  daysBetween,
  displayUrl,
  formatCadence,
  formatDay,
  formatStamp,
  shortAddress,
  splitStamp,
} from "@/lib/format";
import { SAMPLE_MODE } from "@/lib/seed";
import type { Assessment, TimelineEntry } from "@/lib/types";

export const revalidate = 5;

const TODAY = "2026-07-28T12:00:00";

type Params = { params: { id: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const w = await getWatch(Number(params.id));
  if (!w) return { title: "Watch not found" };
  return {
    title: `${displayUrl(w.url)} — watch timeline`,
    description: `Every capture of ${displayUrl(
      w.url
    )}, with the claims that were added and removed between them.`,
  };
}

/**
 * When each claim first appeared and when it stopped appearing.
 *
 * This is the reading a timeline is actually for: not "something changed on the
 * 23rd", but "the refund window was there until the 23rd and has not been back".
 */
type LedgerRow = {
  claim: string;
  first: string;
  last: string;
  present: boolean;
};

function ledger(timeline: TimelineEntry[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const index: Record<string, LedgerRow> = {};

  for (const entry of timeline) {
    const here = new Set(entry.cert.claims);

    for (const claim of entry.cert.claims) {
      const row = index[claim];
      if (row) {
        row.last = entry.cert.at;
        row.present = true;
      } else {
        const fresh = {
          claim,
          first: entry.cert.at,
          last: entry.cert.at,
          present: true,
        };
        index[claim] = fresh;
        rows.push(fresh);
      }
    }

    // "last" is the last capture the claim appeared in, so it is not advanced
    // for a claim that has gone. That is what makes the removed rows readable
    // as "there until this date".
    for (const row of rows) {
      if (!here.has(row.claim)) row.present = false;
    }
  }

  return rows.sort(
    (a, b) =>
      Number(b.present) - Number(a.present) || a.claim.localeCompare(b.claim)
  );
}

export default async function WatchTimeline({ params }: Params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) notFound();

  const watch = await getWatch(id);
  if (!watch) notFound();

  const timeline = await getTimeline(id);
  /* Captures whose claim set differs from the one before. Deliberately not
   * called "material": that word now names one specific verdict the network
   * can reach, and using it for "any edit at all" would promise a judgment the
   * number has not been through. */
  const changes = timeline.filter(
    (e) => e.hasPrevious && (e.added.length > 0 || e.removed.length > 0)
  );
  const rows = ledger(timeline);

  /* The certificate each entry is being compared against, and the network's
   * verdict on that pair if anyone has asked for one.
   *
   * Fetched in one parallel batch rather than inside the render loop: a watch
   * with thirty captures would otherwise make thirty sequential chain reads
   * while the page hangs. Only pairs that actually changed are asked about,
   * since an identical claim set has nothing to judge. */
  const previousOf = new Map<number, number>();
  for (let i = 1; i < timeline.length; i++) {
    previousOf.set(timeline[i].cert.id, timeline[i - 1].cert.id);
  }

  const verdicts = new Map<number, Assessment | null>(
    await Promise.all(
      changes.map(async (e) => {
        const prev = previousOf.get(e.cert.id);
        const found =
          prev === undefined ? null : await assessmentForPair(prev, e.cert.id);
        return [e.cert.id, found] as [number, Assessment | null];
      })
    )
  );

  const bundle = {
    watch: {
      id: watch.id,
      url: watch.url,
      cadence_hours: watch.cadenceHours,
      created_at: watch.createdAt,
      last_checked: watch.lastChecked,
      active: watch.active,
    },
    captures: timeline.map((e) => ({
      certificate: e.cert.id,
      at: e.cert.at,
      text_digest: e.cert.textDigest,
      shot_digest: e.cert.shotDigest,
      cloaking: e.cert.cloaking,
      claims: e.cert.claims,
      added: e.added,
      removed: e.removed,
    })),
  };

  return (
    <div className="wrap section" style={{ maxWidth: 900 }}>
      <p className="eyebrow">// watch {watch.id}</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        <a
          href={watch.url}
          rel="nofollow noopener noreferrer"
          target="_blank"
          className="break"
        >
          {displayUrl(watch.url)}
        </a>
      </h1>

      <div className="stats" style={{ marginTop: 26 }}>
        <div className="stat">
          <span className="n">{formatDay(watch.createdAt)}</span>
          <span className="k">watched since</span>
        </div>
        <div className="stat">
          <span className="n">{formatCadence(watch.cadenceHours)}</span>
          <span className="k">cadence</span>
        </div>
        <div className="stat">
          <span className="n">{timeline.length}</span>
          <span className="k">captures</span>
        </div>
        <div className="stat">
          <span className="n">{changes.length}</span>
          <span className="k">captures with edits</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <span className="tag">
          {watch.active ? `${watch.credits} captures prepaid` : "closed"}
        </span>
        <span className="tag">owner {shortAddress(watch.owner)}</span>
        {watch.lastChecked && (
          <span className="tag">
            last checked {agoLabel(daysBetween(watch.lastChecked, TODAY))}
          </span>
        )}
      </div>

      <hr className="rule" style={{ margin: "36px 0" }} />

      <section>
        <h2 className="h3">Timeline</h2>
        <p className="small muted" style={{ marginTop: 8, maxWidth: "62ch" }}>
          Newest first. Each capture is compared against the one before it, on
          the normalised claim sets rather than on the page text, so an edit to
          an advertisement is not a change and an edit to a fee is.
        </p>

        <ol className="timeline" style={{ marginTop: 22 }}>
          {[...timeline].reverse().map((entry) => {
            const { d, t } = splitStamp(entry.cert.at);
            const changed = entry.added.length > 0 || entry.removed.length > 0;
            return (
              <li className="tl-item" key={entry.cert.id}>
                <div className="tl-when">
                  <span>{d}</span>
                  <span className="id">
                    {t} UTC
                    <br />
                    <Link href={`/c/${entry.cert.id}`}>
                      certificate {entry.cert.id}
                    </Link>
                  </span>
                </div>
                <div>
                  <div className="row" style={{ marginBottom: 10, gap: 8 }}>
                    {!entry.hasPrevious && (
                      <span className="tag">first capture</span>
                    )}
                    {changed && <span className="tag tag-ok">changed</span>}
                    {entry.cert.cloaking && (
                      <span className="tag tag-flag">cloaking</span>
                    )}
                    {!entry.cert.finalized && (
                      <span className="tag tag-prov">provisional</span>
                    )}
                  </div>
                  {entry.hasPrevious ? (
                    <>
                      <ClaimDiff added={entry.added} removed={entry.removed} />
                      {changed && (
                        <ChangeVerdict
                          certA={previousOf.get(entry.cert.id) as number}
                          certB={entry.cert.id}
                          existing={verdicts.get(entry.cert.id) ?? null}
                        />
                      )}
                    </>
                  ) : (
                    <p className="small muted">
                      Baseline. {entry.cert.claims.length} claims recorded, with
                      nothing before it to compare against.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <hr className="rule" style={{ margin: "36px 0" }} />

      <section>
        <h2 className="h3">Every claim, first seen and last seen</h2>
        <div className="scroll-x table-framed" style={{ marginTop: 18 }}>
        <table className="table">
          <thead>
            <tr>
              <th>claim</th>
              <th style={{ width: 130 }}>first seen</th>
              <th style={{ width: 130 }}>last seen</th>
              <th style={{ width: 110 }}>state</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.claim}>
                <td className={r.present ? "" : "muted"}>{r.claim}</td>
                <td className="mono">{formatDay(r.first)}</td>
                <td className="mono">{formatDay(r.last)}</td>
                <td>
                  {r.present ? (
                    <span className="tag tag-ok">present</span>
                  ) : (
                    <span className="tag">removed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="eyebrow">export</h2>
        <div className="row" style={{ marginTop: 12 }}>
          <CopyButton
            value={JSON.stringify(bundle, null, 2)}
            label="Copy evidence bundle"
            done="Copied"
          />
          <a className="btn" href={`/api/v1/watches/${watch.id}`}>
            Open as JSON
          </a>
          <Link className="btn" href="/watch">
            All watches
          </Link>
        </div>
        <p className="tiny muted" style={{ marginTop: 12, maxWidth: "62ch" }}>
          The bundle carries every capture, its digests and its diff. The
          captured text and the rendered images are the paid export, because
          storing them is the only part of this that costs anything per byte.
        </p>
      </section>

      {SAMPLE_MODE && (
        <p className="tiny muted mono" style={{ marginTop: 32 }}>
          Sample watch. No contract is deployed and none of these captures
          happened. Opened {formatStamp(watch.createdAt)} in the demonstration
          data only.
        </p>
      )}
    </div>
  );
}
