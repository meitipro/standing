"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { connectWallet, openWatch, readableError, IS_LIVE } from "@/lib/chain";
import { formatGen } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import type { WriteStage } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CADENCES = [
  { hours: 24, label: "daily" },
  { hours: 168, label: "weekly" },
  { hours: 720, label: "every 30 days" },
  { hours: 1, label: "hourly" },
];

export default function WatchForm({ fee }: { fee: string | null }) {
  const router = useRouter();
  const params = useSearchParams();

  const [url, setUrl] = useState(params.get("url") ?? "");
  const [cadence, setCadence] = useState(168);
  const [captures, setCaptures] = useState(12);
  const [stage, setStage] = useState<WriteStage>("idle");
  const [error, setError] = useState("");

  const busy = stage !== "idle" && stage !== "failed";
  const valid = Number.isInteger(captures) && captures >= LIMITS.MIN_WATCH_CAPTURES && captures <= LIMITS.MAX_WATCH_CAPTURES;
  const total = fee && valid ? formatGen(BigInt(fee) * BigInt(captures)) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!url.trim()) {
      setError("Paste a url first.");
      setStage("failed");
      return;
    }
    if (!valid) {
      setError(`A watch holds between ${LIMITS.MIN_WATCH_CAPTURES} and ${LIMITS.MAX_WATCH_CAPTURES} prepaid captures.`);
      setStage("failed");
      return;
    }
    if (!IS_LIVE) {
      setError("This site is not pointed at a Standing contract yet.");
      setStage("failed");
      return;
    }
    try {
      setStage("signing");
      const address = await connectWallet();
      const { watchId } = await openWatch({ address, url, cadenceHours: cadence, captures, onStage: setStage });
      router.push(`/w/${watchId}`);
    } catch (e: any) {
      setStage("failed");
      setError(readableError(e));
    }
  }

  return (
    <form className="panel stack-16" style={{ padding: 24 }} onSubmit={submit}>
      <div>
        <label className="lbl" htmlFor="watch-url">
          Page to watch
        </label>
        <input
          id="watch-url"
          className="text"
          style={{ width: "100%" }}
          value={url}
          spellCheck={false}
          autoComplete="off"
          placeholder="https://example.com/terms"
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="row" style={{ gap: 20, alignItems: "flex-end" }}>
        <div>
          <label className="lbl" htmlFor="cadence">
            Cadence
          </label>
          <select id="cadence" className="text" value={cadence} onChange={(e) => setCadence(Number(e.target.value))} disabled={busy}>
            {CADENCES.map((c) => (
              <option key={c.hours} value={c.hours}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="lbl" htmlFor="captures">
            Captures prepaid
          </label>
          <input
            id="captures"
            className="text"
            style={{ width: 110 }}
            type="number"
            min={LIMITS.MIN_WATCH_CAPTURES}
            max={LIMITS.MAX_WATCH_CAPTURES}
            value={captures}
            onChange={(e) => setCaptures(Number(e.target.value))}
            disabled={busy}
          />
        </div>

        <div className="grow">
          <span className="lbl">Total</span>
          <span className="mono" style={{ fontSize: "var(--s-18)" }}>
            {total ? `${total} GEN` : "-"}
          </span>
        </div>

        <button className="btn btn-accent" disabled={busy}>
          {busy ? "Opening" : "Open the watch"}
        </button>
      </div>

      <p className="tiny muted">
        The price per capture is locked when the watch opens. Closing it refunds whatever it
        still holds, and only the account that opened it can top it up or close it.
      </p>

      {error && (
        <div className="notice notice-flag" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
