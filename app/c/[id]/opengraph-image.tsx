import { ImageResponse } from "next/og";
import { getCertificate } from "@/lib/store";
import { displayUrl, splitIso } from "@/lib/format";

/**
 * Edge, not nodejs, and that is not a preference.
 *
 * next/og's node build loads its own font at module scope with
 * `fileURLToPath(join(import.meta.url, "../noto-sans.ttf"))`. Joining a file://
 * url with path.join happens to survive on posix, where the result still parses
 * as a file url, and does not on win32, where it becomes `.\file:\G:\...` and
 * throws ERR_INVALID_URL. Because it runs at import time, every card 500s
 * before any argument of ours is read, so passing our own font cannot help.
 *
 * The edge build defers the same font behind a promise it only awaits if it is
 * needed, so it imports cleanly. Both builds are the same renderer.
 */
export const runtime = "edge";
export const alt = "Standing certificate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The card is always the dark slab, in both site themes. An open graph image
 * has no idea what the reader's system is set to, and a certificate that
 * changed colour between viewers would be a worse artifact than one that
 * simply picked a side. */
const SLAB = "#17160f";
const INK = "#f3f0e8";
const MUTED = "#a89f8a";
const LINE = "#3a382c";
const ACCENT = "#8d7dfb";
const FLAG = "#e8825f";

/**
 * The certificate as an image.
 *
 * Most people will meet a certificate as a card in a timeline rather than as a
 * page, so this has to carry the whole argument on its own: the moment, the
 * page, the claims, and the sentence saying what it does not prove.
 *
 * Only a regular weight is available here, so the hierarchy comes from size and
 * colour rather than from weight.
 */
export default async function Image({ params }: { params: { id: string } }) {
  const cert = await getCertificate(Number(params.id));

  if (!cert) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: SLAB,
            color: INK,
            fontSize: 44,
          }}
        >
          Certificate not found
        </div>
      ),
      size
    );
  }

  const { d, t } = splitIso(cert.at);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: SLAB,
          color: INK,
          fontFamily: "Noto Sans",
        }}
      >
        {/* head */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "34px 48px",
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect
              x="1.5"
              y="1.5"
              width="21"
              height="21"
              rx="2"
              stroke={ACCENT}
              strokeWidth="1.6"
            />
            <circle cx="12" cy="12" r="6.6" stroke={INK} strokeWidth="1.6" />
            <path
              d="M12 7.6V12l3.1 2.2"
              stroke={INK}
              strokeWidth="1.6"
              strokeLinecap="square"
            />
          </svg>
          <span style={{ fontSize: 22, letterSpacing: -0.5 }}>standing</span>
          <div style={{ display: "flex", flex: 1 }} />
          <span style={{ fontSize: 17, letterSpacing: 1.6, color: MUTED }}>
            CERTIFICATE {cert.id}
          </span>
        </div>

        {/* body */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px 48px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 62, letterSpacing: -2.4 }}>{d}</span>
            <span style={{ fontSize: 62, letterSpacing: -2.4, color: ACCENT }}>
              {t}
            </span>
            <span style={{ fontSize: 26, color: MUTED }}>UTC</span>
          </div>

          <span style={{ fontSize: 23, color: MUTED, marginTop: 18 }}>
            {displayUrl(cert.url).slice(0, 76)}
          </span>

          <span
            style={{
              fontSize: 22,
              lineHeight: 1.45,
              marginTop: 26,
              maxWidth: 940,
            }}
          >
            {cert.claims.length}{" "}
            {cert.claims.length === 1 ? "claim" : "claims"} agreed by
            independent validators
            {cert.claims[0]
              ? `, including: “${cert.claims[0].slice(0, 104)}”`
              : "."}
          </span>
        </div>

        {/* foot */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "26px 48px",
            borderTop: `1px solid ${LINE}`,
          }}
        >
          <span
            style={{
              display: "flex",
              fontSize: 15,
              letterSpacing: 1.2,
              padding: "5px 12px",
              borderRadius: 2,
              border: `1px solid ${cert.cloaking ? FLAG : ACCENT}`,
              color: cert.cloaking ? FLAG : ACCENT,
            }}
          >
            {cert.cloaking ? "CLOAKING DETECTED" : "IMAGE MATCHES TEXT"}
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 15,
              letterSpacing: 1.2,
              padding: "5px 12px",
              borderRadius: 2,
              border: `1px solid ${LINE}`,
              color: MUTED,
            }}
          >
            {cert.finalized ? "FINALIZED" : "PROVISIONAL"}
          </span>
          <div style={{ display: "flex", flex: 1 }} />
          <span style={{ fontSize: 16, color: MUTED }}>
            Proof it was said. Not proof it is true.
          </span>
        </div>
      </div>
    ),
    size
  );
}
