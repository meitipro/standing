import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import ClaimList, { ClaimDiff } from "@/components/ClaimList";
import CloakingNotice from "@/components/CloakingNotice";
import CitationBlock from "@/components/CitationBlock";
import CopyButton from "@/components/CopyButton";
import ChangeVerdict from "@/components/ChangeVerdict";
import Mark from "@/components/Mark";
import { assessmentForPair, getCertificate, getStats } from "@/lib/store";
import { EXPLORER } from "@/lib/chain";
import { diffClaims } from "@/lib/claims";
import { displayUrl, formatGen, formatStamp, shortAddress, splitIso } from "@/lib/format";
import { certificateJson } from "@/lib/api";

export const revalidate = 5;

type Params = { params: { id: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const cert = await getCertificate(Number(params.id));
  if (!cert) return { title: "Certificate not found" };
  const title = `${displayUrl(cert.url)}, captured ${formatStamp(cert.at)}`;
  const description =
    cert.kind === "contract"
      ? `${cert.claims.length} views of a contract, as every validator read them.`
      : `${cert.claims.length} claims, each confirmed by every agreeing validator against its own copy of the page.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [`/c/${cert.id}/opengraph-image`] },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CertificatePage({ params }: Params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) notFound();

  const cert = await getCertificate(id);
  if (!cert) notFound();

  const [previous, stats] = await Promise.all([
    cert.previous !== null ? getCertificate(cert.previous) : Promise.resolve(null),
    getStats(),
  ]);
  const diff = previous ? diffClaims(previous.claims, cert.claims) : { gone: [], fresh: [] };
  const changed = diff.gone.length > 0 || diff.fresh.length > 0;
  const assessment = previous && changed ? await assessmentForPair(previous.id, cert.id) : null;

  const { d, t } = splitIso(cert.at);
  const isPage = cert.kind === "page";
  const address = isPage ? "" : cert.url.slice("genlayer://".length);

  return (
    <article>
      <section className="pad" style={{ paddingTop: 40 }}>
        <div className="row" style={{ gap: 8, marginBottom: 32 }}>
          <span className="tag tag-ink">certificate {cert.id}</span>
          {!isPage ? (
            <span className="tag">contract views</span>
          ) : cert.cloaking ? (
            <span className="tag tag-flag">cloaking</span>
          ) : (
            <span className="tag tag-ok">image matches text</span>
          )}
          {cert.watchId !== null && (
            <Link href={`/w/${cert.watchId}`} className="tag">
              watch {cert.watchId}
            </Link>
          )}
          <div className="spacer" />
          <Link href="/" className="mono tiny" style={{ letterSpacing: "0.08em" }}>
            ← back
          </Link>
        </div>
      </section>

      {/* The product is a claim about one instant, so the instant is the largest thing on the page. */}
      <header className="pad" style={{ paddingBottom: 44, borderBottom: "1px solid var(--line)" }}>
        <p className="eyebrow" style={{ marginBottom: 18 }}>
          Captured at
        </p>
        <span className="stamp">{d}</span>
        <span className="stamp stamp-time">
          {t}
          <span className="stamp-zone"> UTC</span>
        </span>
        <div style={{ marginTop: 28 }}>
          {isPage ? (
            <a href={cert.url} rel="nofollow noopener noreferrer" target="_blank" className="mono break" style={{ fontSize: 16 }}>
              {cert.url}
            </a>
          ) : (
            <a href={`${EXPLORER}/address/${address}`} rel="noopener noreferrer" target="_blank" className="mono break" style={{ fontSize: 16 }}>
              {cert.url}
            </a>
          )}
        </div>
      </header>

      {isPage && <CloakingNotice cloaking={cert.cloaking} />}

      <section className="split">
        <div style={{ padding: "44px var(--pad)" }}>
          <p className="eyebrow" style={{ marginBottom: 22 }}>
            {isPage ? "Claims every agreeing validator found on the page" : "Views, as every validator read them"}
          </p>
          <ClaimList claims={cert.claims} />

          {previous && (
            <div className="panel" style={{ marginTop: 40 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span className="eyebrow">Change since certificate {previous.id}, {splitIso(previous.at).d}</span>
                <Link href={cert.watchId !== null ? `/w/${cert.watchId}` : `/c/${previous.id}`} className="mono tiny" style={{ letterSpacing: "0.06em" }}>
                  {cert.watchId !== null ? "Full history →" : "Previous capture →"}
                </Link>
              </div>
              <div style={{ padding: "4px 16px 18px" }}>
                <ClaimDiff added={diff.fresh} removed={diff.gone} />
                {changed && (
                  <ChangeVerdict
                    certA={previous.id}
                    certB={cert.id}
                    existing={assessment}
                    price={stats ? formatGen(stats.assessFee) : null}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="stack-36" style={{ padding: "44px var(--pad)", background: "var(--panel)" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 14 }}>
              On-chain record
            </p>
            <div className="rec">
              <div className="rec-digest">
                <div className="rec-digest-head">
                  <span className="k">claims sha256</span>
                  <span className="tag tag-ok">recomputable</span>
                </div>
                <p className="hash">{cert.claimsDigest}</p>
              </div>
              <div className="rec-row">
                <span className="k">kind</span>
                <span className="v">{isPage ? "page capture" : "contract snapshot"}</span>
              </div>
              <div className="rec-row">
                <span className="k">requester</span>
                <span className="v" title={cert.requester}>
                  {shortAddress(cert.requester)}
                </span>
              </div>
              <div className="rec-row">
                <span className="k">previous</span>
                <span className="v">{previous ? <Link href={`/c/${previous.id}`}>certificate {previous.id}</Link> : "first capture of this url"}</span>
              </div>
              <p className="rec-note">
                The digest is sha256 over the claims above, joined by newlines. Anyone holding the
                list can recompute it; the verify page does, for every certificate it opens.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="band pad" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          Cite this
        </p>
        <CitationBlock cert={cert} />
        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <CopyButton value={JSON.stringify(certificateJson(cert), null, 2)} label="Copy the record" done="Copied" className="btn" />
          <a className="btn" href={`/api/v1/certificates/${cert.id}`}>
            Open as JSON
          </a>
          <Link className="btn" href={`/verify?q=${cert.id}`}>
            Verify it
          </Link>
          {isPage && (
            <Link className="btn" href={`/watch?url=${encodeURIComponent(cert.url)}`}>
              Watch this page
            </Link>
          )}
        </div>
      </section>

      {/* Most people meet a certificate as an image in a timeline, so the author sees what they hand round. */}
      <section className="band pad" style={{ paddingTop: 44, paddingBottom: 72 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <p className="eyebrow">Share card, 1200 x 630</p>
          <span className="small muted">The image a link to this page unfurls into.</span>
        </div>
        <div className="sharecard shadow-soft">
          <div className="sharecard-head">
            <Mark size={24} frame="var(--accent-bright)" face="var(--slab-ink)" />
            <span className="mono" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>
              standing
            </span>
            <div className="spacer" />
            <span className="eyebrow" style={{ color: "var(--slab-muted)" }}>
              certificate {cert.id}
            </span>
          </div>
          <div className="sharecard-body">
            <p className="stamp-line">
              {d} <span className="t">{t}</span> <span className="z">UTC</span>
            </p>
            <p className="url">{displayUrl(cert.url)}</p>
            <p className="gist">
              {cert.claims.length} {cert.claims.length === 1 ? "claim" : "claims"} confirmed by independent validators
              {cert.claims[0] ? `, including: “${cert.claims[0]}”` : "."}
            </p>
          </div>
          <div className="sharecard-foot">
            {!isPage ? (
              <span className="tag">contract views</span>
            ) : cert.cloaking ? (
              <span className="tag tag-flag">cloaking</span>
            ) : (
              <span className="tag tag-ok">image matches text</span>
            )}
            <div className="spacer" />
            <span className="mono" style={{ fontSize: "clamp(8px, 0.95vw, 12px)", color: "var(--slab-muted)" }}>
              What this page stated, and when.
            </span>
          </div>
        </div>
      </section>
    </article>
  );
}
