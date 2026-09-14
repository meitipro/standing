import { ImageResponse } from "next/og";

import { assessmentForPair, getCertificate } from "@/lib/store";
import { displayUrl, splitIso } from "@/lib/format";

/**
 * Edge, not nodejs, and that is not a preference. next/og's node build loads
 * its font at module scope with a path join that survives on posix and throws
 * ERR_INVALID_URL on Windows, before any argument of ours is read. The edge
 * build defers the same font behind a promise. Same renderer either way.
 */
export const runtime = "edge";
export const alt = "Standing certificate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Always the dark slab: an open graph image cannot know the reader's theme,
 * and a card that changed colour between viewers would be a worse artifact. */
const SLAB = "#17160f";
const INK = "#f3f0e8";
const MUTED = "#a89f8a";
const LINE = "#3a382c";
const ACCENT = "#8d7dfb";
const FLAG = "#e8825f";

function pill(text: string, colour: string) {
  return (
    <span style={{ display: "flex", fontSize: 15, letterSpacing: 1.2, padding: "5px 12px", borderRadius: 2, border: `1px solid ${colour}`, color: colour }}>
      {text}
    </span>
  );
}

export default async function Image({ params }: { params: { id: string } }) {
  const cert = await getCertificate(Number(params.id));

  if (!cert) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: SLAB, color: INK, fontSize: 44 }}>
          Certificate not found
        </div>
      ),
      size,
    );
  }

  const { d, t } = splitIso(cert.at);

  /* The judgment of this capture against the previous one, if anyone asked.
   * Wrapped so the card never fails over the least important thing on it. */
  let verdict = null;
  try {
    if (cert.previous !== null) verdict = await assessmentForPair(cert.previous, cert.id);
  } catch {
    verdict = null;
  }
  const changedTo = verdict?.verdict === "material" ? verdict.lines.find((l) => l.record === "later") : undefined;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: SLAB, color: INK }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "34px 48px", borderBottom: `1px solid ${LINE}` }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect x="1.5" y="1.5" width="21" height="21" rx="2" stroke={ACCENT} strokeWidth="1.6" />
            <circle cx="12" cy="12" r="6.6" stroke={INK} strokeWidth="1.6" />
            <path d="M12 7.6V12l3.1 2.2" stroke={INK} strokeWidth="1.6" strokeLinecap="square" />
          </svg>
          <span style={{ fontSize: 22, letterSpacing: -0.5 }}>standing</span>
          <div style={{ display: "flex", flex: 1 }} />
          <span style={{ fontSize: 17, letterSpacing: 1.6, color: MUTED }}>CERTIFICATE {cert.id}</span>
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "40px 48px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 62, letterSpacing: -2.4 }}>{d}</span>
            <span style={{ fontSize: 62, letterSpacing: -2.4, color: ACCENT }}>{t}</span>
            <span style={{ fontSize: 26, color: MUTED }}>UTC</span>
          </div>
          <span style={{ fontSize: 23, color: MUTED, marginTop: 18 }}>{displayUrl(cert.url).slice(0, 76)}</span>
          <span style={{ fontSize: 22, lineHeight: 1.45, marginTop: 26, maxWidth: 940 }}>
            {cert.claims.length} {cert.claims.length === 1 ? "claim" : "claims"} confirmed by independent validators
            {cert.claims[0] ? `, including: “${cert.claims[0].slice(0, 104)}”` : "."}
          </span>
          {changedTo && (
            <span style={{ display: "flex", fontSize: 20, lineHeight: 1.4, marginTop: 22, paddingLeft: 16, borderLeft: `3px solid ${FLAG}`, color: INK, maxWidth: 940 }}>
              {`Material change since capture ${verdict?.certA}: now “${changedTo.claim}”`.slice(0, 150)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "26px 48px", borderTop: `1px solid ${LINE}` }}>
          {cert.kind === "contract" ? pill("CONTRACT VIEWS", MUTED) : cert.cloaking ? pill("CLOAKING", FLAG) : pill("IMAGE MATCHES TEXT", ACCENT)}
          {verdict && pill(verdict.verdict.toUpperCase(), verdict.verdict === "material" ? FLAG : ACCENT)}
          <div style={{ display: "flex", flex: 1 }} />
          <span style={{ fontSize: 16, color: MUTED }}>What this page stated, and when.</span>
        </div>
      </div>
    ),
    size,
  );
}
