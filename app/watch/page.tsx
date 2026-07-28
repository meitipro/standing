import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import WatchForm from "@/components/WatchForm";
import { getTimeline, listWatches } from "@/lib/store";
import {
  addHours,
  daysBetween,
  displayUrl,
  formatCadence,
  formatDay,
  formatStamp,
} from "@/lib/format";

export const revalidate = 5;

export const metadata: Metadata = {
  title: "Watch",
  description:
    "Point a watch at a public page and it is captured on a cadence you prepay for. The timeline shows exactly which claims were added and which disappeared.",
};

const TODAY = "2026-07-28T12:00:00";

export default async function WatchPage() {
  const watches = await listWatches();

  const rows = await Promise.all(
    watches.map(async (w) => {
      const timeline = await getTimeline(w.id);
      const changes = timeline.filter(
        (e) => e.hasPrevious && (e.added.length > 0 || e.removed.length > 0)
      );
      const lastChange = changes.length > 0 ? changes[changes.length - 1] : null;
      return { watch: w, captures: timeline.length, changes: changes.length, lastChange };
    })
  );

  return (
    <div className="wrap section">
      <p className="eyebrow">// watch mode</p>
      <h1 className="h2" style={{ marginTop: 14 }}>
        Turn a certificate into a monitor.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        A single capture freezes a moment. A watch captures the same page on a
        cadence, so when a claim is quietly edited there is a record of what it
        used to say and when it stopped saying it.
      </p>

      <div style={{ marginTop: 32, maxWidth: 820 }}>
        <Suspense fallback={<div className="panel" style={{ padding: 24 }} />}>
          <WatchForm />
        </Suspense>
      </div>

      <section style={{ marginTop: 48 }}>
        <h2 className="h3">Watched pages</h2>

        {rows.length === 0 ? (
          <p className="muted small" style={{ marginTop: 14 }}>
            No watches yet.
          </p>
        ) : (
          <div className="scroll-x table-framed" style={{ marginTop: 18 }}>
          <table className="table">
            <thead>
              <tr>
                <th>page</th>
                <th style={{ width: 100 }}>cadence</th>
                <th style={{ width: 150 }}>last checked</th>
                <th style={{ width: 170 }}>last change</th>
                <th style={{ width: 90 }}>captures</th>
                <th style={{ width: 120 }}>next due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ watch: w, captures, changes, lastChange }) => {
                const due = w.lastChecked
                  ? addHours(w.lastChecked, w.cadenceHours)
                  : "";
                const overdue = due !== "" && due < TODAY;
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
                    <td className="mono">
                      {w.lastChecked ? formatDay(w.lastChecked) : "—"}
                    </td>
                    <td>
                      {lastChange ? (
                        <Link href={`/w/${w.id}`}>
                          <span className="mono">
                            {formatDay(lastChange.cert.at)}
                          </span>
                          <span className="tiny muted" style={{ display: "block" }}>
                            {changes} material {changes === 1 ? "change" : "changes"}
                          </span>
                        </Link>
                      ) : (
                        <span className="muted mono">no change yet</span>
                      )}
                    </td>
                    <td className="mono">{captures}</td>
                    <td className="mono">
                      {!w.active ? (
                        <span className="muted">—</span>
                      ) : w.credits === 0 ? (
                        <span className="tag tag-flag">out of credit</span>
                      ) : overdue ? (
                        <span className="tag tag-ok">due now</span>
                      ) : (
                        <span className="muted">{formatDay(due)}</span>
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
          <h2 className="h3">Cadence and credit</h2>
          <p className="small muted" style={{ marginTop: 10 }}>
            Each capture spends one prepaid credit. When the credits run out the
            watch stops rather than silently billing you, and topping it up
            resumes the same timeline. Closing a watch refunds whatever is left.
          </p>
          <p className="small muted" style={{ marginTop: 12 }}>
            A capture becomes callable by anyone once it is due. The owner has
            already paid and the caller earns nothing, so the schedule does not
            depend on one worker process of ours staying alive.
          </p>
        </div>

        <div>
          <h2 className="h3">Alerts</h2>
          <p className="small muted" style={{ marginTop: 10 }}>
            Every scheduled capture emits the added and removed claims as an
            event, so an alert is a subscription to that event rather than a
            polling loop. A change is worth a message; an identical claim set is
            not, and no notification is sent for one.
          </p>
          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>webhook</dt>
            <dd>
              <Link href="/api" style={{ textDecoration: "underline" }}>
                see the api page
              </Link>
            </dd>
            <dt>on change</dt>
            <dd>claims added or removed</dd>
            <dt>on cloaking</dt>
            <dd>flag raised or cleared</dd>
          </dl>
        </div>
      </section>

      {rows.length > 0 && (
        <p className="tiny muted mono" style={{ marginTop: 40 }}>
          {rows.reduce((n, r) => n + r.captures, 0)} captures across{" "}
          {rows.length} watched pages, the oldest opened{" "}
          {daysBetween(
            rows.map((r) => r.watch.createdAt).sort()[0],
            TODAY
          )}{" "}
          days ago on {formatStamp(rows.map((r) => r.watch.createdAt).sort()[0])}.
        </p>
      )}
    </div>
  );
}
