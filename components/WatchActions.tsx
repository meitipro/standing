"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { captureWatch, closeWatch, connectWallet, readableError, topUpWatch, IS_LIVE, NETWORK_NAME } from "@/lib/chain";
import { formatGen, formatStamp, shortAddress } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import type { WriteStage } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NARRATION: Record<WriteStage, string> = {
  idle: "",
  signing: "Confirm in your wallet.",
  sent: "Waiting for the network to agree.",
  accepted: "Agreed.",
  failed: "",
};

/**
 * What can be done to a watch, and by whom.
 *
 * A due capture can be taken by any account: the owner has already paid and
 * the contract decides when one is due. Topping up and closing belong to the
 * owner, and the contract refuses anyone else, so the controls only appear
 * for the connected owner.
 */
export default function WatchActions({
  watchId,
  owner,
  unit,
  capturesLeft,
  active,
  due,
  nextDue,
}: {
  watchId: number;
  owner: string;
  unit: string;
  capturesLeft: number;
  active: boolean;
  due: boolean;
  nextDue: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [stage, setStage] = useState<WriteStage>("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [extra, setExtra] = useState(4);

  useEffect(() => {
    const provider = (globalThis as any).ethereum;
    if (!provider) return;
    provider
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => setAccount(accounts?.[0] ?? ""))
      .catch(() => undefined);
  }, []);

  const busy = stage !== "idle" && stage !== "failed";
  const isOwner = account !== "" && account.toLowerCase() === owner.toLowerCase();
  const room = LIMITS.MAX_WATCH_CAPTURES - capturesLeft;
  const addable = Number.isInteger(extra) && extra >= 1 && extra <= room;

  async function run(action: (address: `0x${string}`) => Promise<unknown>) {
    setError("");
    if (!IS_LIVE) {
      setError("This site is not pointed at a Standing contract yet.");
      setStage("failed");
      return;
    }
    try {
      setStage("signing");
      const address = await connectWallet();
      setAccount(address);
      await action(address);
      setStage("idle");
      router.refresh();
    } catch (e: any) {
      setStage("failed");
      setError(readableError(e));
    }
  }

  const onStage = (s: WriteStage, n?: string) => {
    setStage(s);
    setNote(n ?? "");
  };

  return (
    <div className="panel stack-12" style={{ padding: 20 }}>
      {!active ? (
        <p className="small">This watch is closed. Its captures stay on chain.</p>
      ) : capturesLeft === 0 ? (
        <p className="small">No prepaid captures are left. The owner can top it up and the schedule carries on.</p>
      ) : due ? (
        <div className="row" style={{ gap: 12 }}>
          <button
            type="button"
            className="btn btn-accent"
            disabled={busy}
            onClick={() => run((address) => captureWatch({ address, watchId, onStage }))}
          >
            {busy ? "Capturing" : "Take the due capture"}
          </button>
          <span className="tiny muted">Any account can. The owner already paid for it.</span>
        </div>
      ) : (
        <p className="small">The next capture is due {formatStamp(nextDue)}. Any account can take it from then.</p>
      )}

      {active &&
        (isOwner ? (
          <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
            <div>
              <label className="lbl" htmlFor="extra">
                Add captures
              </label>
              <input
                id="extra"
                className="text"
                type="number"
                min={1}
                max={room}
                style={{ width: 100 }}
                value={extra}
                onChange={(e) => setExtra(Number(e.target.value))}
                disabled={busy || room === 0}
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy || !addable}
              onClick={() => run((address) => topUpWatch({ address, watchId, unit: BigInt(unit), captures: extra, onStage }))}
            >
              {addable ? `Top up - ${formatGen(BigInt(unit) * BigInt(extra))} GEN` : "Top up"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => run((address) => closeWatch({ address, watchId, onStage }))}
            >
              Close and refund
            </button>
          </div>
        ) : (
          <p className="tiny muted">
            Only the owner, {shortAddress(owner)}, can top this watch up or close it. Closing
            refunds whatever it still holds.
          </p>
        ))}

      {active && isOwner && NETWORK_NAME === "studio" && (
        <p className="tiny muted">
          On GenLayer Studio a refund leaves the contract as a transfer that Studio does not
          deliver to a wallet, so the wallet balance there will not rise.
        </p>
      )}

      {busy && (
        <p className="small muted" aria-live="polite">
          {note || NARRATION[stage]}
        </p>
      )}
      {error && (
        <div className="notice notice-flag" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
