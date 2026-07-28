"use client";

import { useState } from "react";

export default function CopyButton({
  value,
  label = "Copy",
  done = "Copied",
  className = "btn",
}: {
  value: string;
  label?: string;
  done?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard is blocked in some embedded contexts. Selecting the text is
      // still possible, so this fails quietly rather than throwing a dialog.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? done : label}
    </button>
  );
}
