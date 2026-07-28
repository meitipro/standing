import Link from "next/link";
import type { Metadata } from "next";

import CertificateCard from "@/components/CertificateCard";
import { getCertificate, getCertificateByDigest } from "@/lib/store";
import { isDigest } from "@/lib/format";
import { SAMPLE_MODE } from "@/lib/seed";

export const revalidate = 5;

export const metadata: Metadata = {
  title: "Verify",
  description:
    "Paste a certificate id or a sha256 digest, read the on chain record, and read plainly what a certificate does and does not prove.",
};

type Search = { searchParams: { q?: string } };

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
      if (!cert)
        miss =
          "No certificate carries that digest. Either it was never captured here, or the file you were given is not the file that was captured.";
    } else {
      miss =
        "That is neither a certificate id nor a sha256 digest. Paste the number from the certificate url, or the 64 character hash from its record.";
    }
  }

  return (
    <div className="wrap section" style={{ maxWidth: 860 }}>
      <p className="eyebrow">// verify</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        Check a certificate you were shown.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        Paste the certificate number or a sha256 digest. You will get the record
        as the chain holds it, and a plain account of what it settles and what it
        does not.
      </p>

      <form method="get" style={{ marginTop: 28, maxWidth: 720 }}>
        <label className="lbl" htmlFor="q">
          Certificate id or sha256 digest
        </label>
        <div className="field">
          <input
            id="q"
            name="q"
            defaultValue={q}
            spellCheck={false}
            autoComplete="off"
            placeholder="8812  or  9c41...e0f2"
          />
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
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn btn-accent" href={`/c/${cert.id}`}>
              Open the full certificate
            </Link>
            {cert.watched && (
              <Link className="btn" href={`/w/${cert.watchId}`}>
                See the page&apos;s history
              </Link>
            )}
          </div>
          {isDigest(q) && (
            <p className="small muted mono" style={{ marginTop: 14 }}>
              {q === cert.textDigest
                ? "matched the text digest — the bytes every validator hashed"
                : "matched the screenshot digest — the leader's image, attested not agreed"}
            </p>
          )}
        </section>
      )}

      <hr className="rule" style={{ margin: "48px 0" }} />

      <section className="cols">
        <div>
          <h2 className="h3">What a certificate proves</h2>
          <ul className="stack-12" style={{ marginTop: 14, paddingLeft: 18 }}>
            <li>
              Several validators, who do not know each other, each fetched this
              url inside one transaction.
            </li>
            <li>
              Each extracted the claims independently, and their claim sets
              overlapped by at least the threshold printed on the certificate.
            </li>
            <li>
              They agreed on whether the rendered picture of the page showed the
              same claims as its text.
            </li>
            <li>
              They agreed on the http status the page returned, so a certificate
              is never issued over an error page.
            </li>
            <li>
              The text digest was recomputed by every validator from the same
              bytes, so a copy of the text can be checked against it.
            </li>
            <li>The moment. That is the whole product.</li>
          </ul>
        </div>

        <div>
          <h2 className="h3">What it does not prove</h2>
          <ul className="stack-12" style={{ marginTop: 14, paddingLeft: 18 }}>
            <li>
              <strong>That the claims are true.</strong> A page can say anything.
              This records that it said it.
            </li>
            <li>
              That the whole page was read. At most 14,000 characters are
              captured, and every certificate records how many it actually read
              {cert
                ? ` — this one read ${cert.textChars.toLocaleString("en-US")}.`
                : "."}
            </li>
            <li>
              That the screenshot bytes are what the leader says they are. Two
              browsers never render one page identically, so the network cannot
              compare images byte for byte. That digest is attested by the
              leader, not agreed by the network.
            </li>
            <li>
              That every reader saw this. A page can serve different content by
              country or by cookie, and the cloaking flag catches only the
              mismatch between text and image.
            </li>
            <li>
              That the page still says this. A certificate is about one moment,
              which is why watch mode exists.
            </li>
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 44 }}>
        <h2 className="h3">How to check it yourself</h2>
        <div className="cols" style={{ marginTop: 18 }}>
          <div className="stack-12">
            <p className="small">
              <strong>Against the chain.</strong> Read{" "}
              <code className="mono">certificate(id)</code> on the contract
              directly. Nothing here is needed to do that, and if this site
              disappeared the record would not.
            </p>
            <p className="small">
              <strong>Against a file.</strong> If someone hands you the captured
              text, run sha256 over it and compare it with the text digest. A
              mismatch means it is not the file that was captured.
            </p>
          </div>
          <pre className="code">
            <span className="c"># the record, from the chain</span>
            {"\n"}curl {SAMPLE_MODE ? "https://standing.wtf" : ""}/api/v1/certificates/
            {cert ? cert.id : "8812"}
            {"\n\n"}
            <span className="c"># the file you were given</span>
            {"\n"}sha256sum captured.txt
          </pre>
        </div>
      </section>

      <section style={{ marginTop: 44 }}>
        <h2 className="h3">If you want to dispute one</h2>
        <p className="small muted" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Recapturing a page is cheaper than appealing a capture, so for a single
          certificate the honest answer is almost always to capture it again and
          let the two records sit side by side. An appeal makes sense when a
          certificate is being used as evidence somewhere else and the cloaking
          flag is the thing being argued about.
        </p>
        <p className="small muted" style={{ marginTop: 12, maxWidth: "68ch" }}>
          An appeal costs a bond, which for a capture this cheap is deliberately
          larger than the fee. That asymmetry is what keeps appeals rare and
          meaningful. The bond is read from the network at the moment you appeal
          rather than quoted here, because a number written into a page goes
          stale and this one decides whether someone loses money.
        </p>
        <div className="notice" style={{ marginTop: 16, maxWidth: "68ch" }}>
          Nothing in this product moves value on a verdict, so finality matters
          for the record rather than for money. A certificate is readable as soon
          as the network accepts it and is marked provisional until the appeal
          window closes.
        </div>
      </section>
    </div>
  );
}
