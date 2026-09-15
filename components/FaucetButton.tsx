"use client";

import { useState } from "react";

import { NETWORK_NAME, connectWallet, readableError } from "@/lib/chain";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FAUCET_GEN = 100;

/**
 * Test GEN for a visitor, on GenLayer Studio only. It connects first when the
 * wallet is not connected, so one press does the whole job, and the result
 * stays on screen until dismissed.
 */
export default function FaucetButton() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  if (NETWORK_NAME !== "studio") return null;

  async function fund() {
    setBusy(true);
    setNote(null);
    try {
      const address = await connectWallet();
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) setNote({ text: json?.message ?? "The faucet did not answer.", bad: true });
      else setNote({ text: `${json.added} GEN added. The balance is ${json.balance} GEN.`, bad: false });
    } catch (e) {
      setNote({ text: readableError(e), bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="connect">
      <button type="button" className="btn" onClick={fund} disabled={busy} aria-describedby={note ? "faucet-note" : undefined}>
        {busy ? "Funding" : `Get ${FAUCET_GEN} GEN`}
      </button>
      {note && (
        <span id="faucet-note" role={note.bad ? "alert" : "status"} className={note.bad ? "connect-error" : "connect-error connect-ok"}>
          {note.text}{" "}
          <button type="button" className="linklike" onClick={() => setNote(null)}>
            Dismiss
          </button>
        </span>
      )}
    </span>
  );
}
