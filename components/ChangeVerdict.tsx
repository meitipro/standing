"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { assess, readableError, IS_LIVE } from "@/lib/chain";
import { connectWallet } from "@/lib/chain";
import type { Assessment, VerdictKind, WriteStage } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The network's answer to "did the substance change?", and the button to ask.
 *
 * A claim diff is a set operation: it can say two claims left and two arrived,
 * and it says exactly that whether a fee moved from one percent to five or a
 * copywriter reworded the same sentence. Those are the same diff and opposite
 * findings. Telling them apart is a judgment, which is why it lives on chain
 * behind consensus rather than in this component behind a heuristic.
 */
const LOOK: Record<
  VerdictKind,
  { label: string; tag: string; line: string }
> = {
  material: {
    label: "Material change",
    tag: "tag tag-flag",
    line: "At least one fact a reader would act on is different.",
  },
  reworded: {
    label: "Reworded only",
    tag: "tag tag-ok",
    line: "The same facts, stated differently. Nothing to act on changed.",
  },
  unchanged: {
    label: "Unchanged",
    tag: "tag",
    line: "Nothing of consequence differs between these two captures.",
  },
};

const NARRATION: Record<WriteStage, string> = {
  idle: "",
  signing: "Confirm the fee in your wallet.",
  sent: "Validators are each reading both captures and deciding independently.",
  accepted: "Agreed. Writing the verdict.",
  finalized: "Recorded.",
  failed: "",
};

export default function ChangeVerdict({
  certA,
  certB,
  existing,
}: {
  certA: number;
  certB: number;
  existing: Assessment | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<WriteStage>("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const busy = stage !== "idle" && stage !== "failed";

  async function ask() {
    setError("");
    if (!IS_LIVE) {
      setError("The contract is not deployed yet, so nothing can be assessed.");
      setStage("failed");
      return;
    }
    try {
      setStage("signing");
      const address = (await connectWallet()) as `0x${string}`;
      await assess({
        address,
        certA,
        certB,
        onStage: (s, n) => {
          setStage(s);
          setNote(n ?? "");
        },
      });
      // The verdict is read server side, so the page has to be refetched rather
      // than patched in place.
      router.refresh();
      setStage("idle");
    } catch (e: any) {
      setStage("failed");
      setError(readableError(e));
    }
  }

  if (existing) {
    const look = LOOK[existing.verdict];
    return (
      <div className="stack-12" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className={look.tag}>{look.label}</span>
          <span className="mono tiny muted">
            agreed by the network · assessment {existing.id}
          </span>
        </div>

        {existing.summary && (
          <p className="pretty" style={{ maxWidth: "62ch" }}>
            {existing.summary}
          </p>
        )}

        {existing.changes.length > 0 && (
          <ul
            className="ledger"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {existing.changes.map((c) => (
              <li key={c} className="ledger-yes">
                <span className="sign" aria-hidden="true">
                  →
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="small muted pretty" style={{ maxWidth: "62ch" }}>
          {look.line} Several validators each read both captures and reached
          this verdict independently — it is not one model&apos;s opinion.
        </p>
      </div>
    );
  }

  return (
    <div className="stack-12" style={{ marginTop: 16 }}>
      <div className="row" style={{ gap: 10 }}>
        <button
          type="button"
          className="btn btn-accent"
          onClick={ask}
          disabled={busy}
        >
          {busy ? "Assessing" : "Did this change matter? · 0.2 GEN"}
        </button>
        <span className="mono tiny muted">asks the network, not a server</span>
      </div>

      {busy && (
        <p className="small muted" aria-live="polite" style={{ maxWidth: "62ch" }}>
          {note || NARRATION[stage]}
        </p>
      )}

      {error && (
        <div className="notice notice-flag" role="alert" style={{ maxWidth: "62ch" }}>
          {error}
        </div>
      )}
    </div>
  );
}
