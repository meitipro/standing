import Link from "next/link";
import type { Metadata } from "next";

import { getStats, listCertificates } from "@/lib/store";
import { certificateJson } from "@/lib/api";
import { ORIGIN } from "@/lib/chain";
import { formatGen } from "@/lib/format";

export const revalidate = 5;

export const metadata: Metadata = {
  title: "API",
  description: "Read certificates, watches and judgments as JSON, or call the contract directly with your own wallet.",
};

const ENDPOINTS = [
  ["GET", "/api/v1/certificates", "The newest certificates, newest first."],
  ["GET", "/api/v1/certificates/:id", "One certificate, as the chain holds it."],
  ["GET", "/api/v1/certificates?url=", "The newest captures of one url, newest first."],
  ["GET", "/api/v1/certificates?digest=", "The first certificate carrying a claims digest, or a 404."],
  ["GET", "/api/v1/watches/:id", "A watch, with its page's history and the change between captures."],
  ["GET", "/api/v1/assessments?from=&to=", "The judgment of the change between two captures, or a 404."],
  ["GET", "/api/contract-source", "The contract's source, byte for byte, as text."],
];

export default async function ApiPage() {
  const [newest, stats] = await Promise.all([listCertificates(1), getStats()]);
  const sample = newest[0];
  const price = (wei: bigint | undefined) => (wei === undefined ? "read stats()" : `${formatGen(wei)} GEN`);

  const WRITES = [
    ["notarize(url)", price(stats?.fee), "Certify what a page states now."],
    ["notarize_contracts(targets, method_sets)", `${price(stats?.snapshotFee)} each`, "Record other contracts' zero-argument views, up to ten per call."],
    ["watch(url, cadence_hours)", `${price(stats?.fee)} per capture`, "Prepay captures of a page on a cadence."],
    ["capture_watch(watch_id)", "free", "Take a watch's due capture. Any account may."],
    ["assess(cert_a, cert_b)", price(stats?.assessFee), "Put one question about two captures of a page."],
  ];

  return (
    <div className="wrap section" style={{ maxWidth: 900 }}>
      <p className="eyebrow">// api</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        Certificates as an input to your product.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        Everything this site shows, as JSON, read from the contract. Writes go to the contract
        itself, signed by your own wallet.
      </p>

      <section style={{ marginTop: 36 }}>
        <h2 className="h3">Read</h2>
        <div className="scroll-x table-framed" style={{ marginTop: 18 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>method</th>
                <th style={{ width: 320 }}>path</th>
                <th>returns</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(([method, path, job]) => (
                <tr key={path}>
                  <td className="mono">{method}</td>
                  <td className="mono break">{path}</td>
                  <td>{job}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          Responses are cached for five seconds. Every field name mirrors the contract&apos;s own
          views, so the same record can be read off the chain with no part of this site.
        </p>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="h3">A certificate</h2>
        <pre className="code" style={{ marginTop: 16 }}>
          curl {ORIGIN}/api/v1/certificates/{sample ? sample.id : 0}
        </pre>
        {sample ? (
          <>
            <p className="small muted" style={{ margin: "16px 0 10px" }}>
              The newest certificate, rendered by the function that serves the endpoint.
            </p>
            <pre className="code">{JSON.stringify({ certificate: certificateJson(sample) }, null, 2)}</pre>
          </>
        ) : (
          <p className="small muted" style={{ marginTop: 16 }}>
            The response appears here once the first certificate is on chain.
          </p>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="h3">Write</h2>
        <p className="small muted" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Call the contract with any GenLayer client. Each payable call takes exactly the price its{" "}
          <code className="mono">stats()</code> view reports at that moment, and refuses anything
          else with a sentence saying so.
        </p>
        <div className="scroll-x table-framed" style={{ marginTop: 18 }}>
          <table className="table">
            <thead>
              <tr>
                <th>method</th>
                <th style={{ width: 150 }}>price</th>
                <th>does</th>
              </tr>
            </thead>
            <tbody>
              {WRITES.map(([method, cost, does]) => (
                <tr key={method}>
                  <td className="mono break">{method}</td>
                  <td className="mono">{cost}</td>
                  <td>{does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="h3">Judgments, not just diffs</h2>
        <p className="small muted pretty" style={{ marginTop: 10, maxWidth: "68ch" }}>
          A diff between two captures reports the same thing whether a fee moved from one percent
          to five or a sentence was reworded. The judgment separates them, answered{" "}
          <code className="mono">material</code>, <code className="mono">immaterial</code> or{" "}
          <code className="mono">unclear</code>, and the{" "}
          <Link href="/verify" style={{ textDecoration: "underline" }}>
            verify page
          </Link>{" "}
          sets out how each is reached. A 404 from the assessments endpoint means nobody has put
          that question yet, which is a different fact from any verdict.
        </p>
      </section>
    </div>
  );
}
