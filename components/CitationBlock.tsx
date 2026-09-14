import { formatStamp, displayUrl } from "@/lib/format";
import { ORIGIN } from "@/lib/chain";
import type { Certificate } from "@/lib/types";
import CopyButton from "./CopyButton";

/**
 * One line to paste into an article, a filing or a thread. It survives being
 * pasted somewhere with no styling: which page, which moment, where the
 * record is, and what the record is.
 */
export function citationFor(cert: Certificate): string {
  const where = `${ORIGIN.replace(/^https?:\/\//, "")}/c/${cert.id}`;
  if (cert.kind === "contract") {
    return `${displayUrl(cert.url)} as its views read at ${formatStamp(cert.at)}. Standing certificate ${cert.id}, ${where}.`;
  }
  return `${displayUrl(cert.url)} as it stood at ${formatStamp(cert.at)}. Standing certificate ${cert.id}, ${where}: what the page stated, each claim confirmed by independent validators.`;
}

export default function CitationBlock({ cert }: { cert: Certificate }) {
  const text = citationFor(cert);
  return (
    <div className="cite">
      <code>{text}</code>
      <CopyButton value={text} label="copy" done="copied" className="btn btn-slab" />
    </div>
  );
}
