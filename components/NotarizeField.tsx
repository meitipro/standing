"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { connectWallet, notarize, readableError, IS_LIVE } from "@/lib/chain";
import { checkUrl, withScheme } from "@/lib/url";
import type { WriteStage } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NARRATION: Record<WriteStage, string> = {
  idle: "",
  signing: "Confirm the price in your wallet.",
  sent: "Each validator is reading the page for itself and checking every claim against its own copy.",
  accepted: "Agreed. Reading the certificate back.",
  failed: "",
};

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

/**
 * Paste a url, sign, and land on the certificate.
 *
 * The url is refused or normalised here by lib/url.ts, the contract's own
 * guard held to it by a parity test, so nobody signs for a url the contract
 * will refuse, and the url sent is the url stored.
 */
export default function NotarizeField({
  autoFocus = false,
  price,
  network,
}: {
  autoFocus?: boolean;
  price: string | null;
  network: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<WriteStage>("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const busy = stage !== "idle" && stage !== "failed";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Paste a url first.");
      setStage("failed");
      return;
    }
    const checked = checkUrl(withScheme(url));
    if (!checked.ok) {
      setError(sentence(checked.reason));
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
      const { certId } = await notarize({
        address,
        url: checked.url,
        onStage: (s, n) => {
          setStage(s);
          setNote(n ?? "");
        },
      });
      router.push(`/c/${certId}`);
    } catch (e: any) {
      setStage("failed");
      setError(readableError(e));
    }
  }

  return (
    <div className="stack-12">
      <form onSubmit={submit}>
        <label className="lbl" htmlFor="url">
          Page to notarize
        </label>
        <div className="field" style={{ maxWidth: 560 }}>
          <span className="prefix">https://</span>
          <input
            id="url"
            name="url"
            value={url}
            autoFocus={autoFocus}
            spellCheck={false}
            autoComplete="off"
            placeholder="example-dex.io/tokenomics"
            onChange={(e) => {
              setUrl(e.target.value);
              if (stage === "failed") {
                setStage("idle");
                setError("");
              }
            }}
            disabled={busy}
          />
          <button disabled={busy}>{busy ? "Capturing" : "Notarize this page"}</button>
        </div>
      </form>

      <p className="mono tiny muted" style={{ letterSpacing: "0.02em", maxWidth: 560 }}>
        {price ? `${price} GEN per capture - ` : ""}
        {network}
      </p>

      {busy && (
        <p className="small muted" aria-live="polite" style={{ maxWidth: 560 }}>
          {note || NARRATION[stage]}
        </p>
      )}

      {error && (
        <div className="notice notice-flag" role="alert" style={{ maxWidth: 560 }}>
          {error}
          {/error status|almost no text/i.test(error) && (
            <> A page behind a login or a bot check cannot be notarised; a public copy of it can.</>
          )}
        </div>
      )}
    </div>
  );
}
