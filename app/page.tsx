import Link from "next/link";

import NotarizeField from "@/components/NotarizeField";
import CertificateCard from "@/components/CertificateCard";
import { getStats, listCertificates } from "@/lib/store";
import { displayUrl, formatCount, splitIso } from "@/lib/format";
import { SAMPLE_MODE } from "@/lib/seed";

export const revalidate = 5;

/* The five node glyphs and four overlap bars in the "how it works" plates are
 * decoration, not data. They are declared once here so the markup below stays
 * about layout. */
const NODES = [1, 2, 3, 4, 5];
const OVERLAP = ["86%", "92%", "78%", "95%"];

export default async function Home() {
  const [certs, stats] = await Promise.all([listCertificates(6), getStats()]);
  const featured = certs[0];
  const recent = certs.slice(1, 6);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section
        className="pad ruled"
        style={{
          paddingTop: 76,
          paddingBottom: 64,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 56,
          alignItems: "start",
        }}
      >
        <div>
          <p className="eyebrow eyebrow-accent" style={{ marginBottom: 28 }}>
            // web evidence, agreed by strangers
          </p>
          <h1 className="display" style={{ margin: "0 0 24px" }}>
            Freeze what this page says.
          </h1>
          <p className="lede" style={{ maxWidth: 520, marginBottom: 36 }}>
            Paste a url. Independent validators fetch it, agree on what it
            claims, and record a certificate with a screenshot digest and a
            timestamp.
          </p>

          <NotarizeField autoFocus />

          <div className="stats" style={{ marginTop: 56, maxWidth: 560 }}>
            <div className="stat" style={{ paddingLeft: 0 }}>
              <span className="n">
                0.4 <small>GEN</small>
              </span>
              <span className="k">per capture</span>
            </div>
            <div className="stat">
              <span className="n">
                ~40 <small>s</small>
              </span>
              <span className="k">typical capture</span>
            </div>
            <div className="stat">
              <span className="n">
                6000 <small>bps</small>
              </span>
              <span className="k">agreement threshold</span>
            </div>
          </div>
        </div>

        {/* The product explains itself by showing its output, so a real record
            sits in the hero rather than an illustration of one. */}
        {featured && (
          <div>
            <div
              className="eyebrow"
              style={{
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span>Output, not a mockup</span>
              <Link
                href={`/c/${featured.id}`}
                style={{ letterSpacing: "0.06em" }}
              >
                Open certificate →
              </Link>
            </div>
            <div className="shadow-soft">
              <CertificateCard cert={featured} dense />
            </div>
          </div>
        )}
      </section>

      {/* ---------- how it works ---------- */}
      <section className="band pad" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <p className="eyebrow" style={{ marginBottom: 36 }}>
          How it works
        </p>

        <div
          className="panel split"
          style={{
            overflow: "hidden",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <div style={{ padding: "26px 24px 24px" }}>
            <p
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <span className="eyebrow eyebrow-accent">01</span>
              <span className="eyebrow" style={{ color: "var(--ink)" }}>
                Capture
              </span>
            </p>

            <div className="plate" aria-hidden="true">
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {NODES.map((n) => (
                  <span key={n} className="node">
                    {n}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {NODES.map((n) => (
                  <span
                    key={n}
                    style={{
                      width: 22,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 1,
                        height: 20,
                        background: "var(--line)",
                      }}
                    />
                  </span>
                ))}
              </div>
              <div
                className="eyebrow"
                style={{
                  border: "1px dashed var(--muted)",
                  borderRadius: "var(--radius)",
                  padding: "5px 0",
                  textAlign: "center",
                  fontSize: 11,
                }}
              >
                the live page
              </div>
            </div>

            <p className="small muted pretty" style={{ lineHeight: 1.5 }}>
              Several unrelated validator nodes fetch the url independently,
              each rendering it themselves. No single server is trusted with the
              capture.
            </p>
          </div>

          <div style={{ padding: "26px 24px 24px" }}>
            <p
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <span className="eyebrow eyebrow-accent">02</span>
              <span className="eyebrow" style={{ color: "var(--ink)" }}>
                Agree
              </span>
            </p>

            <div
              className="plate"
              aria-hidden="true"
              style={{ justifyContent: "center", gap: 7 }}
            >
              {OVERLAP.map((w) => (
                <span key={w} className="bar">
                  <span style={{ width: w }} />
                </span>
              ))}
              <span
                className="eyebrow"
                style={{ fontSize: 10, textAlign: "right", paddingTop: 2 }}
              >
                overlap ≥ 6000 bps
              </span>
            </div>

            <p className="small muted pretty" style={{ lineHeight: 1.5 }}>
              Optimistic Democracy resolves agreement on meaning, not on
              byte-identical output — the only way nodes can agree on a live,
              changing page.
            </p>
          </div>

          <div style={{ padding: "26px 24px 24px" }}>
            <p
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <span className="eyebrow eyebrow-accent">03</span>
              <span className="eyebrow" style={{ color: "var(--ink)" }}>
                Record
              </span>
            </p>

            <div
              className="plate"
              aria-hidden="true"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                justifyContent: "flex-start",
              }}
            >
              <span
                style={{
                  width: 56,
                  height: 56,
                  border: "1px solid var(--accent)",
                  borderRadius: "var(--radius)",
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="1.5"
                    y="1.5"
                    width="21"
                    height="21"
                    rx="2"
                    stroke="var(--accent)"
                    strokeWidth="1.4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="6.6"
                    stroke="var(--ink)"
                    strokeWidth="1.4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M12 7.6V12l3.1 2.2"
                    stroke="var(--ink)"
                    strokeWidth="1.4"
                    strokeLinecap="square"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </span>
              <span
                className="mono"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                <span className="break">
                  {featured
                    ? `sha256:${featured.textDigest.slice(0, 6)}…${featured.textDigest.slice(-4)}`
                    : "sha256:…"}
                </span>
                <span style={{ height: 1, background: "var(--line)" }} />
                <span>{featured ? `${featured.at}Z` : "—"}</span>
                <span style={{ height: 1, background: "var(--line)" }} />
                <span style={{ color: "var(--accent)" }}>
                  threshold {featured ? featured.thresholdBps : 6000} bps
                </span>
              </span>
            </div>

            <p className="small muted pretty" style={{ lineHeight: 1.5 }}>
              The agreed claims, both digests and the moment are written
              on-chain. Permanent, timestamped, and citable by anyone
              afterwards.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- what it proves, and what it does not ---------- */}
      <section className="band split">
        <div style={{ padding: "44px var(--pad)" }}>
          <p className="eyebrow eyebrow-accent" style={{ marginBottom: 20 }}>
            What a certificate proves
          </p>
          <ul className="ledger" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li className="ledger-yes">
              <span className="sign" aria-hidden="true">
                +
              </span>
              <span>
                Several independent validators fetched this url and agreed on
                what it said.
              </span>
            </li>
            <li className="ledger-yes">
              <span className="sign" aria-hidden="true">
                +
              </span>
              <span>
                The moment of capture, written on-chain and not editable
                afterwards.
              </span>
            </li>
            <li className="ledger-yes">
              <span className="sign" aria-hidden="true">
                +
              </span>
              <span>
                Whether the rendered screenshot matched the text the page
                served.
              </span>
            </li>
          </ul>
        </div>

        <div style={{ padding: "44px var(--pad)", background: "var(--panel)" }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>
            What it does not prove
          </p>
          <ul className="ledger" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li className="ledger-no">
              <span className="sign" aria-hidden="true">
                &minus;
              </span>
              <span>That any claim on the page is true.</span>
            </li>
            <li className="ledger-no">
              <span className="sign" aria-hidden="true">
                &minus;
              </span>
              <span>
                That the page showed the same thing to every other reader.
              </span>
            </li>
            <li className="ledger-no">
              <span className="sign" aria-hidden="true">
                &minus;
              </span>
              <span>
                That the screenshot digest was recomputed by anyone but the
                leader.
              </span>
            </li>
          </ul>
          <p style={{ marginTop: 20 }}>
            <Link href="/verify" className="mono tiny">
              The limits in full →
            </Link>
          </p>
        </div>
      </section>

      {/* ---------- why it has to be GenLayer ---------- */}
      <section
        className="band slab pad"
        style={{ paddingTop: 72, paddingBottom: 72 }}
      >
        <blockquote
          className="serif"
          style={{
            margin: 0,
            maxWidth: 900,
            fontSize: "clamp(28px, 3.6vw, 46px)",
            lineHeight: 1.16,
            textWrap: "pretty",
          }}
        >
          “One server capturing one screenshot is a trusted party. Many nodes
          agreeing on the claims is evidence.”
        </blockquote>
        <p
          className="eyebrow"
          style={{ marginTop: 28, color: "var(--slab-muted)" }}
        >
          Why it has to be GenLayer — Intelligent Contracts reach the live web
          and an LLM from inside the contract itself.
        </p>
      </section>

      {/* ---------- price and watch ---------- */}
      <section className="band split">
        <div style={{ padding: "44px var(--pad)" }}>
          <p className="eyebrow" style={{ marginBottom: 18 }}>
            Price
          </p>
          <p
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 44, letterSpacing: "-0.03em", lineHeight: 1 }}
            >
              0.4
            </span>
            <span className="mono muted" style={{ fontSize: 18 }}>
              GEN / capture
            </span>
          </p>
          <p className="muted pretty" style={{ maxWidth: 420, marginBottom: 20 }}>
            One flat fee, paid at notarization. Evidence-bundle export is priced
            separately. There is no subscription and no rate card.
          </p>
          {featured && (
            <Link href={`/c/${featured.id}`} className="mono tiny">
              See a certificate →
            </Link>
          )}
        </div>

        <div style={{ padding: "44px var(--pad)", background: "var(--panel)" }}>
          <p className="eyebrow" style={{ marginBottom: 18 }}>
            Watch mode
          </p>
          <p
            className="serif"
            style={{ fontSize: 30, lineHeight: 1.1, marginBottom: 16 }}
          >
            Turn a certificate into a monitor.
          </p>
          <p className="muted pretty" style={{ maxWidth: 420, marginBottom: 20 }}>
            Re-capture a page on a cadence and keep a claim-by-claim ledger of
            what was added, removed or quietly reworded — with a first-seen and
            last-seen date for every claim.
          </p>
          <Link
            href="/watch"
            className="mono"
            style={{
              display: "flex",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--bg)",
              maxWidth: 420,
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <span
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRight: "1px solid var(--line)",
              }}
            >
              daily
            </span>
            <span
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRight: "1px solid var(--line)",
              }}
            >
              30 captures
            </span>
            <span style={{ padding: "10px 14px", color: "var(--ink)" }}>
              = 12.0 GEN
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- recent captures ---------- */}
      {recent.length > 0 && (
        <section
          className="band pad"
          style={{ paddingTop: 56, paddingBottom: 72 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 20,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <p className="eyebrow">
              Recent captures · {formatCount(stats.certificates)} records
            </p>
            {SAMPLE_MODE && (
              <span
                className="mono tiny"
                style={{ color: "var(--flag)", letterSpacing: "0.06em" }}
              >
                seed data
              </span>
            )}
          </div>

          <div className="scroll-x table-framed">
            <table className="table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th style={{ width: 190 }}>Captured</th>
                  <th style={{ width: 90 }}>Claims</th>
                  <th style={{ width: 140 }}>State</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const { d, t } = splitIso(c.at);
                  return (
                    <tr key={c.id}>
                      <td className="break">
                        <Link href={`/c/${c.id}`}>{displayUrl(c.url)}</Link>
                      </td>
                      <td className="muted">
                        {d} {t}
                      </td>
                      <td className="muted">{c.claims.length}</td>
                      <td>
                        {c.cloaking ? (
                          <span style={{ color: "var(--flag)" }}>cloaking</span>
                        ) : !c.finalized ? (
                          <span className="muted">provisional</span>
                        ) : (
                          <span>finalized</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
