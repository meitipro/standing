"use client";

import { useEffect, useState } from "react";
import { connectWallet, readableError } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ConnectButton() {
  const [address, setAddress] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const eth = (globalThis as any).ethereum;
    if (!eth) return;
    eth
      .request({ method: "eth_accounts" })
      .then((a: string[]) => a?.[0] && setAddress(a[0]))
      .catch(() => {});
    const onAccounts = (a: string[]) => setAddress(a?.[0] ?? "");
    eth.on?.("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      setAddress(await connectWallet());
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  if (address) {
    return (
      <span className="tag tag-ink" title={address}>
        {shortAddress(address)}
      </span>
    );
  }

  return (
    <button
      className="btn"
      onClick={connect}
      disabled={busy}
      title={error || undefined}
    >
      {busy ? "Connecting" : "Connect"}
    </button>
  );
}
