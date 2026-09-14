import Link from "next/link";
import type { Metadata } from "next";

import CertificateCard from "@/components/CertificateCard";
import { getCertificate, getCertificateByDigest } from "@/lib/store";
import { ORIGIN } from "@/lib/chain";
import { claimsDigest } from "@/lib/claims";
import { isDigest } from "@/lib/format";
import { LIMITS } from "@/lib/limits";

export const revalidate = 5;

export const metadata: Metadata = {
  title: "Verify",
  description:
    "Paste a certificate id or a claims digest, read the record as the chain holds it, and see how each part of it was agreed.",
};

type Search = { searchParams: { q?: string } };

const AGREED = [
  ["The claims", `One validator proposes up to ${LIMITS.MAX_CLAIMS}, normalised and sorted. Every other validator reads the page itself, checks each claim against its own copy, and votes agree only if it finds all of them. A certificate needs a majority.`],
  ["The claims digest", "sha256 over the stored claims joined by newlines. This page recomputes it from the record below."],
  ["The image check", "Each validator renders its own screenshot and asks whether it shows what the text states. The answers are compared exactly, and a certificate stores the one they agreed on."],
  ["The moment", "The transaction's own datetime, from the chain."],
  ["Refusals", "A page that answers with an error, renders almost no text, or carries fewer than two claims is refused for every validator alike, and the refusal is the message the contract raised."],
];

export default async function VerifyPage({ searchParams }: Search) {
  const q = (searchParams.q ?? "").trim();

  let cert = null;
  let miss = "";
  if (q) {
    if (/^\d+$/.test(q)) {
      cert = await getCertificate(Number(q));
      if (!cert) miss = `There is no certificate ${q}.`;
    } else if (isDigest(q)) {
      cert = await getCertificateByDigest(q);
      if (!cert) miss = "No certificate carries that claims digest.";
    } else {
      miss = "That is neither a certificate id nor a sha256 digest. Paste the number from the certificate's url, or the 64 character digest from its record.";
    }
  }
  const recomputed = cert ? await claimsDigest(cert.claims) : "";

  return (
    <div className="wrap section" style={{ maxWidth: 860 }}>
      <p className="eyebrow">// verify</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        Check a certificate you were shown.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        Paste the certificate number or its claims digest. You get the record as the chain holds
        it, with its digest recomputed here from the claims.
      </p>

      <form method="get" style={{ marginTop: 28, maxWidth: 720 }}>
        <label className="lbl" htmlFor="q">
          Certificate id or claims digest
        </label>
        <div className="field">
          <input id="q" name="q" defaultValue={q} spellCheck={false} autoComplete="off" placeholder="12  or  9c41...e0f2" />
          <button>Look it up</button>
        </div>
      </form>

      {miss && (
        <div className="notice notice-flag" style={{ marginTop: 22, maxWidth: 720 }}>
          {miss}
        </div>
      )}

      {cert && (
        <section style={{ marginTop: 32 }}>
          <h2 className="eyebrow">the record</h2>
          <div style={{ marginTop: 14 }}>
            <CertificateCard cert={cert} />
          </div>
          <div className="rec" style={{ marginTop: 14 }}>
            <div className="rec-digest">
              <div className="rec-digest-head">
                <span className="k">stored digest</span>
              </div>
              <p className="hash">{cert.claimsDigest}</p>
            </div>
            <div className="rec-digest">
              <div className="rec-digest-head">
                <span className="k">recomputed here</span>
                {recomputed === cert.claimsDigest ? <span className="tag tag-ok">matches</span> : <span className="tag tag-flag">differs</span>}
              </div>
              <p className="hash">{recomputed}</p>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn btn-accent" href={`/c/${cert.id}`}>
              Open the full certificate
            </Link>
            {cert.watchId !== null && (
              <Link className="btn" href={`/w/${cert.watchId}`}>
                See the page&apos;s history
              </Link>
            )}
          </div>
        </section>
      )}

      <hr className="rule" style={{ margin: "48px 0" }} />

      <section>
        <h2 className="h3">How each part of a certificate is agreed</h2>
        <dl className="kv" style={{ marginTop: 16 }}>
          {AGREED.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd className="pretty">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section style={{ marginTop: 44 }}>
        <h2 className="h3">Check it yourself</h2>
        <div className="cols" style={{ marginTop: 18 }}>
          <div className="stack-12">
            <p className="small">
              <strong>Against the chain.</strong> Read <code className="mono">certificate(id)</code> on the contract directly.
              The contract&apos;s source is served at <a href="/api/contract-source">/api/contract-source</a>, byte for byte.
            </p>
            <p className="small">
              <strong>Against the claims.</strong> Join the claims with newlines, with no newline at the end, and run
              sha256 over the result. It is the stored digest.
            </p>
          </div>
          <pre className="code">
            <span className="c"># the record</span>
            {"\n"}curl {ORIGIN}/api/v1/certificates/{cert ? cert.id : 0}
            {"\n\n"}
            <span className="c"># the digest, from two claims</span>
            {"\n"}printf &apos;%s\n%s&apos; &quot;claim one&quot; &quot;claim two&quot; | sha256sum
          </pre>
        </div>
      </section>

      <section style={{ marginTop: 44 }}>
        <h2 className="h3">How a judgment of a change is reached</h2>
        <p className="small muted pretty" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Two certificates of the same page can be put to the network with one question: do they
          contradict each other on a fact a reader would act on? The contract holds the claims that
          differ and numbers them. Each validator asks its own model twice, once with each capture
          shown first, and the answer is <code className="mono">material</code> with the lines that
          carry it, or <code className="mono">immaterial</code>. When the two orders disagree the
          stored answer is <code className="mono">unclear</code>. Validators compare the resolved
          answer exactly.
        </p>
        <p className="small muted pretty" style={{ marginTop: 12, maxWidth: "68ch" }}>
          A question is filed by the change itself, so the same change is answered once whichever
          pair of certificates asks it. A pair with no judgment is a question nobody has put yet,
          and the API answers it with a 404 rather than a verdict.
        </p>
      </section>

      <section style={{ marginTop: 44 }}>
        <h2 className="h3">When a certificate is contested</h2>
        <p className="small muted pretty" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Capture the page again. The new certificate links back to the one before it, both stay on
          chain side by side, and the change between them can be put to the network.
        </p>
      </section>
    </div>
  );
}
