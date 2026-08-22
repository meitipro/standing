"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  connectWallet,
  contractViewMethods,
  formatGen,
  notarize,
  notarizeContracts,
  prices,
  readableError,
  IS_LIVE,
} from "@/lib/chain";
import { classifyAll, type Row } from "@/lib/bulk";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Add many pages and many contracts at once.
 *
 * The two halves cost very different things and the screen does not pretend
 * otherwise. A contract snapshot is deterministic — cross contract reads, no
 * render, no model — so ten of them batch into one transaction and one
 * signature. A page capture runs two renders and a vision prompt on every
 * validator, so ten of those are ten transactions and ten signatures, and the
 * only honest thing to do is queue them and show progress.
 *
 * Nothing is signed until the whole list has been checked and priced, because
 * the failure this screen exists to prevent is paying for forty captures and
 * discovering that six of the urls were typos.
 */
/** Contracts per transaction. Mirrors MAX_BULK_TARGETS in the contract. */
const BATCH = 10;

export default function BulkAdd() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fees, setFees] = useState<{ capture: bigint; snapshot: bigint } | null>(
    null
  );
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState("");

  const good = (rows ?? []).filter((r) => r.kind !== "bad" && !r.duplicate);
  const pages = good.filter((r) => r.kind === "page");
  const contracts = good.filter((r) => r.kind === "contract");

  const total =
    fees === null
      ? 0n
      : BigInt(pages.length) * fees.capture +
        BigInt(contracts.length) * fees.snapshot;

  async function check() {
    setError("");
    setDone([]);
    setChecking(true);
    try {
      const classified = classifyAll(text);

      // Only ask the chain about contracts that are worth asking about.
      await Promise.all(
        classified
          .filter((r) => r.kind === "contract" && !r.duplicate)
          .map(async (r) => {
            try {
              const methods = await contractViewMethods(r.key);
              if (methods.length === 0) {
                r.kind = "bad";
                r.problem =
                  "No readable view methods without arguments, so there is nothing to snapshot.";
              } else {
                r.methods = methods;
              }
            } catch {
              r.kind = "bad";
              r.problem =
                "No contract answered at that address on this network.";
            }
          })
      );

      setRows(classified);

      if (IS_LIVE) {
        try {
          const p = await prices();
          setFees({ capture: p.capture, snapshot: p.snapshot });
        } catch {
          setFees(null);
        }
      }
    } catch (e: any) {
      setError(readableError(e));
    } finally {
      setChecking(false);
    }
  }

  async function addAll() {
    setError("");
    setDone([]);
    if (!IS_LIVE) {
      setError("The contract is not deployed yet, so nothing can be added.");
      return;
    }

    setRunning(true);
    const finished: string[] = [];

    try {
      const address = (await connectWallet()) as `0x${string}`;

      // Contracts first: they are one signature per batch of ten, so the list
      // shrinks fastest here and a failure costs the least.
      for (let i = 0; i < contracts.length; i += BATCH) {
        const slice = contracts.slice(i, i + BATCH);
        setProgress(
          `Contracts ${i + 1}–${i + slice.length} of ${contracts.length}, one signature`
        );
        await notarizeContracts({
          address,
          targets: slice.map((r) => r.key),
          methodSets: slice.map((r) => r.methods),
        });
        for (const r of slice) finished.push(r.raw);
        setDone([...finished]);
      }

      // Pages: one transaction each, no way around it.
      for (let i = 0; i < pages.length; i++) {
        setProgress(
          `Page ${i + 1} of ${pages.length} — about forty seconds each, one signature each`
        );
        await notarize({ address, url: pages[i].key });
        finished.push(pages[i].raw);
        setDone([...finished]);
      }

      setProgress("");
      router.refresh();
    } catch (e: any) {
      setError(
        `${readableError(e)}${
          finished.length > 0
            ? ` — ${finished.length} of ${good.length} were added before this and are on chain.`
            : ""
        }`
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="stack-24">
      <div>
        <label className="lbl" htmlFor="bulk">
          One per line — page urls, contract addresses, or both
        </label>
        <textarea
          id="bulk"
          className="text"
          rows={9}
          spellCheck={false}
          value={text}
          disabled={running}
          onChange={(e) => {
            setText(e.target.value);
            setRows(null);
          }}
          placeholder={
            "example-dex.io/tokenomics\nhttps://app.protocol.fi/terms\n0x90A01d5909E33682306cd8F11C840546D618E664"
          }
          style={{
            width: "100%",
            height: "auto",
            padding: 14,
            lineHeight: 1.6,
            resize: "vertical",
          }}
        />
      </div>

      <div className="row" style={{ gap: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={check}
          disabled={checking || running || text.trim() === ""}
        >
          {checking ? "Checking" : "Check the list"}
        </button>
        {rows !== null && good.length > 0 && (
          <button
            type="button"
            className="btn btn-accent"
            onClick={addAll}
            disabled={running}
          >
            {running
              ? "Adding"
              : `Add ${good.length} ${good.length === 1 ? "item" : "items"}${
                  fees ? ` · ${formatGen(total)} GEN` : ""
                }`}
          </button>
        )}
        <span className="mono tiny muted">nothing is signed until you add</span>
      </div>

      {rows !== null && (
        <div className="scroll-x table-framed">
          <table className="table">
            <thead>
              <tr>
                <th>Line</th>
                <th style={{ width: 110 }}>Kind</th>
                <th style={{ width: 100 }}>Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const added = done.includes(r.raw);
                return (
                  <tr key={`${r.raw}-${i}`}>
                    <td className="break">{r.raw}</td>
                    <td className="muted">
                      {r.kind === "bad" ? "—" : r.kind}
                    </td>
                    <td className="muted">
                      {r.kind === "bad" || r.duplicate || !fees
                        ? "—"
                        : `${formatGen(
                            r.kind === "page" ? fees.capture : fees.snapshot
                          )}`}
                    </td>
                    <td>
                      {added ? (
                        <span style={{ color: "var(--accent)" }}>added</span>
                      ) : r.kind === "bad" ? (
                        <span style={{ color: "var(--flag)" }}>{r.problem}</span>
                      ) : r.duplicate ? (
                        <span className="muted">
                          already in this list, will be skipped
                        </span>
                      ) : r.kind === "contract" ? (
                        <span className="muted">
                          {r.methods.length} view{" "}
                          {r.methods.length === 1 ? "method" : "methods"}:{" "}
                          {r.methods.slice(0, 4).join(", ")}
                          {r.methods.length > 4 ? "…" : ""}
                        </span>
                      ) : (
                        <span className="muted">ready</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows !== null && good.length > 0 && (
        <div className="notice" style={{ maxWidth: "72ch" }}>
          <strong>
            {contracts.length > 0 && pages.length > 0
              ? `${Math.ceil(contracts.length / BATCH)} signature${
                  Math.ceil(contracts.length / BATCH) === 1 ? "" : "s"
                } for the contracts, then ${pages.length} for the pages.`
              : contracts.length > 0
                ? `${Math.ceil(contracts.length / BATCH)} signature${
                    Math.ceil(contracts.length / BATCH) === 1 ? "" : "s"
                  } in total.`
                : `${pages.length} signature${
                    pages.length === 1 ? "" : "s"
                  }, one per page.`}
          </strong>{" "}
          Contract snapshots batch because they are deterministic reads. A page
          capture runs two renders and a vision prompt on every validator, so
          each one is its own transaction and takes about forty seconds.
        </div>
      )}

      {running && progress && (
        <p className="small muted" aria-live="polite">
          {progress}
        </p>
      )}

      {error && (
        <div className="notice notice-flag" role="alert" style={{ maxWidth: "72ch" }}>
          {error}
        </div>
      )}
    </div>
  );
}
