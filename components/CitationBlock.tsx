import { formatStamp, displayUrl } from "@/lib/format";
import { ORIGIN } from "@/lib/chain";
import type { Certificate } from "@/lib/types";
import CopyButton from "./CopyButton";

/**
 * One line to paste into an article, a filing or a thread.
 *
 * It has to survive being pasted somewhere with no styling, so it is a single
 * sentence carrying the four things a reader needs: what page, at what moment,
 * where the record is, and what it does not claim.
 */
export function citationFor(cert: Certificate): string {
  return `${displayUrl(cert.url)} as it stood at ${formatStamp(
    cert.at
  )} — Standing certificate ${cert.id}, ${ORIGIN.replace(
    /^https?:\/\//,
    ""
  )}/c/${cert.id}. Attests what the page said, not that it was true.`;
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
