import Link from "next/link";

import NotarizeField from "@/components/NotarizeField";
import CertificateCard from "@/components/CertificateCard";
import { getStats, listCertificates } from "@/lib/store";
import { CHAIN } from "@/lib/chain";
import { displayUrl, formatCount, formatGen, shortDigest, splitIso } from "@/lib/format";
import { LIMITS } from "@/lib/limits";

export const revalidate = 5;

/* The node glyphs and check rows in the "how it works" plates are decoration,
 * declared once so the markup below stays about layout. */
const NODES = [1, 2, 3, 4, 5];
const CHECKS = ["c1", "c2", "c3", "c4"];

/** What a certificate stores, and the mechanism behind each part. */
const HOLDS = [
  ["The claims", "Proposed by one validator, then checked one by one by every other validator against the copy of the page it read itself. A claim it cannot find is a vote against the whole certificate."],
  ["A digest of the claims", "sha256 of the claims joined by newlines, so anyone holding the list can recompute it and compare."],
  ["The image check", "Each validator compares its own screenshot with the text it was served. The answers are compared exactly."],
  ["The moment", "The transaction's own datetime, written by the chain and not by anyone who took part."],
  ["Who asked", "The account that paid, stored on the certificate and shown with it."],
];

export default async function Home() {
  const [certs, stats] = await Promise.all([listCertificates(6), getStats()]);
  const featured = certs[0];
  const recent = certs.slice(1, 6);
  const price = stats ? formatGen(stats.fee) : null;

  return (
    <>
      <section
        className="pad ruled"
        style={{ paddingTop: 76, paddingBottom: 64, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 56, alignItems: "start" }}
      >
        <div>
          <p className="eyebrow eyebrow-accent" style={{ marginBottom: 28 }}>
            // web evidence, agreed by strangers
          </p>
          <h1 className="display" style={{ margin: "0 0 24px" }}>
            Freeze what this page says.
          </h1>
          <p className="lede" style={{ maxWidth: 520, marginBottom: 36 }}>
            Paste a url. Every validator reads the page for itself, checks each claim against its
            own copy, and the claims they all found are recorded with the moment they were read.
          </p>

          <NotarizeField price={price} network={CHAIN.name} />

          <div className="stats" style={{ marginTop: 56, maxWidth: 560 }}>
            <div className="stat" style={{ paddingLeft: 0 }}>
              <span className="n">
                {price ?? "-"} <small>GEN</small>
              </span>
              <span className="k">per capture</span>
            </div>
            <div className="stat">
              <span className="n">
                {LIMITS.MIN_CLAIMS} to {LIMITS.MAX_CLAIMS}
              </span>
              <span className="k">claims per certificate</span>
            </div>
            <div className="stat">
              <span className="n">{stats ? formatCount(stats.certificates) : "-"}</span>
              <span className="k">certificates on chain</span>
            </div>
          </div>
        </div>

        {featured ? (
          <div>
            <div className="eyebrow" style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <h2 className="eyebrow">The newest certificate</h2>
              <Link href={`/c/${featured.id}`} style={{ letterSpacing: "0.06em" }}>
                Open it →
              </Link>
            </div>
            <div className="shadow-soft">
              <CertificateCard cert={featured} dense />
            </div>
          </div>
        ) : (
          <div>
            <h2 className="eyebrow" style={{ marginBottom: 14 }}>
              Nothing captured yet
            </h2>
            <div
              style={{
                border: "1px dashed var(--line)",
                borderRadius: "var(--radius)",
                background: "var(--panel)",
                padding: "36px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <p className="serif" style={{ fontSize: 26, lineHeight: 1.15 }}>
                The first certificate will appear here.
              </p>
              <p className="small muted pretty" style={{ maxWidth: "46ch" }}>
                Every record on this site is read from the contract. Paste a url above and it
                becomes the first one.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="band pad" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <h2 className="eyebrow" style={{ marginBottom: 36 }}>
          How it works
        </h2>

        <div className="panel split" style={{ overflow: "hidden", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}>
          <div style={{ padding: "26px 24px 24px" }}>
            <h3 style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
              <span className="eyebrow eyebrow-accent">01</span>
              <span className="eyebrow" style={{ color: "var(--ink)" }}>
                Read
              </span>
            </h3>
            <div className="plate" aria-hidden="true">
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {NODES.map((n) => (
                  <span key={n} className="node">
                    {n}
                  </span>
                ))}
              </div>
              <div
                className="eyebrow"
                style={{ border: "1px dashed var(--muted)", borderRadius: "var(--radius)", padding: "5px 0", textAlign: "center", fontSize: 11 }}
              >
                five copies of the page
              </div>
            </div>
            <p className="small muted pretty" style={{ lineHeight: 1.5 }}>
              Every validator fetches and renders the url itself. No node reads another&apos;s copy,
              and no server of ours is involved.
            </p>
          </div>

          <div style={{ padding: "26px 24px 24px" }}>
            <h3 style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
              <span className="eyebrow eyebrow-accent">02</span>
              <span className="eyebrow" style={{ color: "var(--ink)" }}>
                Check
              </span>
            </h3>
            <div className="plate" aria-hidden="true" style={{ justifyContent: "center", gap: 6 }}>
              {CHECKS.map((c) => (
                <span key={c} className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                  <span>{c}</span>
                  <span style={{ color: "var(--accent)" }}>found</span>
                </span>
              ))}
            </div>
            <p className="small muted pretty" style={{ lineHeight: 1.5 }}>
              One validator proposes up to {LIMITS.MAX_CLAIMS} claims. Each of the others checks
              every claim against its own copy and agrees only if it finds them all.
            </p>
          </div>

          <div style={{ padding: "26px 24px 24px" }}>
            <h3 style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
              <span className="eyebrow eyebrow-accent">03</span>
              <span className="eyebrow" style={{ color: "var(--ink)" }}>
                Record
              </span>
            </h3>
            <div className="plate" aria-hidden="true" style={{ justifyContent: "center", gap: 8 }}>
              <span className="mono break" style={{ fontSize: 11, color: "var(--muted)" }}>
                {featured ? `sha256:${shortDigest(featured.claimsDigest, 6, 4)}` : "sha256:..."}
              </span>
              <span style={{ height: 1, background: "var(--line)" }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                {featured ? `${featured.at}Z` : "the transaction's datetime"}
              </span>
            </div>
            <p className="small muted pretty" style={{ lineHeight: 1.5 }}>
              The agreed claims, their digest and the moment go on chain, citable by anyone and
              readable without this site.
            </p>
          </div>
        </div>
      </section>

      <section className="band pad" style={{ paddingTop: 48, paddingBottom: 48 }}>
        <h2 className="eyebrow eyebrow-accent" style={{ marginBottom: 20 }}>
          What a certificate holds
        </h2>
        <dl className="kv" style={{ maxWidth: 860 }}>
          {HOLDS.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd className="pretty">{v}</dd>
            </div>
          ))}
        </dl>
        <p style={{ marginTop: 20 }}>
          <Link href="/verify" className="mono tiny">
            Check one yourself →
          </Link>
        </p>
      </section>

      <section className="band slab pad" style={{ paddingTop: 72, paddingBottom: 72 }}>
        <blockquote className="serif" style={{ margin: 0, maxWidth: 900, fontSize: "clamp(28px, 3.6vw, 46px)", lineHeight: 1.16, textWrap: "pretty" }}>
          “One server capturing one screenshot is a trusted party. Many nodes agreeing on the
          claims is evidence.”
        </blockquote>
        <p className="eyebrow" style={{ marginTop: 28, color: "var(--slab-muted)" }}>
          Why it runs on GenLayer: an Intelligent Contract reads the live web and asks a model from
          inside the contract, and nothing is written until the validators agree.
        </p>
      </section>

      <section className="band split">
        <div style={{ padding: "44px var(--pad)" }}>
          <h2 className="eyebrow" style={{ marginBottom: 18 }}>
            Price
          </h2>
          <p style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <span className="mono" style={{ fontSize: 44, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {price ?? "-"}
            </span>
            <span className="mono muted" style={{ fontSize: 18 }}>
              GEN / capture
            </span>
          </p>
          <p className="muted pretty" style={{ maxWidth: 420 }}>
            Paid inside the transaction, at exactly the price the contract reports. Asking whether a
            change mattered costs half a capture, and snapshotting a contract costs a quarter.
          </p>
        </div>

        <div style={{ padding: "44px var(--pad)", background: "var(--panel)" }}>
          <h2 className="eyebrow" style={{ marginBottom: 18 }}>
            Watch mode
          </h2>
          <p className="serif" style={{ fontSize: 30, lineHeight: 1.1, marginBottom: 16 }}>
            Turn a certificate into a record over time.
          </p>
          <p className="muted pretty" style={{ maxWidth: 420, marginBottom: 20 }}>
            Prepay captures of a page on a cadence. Each capture links to the one before it, so the
            page&apos;s history shows every claim that arrived and every claim that went.
          </p>
          <Link
            href="/watch"
            className="mono"
            style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "var(--radius)", background: "var(--bg)", maxWidth: 420, fontSize: 12, color: "var(--muted)" }}
          >
            <span style={{ flex: 1, padding: "10px 12px", borderRight: "1px solid var(--line)" }}>daily</span>
            <span style={{ flex: 1, padding: "10px 12px", borderRight: "1px solid var(--line)" }}>30 captures</span>
            <span style={{ padding: "10px 14px", color: "var(--ink)" }}>{stats ? `${formatGen(stats.fee * 30n)} GEN` : "open a watch"}</span>
          </Link>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="band pad" style={{ paddingTop: 56, paddingBottom: 72 }}>
          <h2 className="eyebrow" style={{ marginBottom: 20 }}>
            Recent captures{stats ? `, ${formatCount(stats.certificates)} on chain` : ""}
          </h2>
          <div className="scroll-x table-framed">
            <table className="table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th style={{ width: 190 }}>Captured</th>
                  <th style={{ width: 90 }}>Claims</th>
                  <th style={{ width: 160 }}>Image check</th>
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
                        {c.kind === "contract" ? (
                          <span className="muted">contract views</span>
                        ) : c.cloaking ? (
                          <span style={{ color: "var(--flag)" }}>cloaking</span>
                        ) : (
                          <span>matches text</span>
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
