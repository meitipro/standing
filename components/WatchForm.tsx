"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { connectWallet, openWatch, readableError, IS_LIVE } from "@/lib/chain";
import type { WriteStage } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CADENCES = [
  { hours: 24, label: "daily" },
  { hours: 168, label: "weekly" },
  { hours: 720, label: "monthly" },
  { hours: 1, label: "hourly" },
];

const FEE_GEN = 0.4;

export default function WatchForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [url, setUrl] = useState(params.get("url") ?? "");
  const [cadence, setCadence] = useState(168);
  const [captures, setCaptures] = useState(12);
  const [stage, setStage] = useState<WriteStage>("idle");
  const [error, setError] = useState("");

  const busy = stage !== "idle" && stage !== "failed";
  const total = (captures * FEE_GEN).toFixed(1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Paste a url first.");
      setStage("failed");
      return;
    }
    if (captures < 4) {
      setError("A watch is prepaid, and four captures is the minimum.");
      setStage("failed");
      return;
    }
    if (!IS_LIVE) {
      setError(
        "The contract is not deployed yet, so a watch cannot be opened. Every watch on this page is sample data."
      );
      setStage("failed");
      return;
    }

    try {
      setStage("signing");
      const address = (await connectWallet()) as `0x${string}`;
      const { watchId } = await openWatch({
        address,
        url: url.trim(),
        cadenceHours: cadence,
        captures,
        onStage: setStage,
      });
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
          <select
            id="cadence"
            className="text"
            value={cadence}
            onChange={(e) => setCadence(Number(e.target.value))}
            disabled={busy}
          >
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
            min={4}
            max={400}
            value={captures}
            onChange={(e) => setCaptures(Number(e.target.value))}
            disabled={busy}
          />
        </div>

        <div className="grow">
          <span className="lbl">Total</span>
          <span className="mono" style={{ fontSize: "var(--s-18)" }}>
            {total} GEN
          </span>
        </div>

        <button className="btn btn-accent" disabled={busy}>
          {busy ? "Opening" : "Open the watch"}
        </button>
      </div>

      <p className="tiny muted">
        A watch is prepaid, and unspent captures are refunded when you close it.
        The schedule lives on chain, so the next capture is due whether or not
        anything of ours is running.
      </p>

      {error && (
        <div className="notice notice-flag" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
