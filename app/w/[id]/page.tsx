import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClaimDiff } from "@/components/ClaimList";
import CopyButton from "@/components/CopyButton";
import ChangeVerdict from "@/components/ChangeVerdict";
import WatchActions from "@/components/WatchActions";
import { assessmentForPair, getStats, getTimeline, getWatch } from "@/lib/store";
import { watchJson } from "@/lib/api";
import { agoLabel, daysBetween, displayUrl, formatCadence, formatDay, formatGen, nowStamp, shortAddress, splitStamp } from "@/lib/format";
import type { Assessment, TimelineEntry } from "@/lib/types";

export const revalidate = 5;

type Params = { params: { id: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const w = await getWatch(Number(params.id));
  if (!w) return { title: "Watch not found" };
  return {
    title: `${displayUrl(w.url)}, watched`,
    description: `Every capture of ${displayUrl(w.url)}, with the claims that arrived and went between them.`,
  };
}

type LedgerRow = { claim: string; first: string; last: string; present: boolean };

/** When each claim first appeared, and the last capture it appeared in. */
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
        index[claim] = { claim, first: entry.cert.at, last: entry.cert.at, present: true };
        rows.push(index[claim]);
      }
    }
    for (const row of rows) if (!here.has(row.claim)) row.present = false;
  }
  return rows.sort((a, b) => Number(b.present) - Number(a.present) || a.claim.localeCompare(b.claim));
}

export default async function WatchPage({ params }: Params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) notFound();

  const watch = await getWatch(id);
  if (!watch) notFound();

  const [timeline, stats] = await Promise.all([getTimeline(watch.url), getStats()]);
  const now = nowStamp();
  const due = watch.active && watch.capturesLeft > 0 && (watch.nextDue === "" || watch.nextDue <= now);
  const changes = timeline.filter((e) => e.hasPrevious && (e.added.length > 0 || e.removed.length > 0));
  const rows = ledger(timeline);

  /* Each changed capture is compared against the one before it. The judgments
   * are fetched together rather than inside the render loop. */
  const previousOf = new Map<number, number>();
  for (const entry of timeline) if (entry.cert.previous !== null) previousOf.set(entry.cert.id, entry.cert.previous);
  const verdicts = new Map<number, Assessment | null>(
    await Promise.all(
      changes.map(async (e) => {
        const prev = previousOf.get(e.cert.id);
        return [e.cert.id, prev === undefined ? null : await assessmentForPair(prev, e.cert.id)] as [number, Assessment | null];
      }),
    ),
  );

  return (
    <div className="wrap section" style={{ maxWidth: 900 }}>
      <p className="eyebrow">// watch {watch.id}</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        <a href={watch.url} rel="nofollow noopener noreferrer" target="_blank" className="break">
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
          <span className="n">{watch.certCount}</span>
          <span className="k">captures taken</span>
        </div>
        <div className="stat">
          <span className="n">{watch.capturesLeft}</span>
          <span className="k">captures left</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <span className="tag">{watch.active ? `${formatGen(watch.unit)} GEN per capture` : "closed"}</span>
        <span className="tag">owner {shortAddress(watch.owner)}</span>
        {watch.lastChecked && <span className="tag">last captured {agoLabel(daysBetween(watch.lastChecked, now))}</span>}
      </div>

      <div style={{ marginTop: 22 }}>
        <WatchActions
          watchId={watch.id}
          owner={watch.owner}
          unit={watch.unit.toString()}
          capturesLeft={watch.capturesLeft}
          active={watch.active}
          due={due}
          nextDue={watch.nextDue}
        />
      </div>

      <hr className="rule" style={{ margin: "36px 0" }} />

      <section>
        <h2 className="h3">The page&apos;s history</h2>
        <p className="small muted" style={{ marginTop: 8, maxWidth: "62ch" }}>
          Newest first, the latest {timeline.length} captures of this url, whoever took them. Each
          is compared with the capture before it on the claims alone, so an edit to an
          advertisement is not a change and an edit to a fee is.
        </p>

        <ol className="timeline" style={{ marginTop: 22 }}>
          {[...timeline].reverse().map((entry) => {
            const { d, t } = splitStamp(entry.cert.at);
            const changed = entry.added.length > 0 || entry.removed.length > 0;
            const prev = previousOf.get(entry.cert.id);
            return (
              <li className="tl-item" key={entry.cert.id}>
                <div className="tl-when">
                  <span>{d}</span>
                  <span className="id">
                    {t} UTC
                    <br />
                    <Link href={`/c/${entry.cert.id}`}>certificate {entry.cert.id}</Link>
                  </span>
                </div>
                <div>
                  <div className="row" style={{ marginBottom: 10, gap: 8 }}>
                    {entry.cert.watchId === watch.id ? <span className="tag">taken by this watch</span> : <span className="tag">notarised separately</span>}
                    {!entry.hasPrevious && <span className="tag">first capture</span>}
                    {changed && <span className="tag tag-ok">changed</span>}
                    {entry.cert.cloaking && <span className="tag tag-flag">cloaking</span>}
                  </div>
                  {entry.hasPrevious ? (
                    <>
                      <ClaimDiff added={entry.added} removed={entry.removed} />
                      {changed && prev !== undefined && (
                        <ChangeVerdict
                          certA={prev}
                          certB={entry.cert.id}
                          existing={verdicts.get(entry.cert.id) ?? null}
                          price={stats ? formatGen(stats.assessFee) : null}
                        />
                      )}
                    </>
                  ) : (
                    <p className="small muted">The first capture of this url: {entry.cert.claims.length} claims, nothing before it.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {rows.length > 0 && (
        <>
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
                      <td>{r.present ? <span className="tag tag-ok">present</span> : <span className="tag">gone</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section style={{ marginTop: 40 }}>
        <h2 className="eyebrow">the record</h2>
        <div className="row" style={{ marginTop: 12 }}>
          <CopyButton value={JSON.stringify(watchJson(watch, timeline), null, 2)} label="Copy the record" done="Copied" />
          <a className="btn" href={`/api/v1/watches/${watch.id}`}>
            Open as JSON
          </a>
          <Link className="btn" href="/watch">
            All watches
          </Link>
        </div>
      </section>
    </div>
  );
}
