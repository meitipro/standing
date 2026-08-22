import Link from "next/link";
import type { Metadata } from "next";

import BulkAdd from "@/components/BulkAdd";

export const metadata: Metadata = {
  title: "Add in bulk",
  description:
    "Notarise many pages and snapshot many intelligent contracts in one pass. Checked and priced before anything is signed.",
};

export default function BulkPage() {
  return (
    <div className="wrap section" style={{ maxWidth: 900 }}>
      <p className="eyebrow">// bulk</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        Add a whole portfolio at once.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        Paste page urls and contract addresses together, one per line. The list
        is checked and priced before anything is signed, because the expensive
        mistake is paying for forty captures and finding six of them were typos.
      </p>

      <div style={{ marginTop: 32 }}>
        <BulkAdd />
      </div>

      <hr className="rule" style={{ margin: "48px 0" }} />

      <section className="cols">
        <div>
          <h2 className="h3">Pages</h2>
          <p className="small muted pretty" style={{ marginTop: 10 }}>
            Each one is captured exactly as a single notarisation is: several
            validators fetch it, agree on the claims, and record a certificate
            with a screenshot digest and a timestamp. That work cannot be
            batched, so a page is one transaction and one signature, and the
            list is worked through in order.
          </p>
        </div>

        <div>
          <h2 className="h3">Contracts</h2>
          <p className="small muted pretty" style={{ marginTop: 10 }}>
            A snapshot records what another intelligent contract currently says:
            every readable view method that takes no arguments, and the value it
            returned. Ten of those fit in one transaction, because a cross
            contract read is part of deterministic execution rather than
            something the validators have to reach agreement about.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="h3">A snapshot&apos;s digest is stronger than a page&apos;s</h2>
        <p className="small muted pretty" style={{ marginTop: 10, maxWidth: "68ch" }}>
          This is worth knowing if you are going to cite one. A page capture&apos;s
          text digest is <em>agreed</em>: validators each hash the same window
          and compare, and the screenshot digest is only attested by the leader.
          A contract snapshot is read deterministically, so every validator
          computes the identical bytes — there is no threshold to clear and no
          leader to trust. It is the one record here that could not have come
          out differently.
        </p>
        <p className="small muted pretty" style={{ marginTop: 12, maxWidth: "68ch" }}>
          Snapshots carry no screenshot and no http status, because neither
          exists. Those fields are empty rather than filled with a borrowed
          value.
        </p>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="h3">Then watch them</h2>
        <p className="small muted pretty" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Everything added here becomes an ordinary record, so the rest of the
          product works on it unchanged: capture the same thing again and the
          claim diff shows what moved, and{" "}
          <Link href="/verify" style={{ textDecoration: "underline" }}>
            the network can judge
          </Link>{" "}
          whether the change was material or only a rewording. A contract that
          quietly changes its fee or its owner reads exactly like a page that
          quietly changes its terms.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn" href="/watch">
            Watch pages on a cadence
          </Link>
          <Link className="btn" href="/api">
            Read them back as JSON
          </Link>
        </div>
      </section>
    </div>
  );
}
