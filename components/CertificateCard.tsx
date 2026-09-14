import Link from "next/link";

import type { Certificate } from "@/lib/types";
import { displayUrl, shortDigest, splitIso } from "@/lib/format";
import ClaimList from "./ClaimList";

/**
 * The shareable unit, designed as an image first and a web page second.
 *
 * Everything a reader needs to judge it sits inside the frame: the moment,
 * the page, the claims and the digest. Nothing depends on the surrounding
 * page, because most of the time it will be seen as a screenshot of itself.
 */
export default function CertificateCard({
  cert,
  href,
  dense = false,
}: {
  cert: Certificate;
  href?: string;
  dense?: boolean;
}) {
  const { d, t } = splitIso(cert.at);
  const link = href ?? `/c/${cert.id}`;
  const shown = dense ? cert.claims.slice(0, 3) : cert.claims;
  const rest = cert.claims.length - shown.length;

  return (
    <article className="cert">
      <header className="cert-head">
        <Link href={link}>certificate {cert.id}</Link>
        <span style={{ color: "var(--slab-muted)" }}>{shortDigest(cert.claimsDigest)}</span>
      </header>

      <div className="cert-when">
        <span className="d">{d}</span>
        <span className="t">
          {t} <span className="z">UTC</span>
        </span>
        <p className="cert-url">
          {cert.kind === "page" ? (
            <a href={cert.url} rel="nofollow noopener noreferrer" target="_blank">
              {displayUrl(cert.url)}
            </a>
          ) : (
            <span>{displayUrl(cert.url)}</span>
          )}
        </p>
      </div>

      <div className="cert-body">
        <ClaimList claims={shown} dense />
        {rest > 0 && (
          <p className="mono tiny muted" style={{ paddingTop: 10 }}>
            + {rest} more {rest === 1 ? "claim" : "claims"}
          </p>
        )}
      </div>

      <footer className="cert-foot">
        {cert.kind === "contract" ? (
          <span className="tag">contract views</span>
        ) : cert.cloaking ? (
          <span className="tag tag-flag">cloaking</span>
        ) : (
          <span className="tag tag-ok">image matches text</span>
        )}
        <div className="spacer" />
        <Link href={link} className="mono tiny">
          Read it →
        </Link>
      </footer>
    </article>
  );
}
