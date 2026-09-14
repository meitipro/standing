"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { assess, connectWallet, readableError, IS_LIVE } from "@/lib/chain";
import type { Verdict } from "@/lib/limits";
import type { Assessment, WriteStage } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The network's answer to "did the change matter?", and the button to ask.
 *
 * A claim diff is a set operation. It reads the same whether a fee moved from
 * one percent to five or a copywriter reworded a sentence, and telling those
 * apart is a judgment. So it is asked of the network: each validator asks its
 * own model in both presentation orders, and they must reach the same answer.
 */
const LOOK: Record<Verdict, { label: string; tag: string; line: string }> = {
  material: {
    label: "Material change",
    tag: "tag tag-flag",
    line: "The two captures state different values for the same fact, and a reader would act differently because of it.",
  },
  immaterial: {
    label: "No material change",
    tag: "tag tag-ok",
    line: "No claim in one capture contradicts a claim in the other in a way a reader would act on.",
  },
  unclear: {
    label: "Unclear",
    tag: "tag",
    line: "Shown the two captures in opposite orders, the model answered differently, so the contract stored neither answer.",
  },
};

const NARRATION: Record<WriteStage, string> = {
  idle: "",
  signing: "Confirm the price in your wallet.",
  sent: "Each validator is asking its own model, in both orders, and comparing the answer.",
  accepted: "Agreed. Reading the judgment back.",
  failed: "",
};

export default function ChangeVerdict({
  certA,
  certB,
  existing,
  price,
}: {
  certA: number;
  certB: number;
  existing: Assessment | null;
  price: string | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<WriteStage>("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const busy = stage !== "idle" && stage !== "failed";

  async function ask() {
    setError("");
    if (!IS_LIVE) {
      setError("This site is not pointed at a Standing contract yet.");
      setStage("failed");
      return;
    }
    try {
      setStage("signing");
      const address = await connectWallet();
      await assess({
        address,
        certA,
        certB,
        onStage: (s, n) => {
          setStage(s);
          setNote(n ?? "");
        },
      });
      router.refresh();
      setStage("idle");
    } catch (e: any) {
      setStage("failed");
      setError(readableError(e));
    }
  }

  if (existing) {
    const look = LOOK[existing.verdict];
    const shared = existing.certA !== certA || existing.certB !== certB;
    return (
      <div className="stack-12" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className={look.tag}>{look.label}</span>
          <span className="mono tiny muted">
            assessment {existing.id}
            {shared ? `, first asked of certificates ${existing.certA} and ${existing.certB}` : ""}
          </span>
        </div>

        {existing.lines.length > 0 && (
          <ul className="claims diff">
            {existing.lines.map((l) => (
              <li key={l.id} data-diff={l.record === "later" ? "added" : "removed"}>
                <span className="sign" aria-hidden="true">
                  {l.record === "later" ? "+" : "-"}
                </span>
                <span className="text">{l.claim}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="small muted pretty" style={{ maxWidth: "62ch" }}>
          {look.line} Each validator reached this same answer on its own.
        </p>
      </div>
    );
  }

  return (
    <div className="stack-12" style={{ marginTop: 16 }}>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn btn-accent" onClick={ask} disabled={busy}>
          {busy ? "Asking" : `Did this change matter?${price ? ` - ${price} GEN` : ""}`}
        </button>
        <span className="mono tiny muted">asked of the network, once per change</span>
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
