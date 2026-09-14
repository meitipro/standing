import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import WatchForm from "@/components/WatchForm";
import { getStats, listWatches } from "@/lib/store";
import { displayUrl, formatCadence, formatDay, formatGen, nowStamp } from "@/lib/format";
import { LIMITS } from "@/lib/limits";

export const revalidate = 5;

export const metadata: Metadata = {
  title: "Watch",
  description:
    "Prepay captures of a public page on a cadence. Each capture links to the one before it, so the page's history shows every claim that arrived and every claim that went.",
};

export default async function WatchIndex() {
  const [watches, stats] = await Promise.all([listWatches(), getStats()]);
  const now = nowStamp();

  return (
    <div className="wrap section">
      <p className="eyebrow">// watch mode</p>
      <h1 className="h2" style={{ marginTop: 14 }}>
        Turn a certificate into a record over time.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        A single capture freezes a moment. A watch captures the same page on a cadence, so when a
        claim is quietly edited there is a record of what it said before and when it stopped.
      </p>

      <div style={{ marginTop: 32, maxWidth: 820 }}>
        <Suspense fallback={<div className="panel" style={{ padding: 24 }} />}>
          <WatchForm fee={stats ? stats.fee.toString() : null} />
        </Suspense>
      </div>

      <section style={{ marginTop: 48 }}>
        <h2 className="h3">Watched pages</h2>
        {watches.length === 0 ? (
          <div style={{ marginTop: 18, border: "1px dashed var(--line)", borderRadius: "var(--radius)", padding: "28px 24px" }}>
            <p className="muted pretty" style={{ maxWidth: "58ch" }}>
              No pages are watched yet. Open one above and every capture it takes is listed here,
              with the claims that arrived and went between them.
            </p>
          </div>
        ) : (
          <div className="scroll-x table-framed" style={{ marginTop: 18 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>page</th>
                  <th style={{ width: 120 }}>cadence</th>
                  <th style={{ width: 140 }}>last captured</th>
                  <th style={{ width: 110 }}>captures left</th>
                  <th style={{ width: 130 }}>next</th>
                </tr>
              </thead>
              <tbody>
                {watches.map((w) => {
                  const due = w.nextDue === "" || w.nextDue <= now;
                  return (
                    <tr key={w.id}>
                      <td>
                        <Link href={`/w/${w.id}`} className="break">
                          {displayUrl(w.url)}
                        </Link>
                        {!w.active && (
                          <span className="tag" style={{ marginLeft: 8 }}>
                            closed
                          </span>
                        )}
                      </td>
                      <td className="mono">{formatCadence(w.cadenceHours)}</td>
                      <td className="mono">{w.lastChecked ? formatDay(w.lastChecked) : "-"}</td>
                      <td className="mono">{w.capturesLeft}</td>
                      <td className="mono">
                        {!w.active ? (
                          <span className="muted">-</span>
                        ) : w.capturesLeft === 0 ? (
                          <span className="tag tag-flag">needs a top up</span>
                        ) : due ? (
                          <Link href={`/w/${w.id}`} className="tag tag-ok">
                            due now
                          </Link>
                        ) : (
                          <span className="muted">{formatDay(w.nextDue)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 48 }} className="cols">
        <div>
          <h2 className="h3">Price and prepay</h2>
          <p className="small muted" style={{ marginTop: 10 }}>
            A watch holds between {LIMITS.MIN_WATCH_CAPTURES} and {LIMITS.MAX_WATCH_CAPTURES} prepaid
            captures{stats ? ` at ${formatGen(stats.fee)} GEN each` : ""}. The price is locked when the
            watch opens, so a later change to the fee never touches it. Only the account that
            opened it can top it up or close it, and closing refunds whatever it still holds.
          </p>
        </div>
        <div>
          <h2 className="h3">Who takes a capture</h2>
          <p className="small muted" style={{ marginTop: 10 }}>
            Any account, once one is due. The owner has already paid and the contract decides when a
            capture is due, so taking one earns nothing and changes nothing but the moment. Each
            watch&apos;s page has the button, and the schedule does not depend on any one process
            staying alive.
          </p>
        </div>
      </section>
    </div>
  );
}
