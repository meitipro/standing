"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { connectWallet, notarize, readableError, IS_LIVE } from "@/lib/chain";
import type { WriteStage } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The same refusals the contract makes, made here first.
 *
 * The contract is the authority — this is a copy, and a copy that drifts is
 * worse than none. Its only job is to spend nothing on a url that is going to
 * be refused anyway, and to say why while the field is still focused.
 */
const PRIVATE_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254",
  "metadata.google.internal",
];

function precheck(raw: string): string {
  const value = raw.trim();
  if (!value) return "Paste a url first.";

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return "That is not a url.";
  }

  if (u.protocol !== "http:" && u.protocol !== "https:")
    return "Only http and https pages can be notarised.";
  if (u.username || u.password)
    return "A url carrying credentials is not a public page.";

  const host = u.hostname.toLowerCase();
  if (
    PRIVATE_HOSTS.includes(host) ||
    /^(10\.|127\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  )
    return "That address is not reachable from the public internet.";

  return "";
}

const NARRATION: Record<WriteStage, string> = {
  idle: "",
  signing: "Confirm the fee in your wallet.",
  sent: "Validators are fetching the page. This takes about forty seconds, because several of them are each rendering it and reading the screenshot.",
  accepted: "Agreed. Writing the certificate.",
  finalized: "Recorded.",
  failed: "",
};

export default function NotarizeField({
  autoFocus = false,
}: {
  autoFocus?: boolean;
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

    const problem = precheck(url);
    if (problem) {
      setError(problem);
      setStage("failed");
      return;
    }

    if (!IS_LIVE) {
      setError(
        "The contract is not deployed yet, so nothing can be captured. Every record on this site is sample data."
      );
      setStage("failed");
      return;
    }

    try {
      setStage("signing");
      const address = (await connectWallet()) as `0x${string}`;
      const { certId } = await notarize({
        address,
        url: url.trim(),
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
        <label className="lbl" htmlFor="url" style={{ position: "absolute", left: -9999 }}>
          Paste any public url
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
          <button disabled={busy}>
            {busy ? "Capturing" : "Notarize this page"}
          </button>
        </div>
      </form>

      <p
        className="mono tiny muted"
        style={{ letterSpacing: "0.02em", maxWidth: 560 }}
      >
        0.4 GEN per capture · settles in ~40s · GenLayer Testnet Bradbury
      </p>

      {busy && (
        <p className="small muted" aria-live="polite" style={{ maxWidth: 560 }}>
          {note || NARRATION[stage]}
        </p>
      )}

      {error && (
        <div
          className="notice notice-flag"
          role="alert"
          style={{ maxWidth: 560 }}
        >
          {error}
          {/unstable|changed between fetches/i.test(error) && (
            <>
              {" "}
              Nothing was recorded and the fee was not taken. A page that moves
              while it is being read has no single answer, so trying again in a
              minute is the honest next step.
            </>
          )}
          {/status 4\d\d|blocked/i.test(error) && (
            <>
              {" "}
              If the page is behind a login or a bot check it cannot be
              notarised. An archived copy of it, on a public url, can be.
            </>
          )}
        </div>
      )}
    </div>
  );
}
