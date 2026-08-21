import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import ClaimList, { ClaimDiff } from "@/components/ClaimList";
import AgreementMeter from "@/components/AgreementMeter";
import CloakingNotice from "@/components/CloakingNotice";
import CitationBlock from "@/components/CitationBlock";
import CopyButton from "@/components/CopyButton";
import ChangeVerdict from "@/components/ChangeVerdict";
import Mark from "@/components/Mark";
import { assessmentForPair, getCertificate, historyForUrl } from "@/lib/store";
import {
  displayUrl,
  formatCount,
  formatStamp,
  shortAddress,
  splitIso,
} from "@/lib/format";
import { SAMPLE_MODE } from "@/lib/seed";

export const revalidate = 5;

type Params = { params: { id: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const cert = await getCertificate(Number(params.id));
  if (!cert) return { title: "Certificate not found" };

  const title = `${displayUrl(cert.url)} — captured ${formatStamp(cert.at)}`;
  const description = `${cert.claims.length} claims, agreed by independent validators. ${
    cert.cloaking ? "Cloaking flag raised." : "Image matches text."
  } This proves several validators saw these claims at this time, not that they are true.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/c/${cert.id}/opengraph-image`],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CertificatePage({ params }: Params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) notFound();

  const cert = await getCertificate(id);
  if (!cert) notFound();

  const history = await historyForUrl(cert.url);
  const index = history.findIndex((c) => c.id === cert.id);
  const previous = index > 0 ? history[index - 1] : null;

  const added = previous
    ? cert.claims.filter((c) => !previous.claims.includes(c))
    : [];
  const removed = previous
    ? previous.claims.filter((c) => !cert.claims.includes(c))
    : [];

  const { d, t } = splitIso(cert.at);
  const previousDay = previous ? splitIso(previous.at).d : "";

  /* Only asked for when there is a previous capture to compare against, so a
   * first capture costs no extra chain read. */
  const assessment = previous
    ? await assessmentForPair(previous.id, cert.id)
    : null;

  const record = {
    id: cert.id,
    url: cert.url,
    title: cert.title,
    claims: cert.claims,
    text_digest: cert.textDigest,
    shot_digest: cert.shotDigest,
    shot_digest_attested_by: "leader",
    cloaking: cert.cloaking,
    threshold_bps: cert.thresholdBps,
    text_chars: cert.textChars,
    status_code: cert.statusCode,
    at: cert.at,
    requester: cert.requester,
  };

  return (
    <article>
      {/* ---------- state ---------- */}
      <section className="pad" style={{ paddingTop: 40 }}>
        <div className="row" style={{ gap: 8, marginBottom: 32 }}>
          <span className="tag tag-ink">certificate {cert.id}</span>
          {cert.cloaking ? (
            <span className="tag tag-flag">cloaking detected</span>
          ) : (
            <span className="tag tag-ok">image matches text</span>
          )}
          {cert.finalized ? (
            <span className="tag">finalized</span>
          ) : (
            <span className="tag tag-prov">provisional</span>
          )}
          {cert.watched && (
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

      {/* ---------- the moment ----------
          The entire product is a claim about one instant, so the instant is the
          largest thing on the page by a wide margin. */}
      <header
        className="pad"
        style={{ paddingBottom: 44, borderBottom: "1px solid var(--line)" }}
      >
        <p className="eyebrow" style={{ marginBottom: 18 }}>
          Captured at
        </p>
        <span className="stamp">{d}</span>
        <span className="stamp stamp-time">
          {t}
          <span className="stamp-zone"> UTC</span>
        </span>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 28px",
            alignItems: "baseline",
          }}
        >
          <a
            href={cert.url}
            rel="nofollow noopener noreferrer"
            target="_blank"
            className="mono break"
            style={{ fontSize: 16 }}
          >
            {cert.url}
          </a>
          {cert.title && <span className="muted">{cert.title}</span>}
        </div>

        {!cert.finalized && (
          <p className="small muted pretty" style={{ marginTop: 16, maxWidth: "68ch" }}>
            This certificate is readable because the network accepted it, but
            the appeal window has not closed. It is provisional until it
            finalizes.
          </p>
        )}
      </header>

      {/* ---------- the verdict ---------- */}
      <CloakingNotice cloaking={cert.cloaking} />

      {/* ---------- claims, and the record behind them ---------- */}
      <section className="split">
        <div style={{ padding: "44px var(--pad)" }}>
          <p className="eyebrow" style={{ marginBottom: 22 }}>
            Claims agreed by the validators
          </p>
          <ClaimList claims={cert.claims} />

          {previous && (added.length > 0 || removed.length > 0) && (
            <div className="panel" style={{ marginTop: 40 }}>
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span className="eyebrow">Change since {previousDay}</span>
                {cert.watched ? (
                  <Link
                    href={`/w/${cert.watchId}`}
                    className="mono tiny"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    Full timeline →
                  </Link>
                ) : (
                  <Link
                    href={`/c/${previous.id}`}
                    className="mono tiny"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    Previous capture →
                  </Link>
                )}
              </div>
              <div style={{ padding: "4px 16px 18px" }}>
                <ClaimDiff added={added} removed={removed} />
                {/* The diff says what moved. This says whether it mattered,
                    which is the judgment only the network can settle. */}
                <ChangeVerdict
                  certA={previous.id}
                  certB={cert.id}
                  existing={assessment}
                />
              </div>
            </div>
          )}

          <p
            className="small muted pretty"
            style={{ marginTop: 24, maxWidth: "62ch" }}
          >
            Several independent validators fetched this page at this time and
            agreed these claims were on it. That is not a statement that the
            claims are true.
          </p>
        </div>

        <div
          className="stack-36"
          style={{ padding: "44px var(--pad)", background: "var(--panel)" }}
        >
          <div>
            <p className="eyebrow" style={{ marginBottom: 14 }}>
              Agreement threshold
            </p>
            <AgreementMeter thresholdBps={cert.thresholdBps} />
          </div>

          <div>
            <p className="eyebrow" style={{ marginBottom: 14 }}>
              On-chain record
            </p>
            <div className="rec">
              {/* Being precise about which digest means what is the difference
                  between evidence and a number. */}
              <div className="rec-digest">
                <div className="rec-digest-head">
                  <span className="k">text sha256</span>
                  <span className="tag tag-ok">network-verified</span>
                </div>
                <p className="hash">{cert.textDigest}</p>
              </div>

              <div className="rec-digest">
                <div className="rec-digest-head">
                  <span className="k">screenshot sha256</span>
                  <span className="tag tag-prov">leader-attested</span>
                </div>
                <p className="hash muted">{cert.shotDigest}</p>
              </div>

              <div className="rec-row">
                <span className="k">characters</span>
                <span className="v">{formatCount(cert.textChars)}</span>
              </div>
              <div className="rec-row">
                <span className="k">http status</span>
                <span className="v">{cert.statusCode}</span>
              </div>
              <div className="rec-row">
                <span className="k">threshold</span>
                <span className="v">{cert.thresholdBps} bps</span>
              </div>
              <div className="rec-row">
                <span className="k">requester</span>
                <span className="v" title={cert.requester}>
                  {shortAddress(cert.requester)}
                </span>
              </div>

              <p className="rec-note">
                These two digests are not worth the same. Every validator
                recomputed the text digest independently. The screenshot digest
                was attested by the leader alone and no one else re-derived it —
                two browsers never render one page to identical pixels, so the
                network cannot compare images byte for byte.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- citation and export ---------- */}
      <section className="band pad" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>
          Cite this
        </p>
        <CitationBlock cert={cert} />

        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <button className="btn btn-accent" type="button">
            Export evidence bundle · 0.2 GEN
          </button>
          <CopyButton
            value={JSON.stringify(record, null, 2)}
            label="Copy the on-chain record"
            done="Copied"
            className="btn"
          />
          <a className="btn" href={`/api/v1/certificates/${cert.id}`}>
            Open as JSON
          </a>
          <Link className="btn" href="/verify">
            Verify independently
          </Link>
          <Link
            className="btn"
            href={`/watch?url=${encodeURIComponent(cert.url)}`}
          >
            Watch this page
          </Link>
          <a
            className="btn btn-danger"
            href={`mailto:abuse@standing.wtf?subject=Certificate%20${cert.id}`}
          >
            Report
          </a>
        </div>
      </section>

      {/* ---------- the share card ----------
          Most people will meet this certificate as an image in a timeline
          rather than as a page, so the author is shown exactly what they are
          about to hand round. */}
      <section
        className="band pad"
        style={{ paddingTop: 44, paddingBottom: 72 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <p className="eyebrow">Share card — 1200 × 630</p>
          <span className="small muted">
            The artifact most people actually see, in a tweet or a filing.
          </span>
        </div>

        <div className="sharecard shadow-soft">
          <div className="sharecard-head">
            <Mark size={24} frame="var(--accent-bright)" face="var(--slab-ink)" />
            <span
              className="mono"
              style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              standing
            </span>
            <div className="spacer" />
            <span className="eyebrow" style={{ color: "var(--slab-muted)" }}>
              certificate {cert.id}
            </span>
          </div>

          <div className="sharecard-body">
            <p className="stamp-line">
              {d} <span className="t">{t}</span>{" "}
              <span className="z">UTC</span>
            </p>
            <p className="url">{displayUrl(cert.url)}</p>
            <p className="gist">
              {cert.claims.length}{" "}
              {cert.claims.length === 1 ? "claim" : "claims"} agreed by
              independent validators
              {cert.claims[0] ? `, including: “${cert.claims[0]}”` : "."}
            </p>
          </div>

          <div className="sharecard-foot">
            {cert.cloaking ? (
              <span className="tag tag-flag">cloaking detected</span>
            ) : (
              <span className="tag tag-ok">image matches text</span>
            )}
            <span className="tag">
              {cert.finalized ? "finalized" : "provisional"}
            </span>
            <div className="spacer" />
            <span
              className="mono"
              style={{
                fontSize: "clamp(8px, 0.95vw, 12px)",
                color: "var(--slab-muted)",
              }}
            >
              Proof it was said. Not proof it is true.
            </span>
          </div>
        </div>

        {SAMPLE_MODE && (
          <p className="mono tiny muted" style={{ marginTop: 28 }}>
            Sample record. No contract is deployed, nothing here was notarised,
            and this page must not be cited.
          </p>
        )}
      </section>
    </article>
  );
}
