import Link from "next/link";
import type { Metadata } from "next";

import BulkAdd from "@/components/BulkAdd";
import { LIMITS } from "@/lib/limits";

export const metadata: Metadata = {
  title: "Add in bulk",
  description: "Notarise many pages and snapshot many intelligent contracts in one pass, checked and priced before anything is signed.",
};

export default function BulkPage() {
  return (
    <div className="wrap section" style={{ maxWidth: 900 }}>
      <p className="eyebrow">// bulk</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        Add a whole portfolio at once.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        Paste page urls and contract addresses together, one per line. The list is checked and
        priced before anything is signed, so a typo costs nothing.
      </p>

      <div style={{ marginTop: 32 }}>
        <BulkAdd />
      </div>

      <hr className="rule" style={{ margin: "48px 0" }} />

      <section className="cols">
        <div>
          <h2 className="h3">Pages</h2>
          <p className="small muted pretty" style={{ marginTop: 10 }}>
            Each is captured exactly as a single notarisation is: every validator reads the page
            itself and checks each claim against its own copy. That work cannot share a
            transaction, so each page is one transaction and one signature, worked through in
            order.
          </p>
        </div>
        <div>
          <h2 className="h3">Contracts</h2>
          <p className="small muted pretty" style={{ marginTop: 10 }}>
            A snapshot records what another intelligent contract&apos;s views return now, up to{" "}
            {LIMITS.MAX_STATE_METHODS} of them. Up to {LIMITS.MAX_BULK_TARGETS} contracts fit in one
            transaction, because a cross contract read is part of deterministic execution rather
            than something validators have to agree about.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="h3">A snapshot is computed, not agreed</h2>
        <p className="small muted pretty" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Every validator reads the same views and computes the same lines, with no model and no
          screenshot involved, so a snapshot carries no image check. Its claims are the views in the
          order they were named, each written as <code className="mono">name = value</code>.
        </p>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="h3">Then watch them</h2>
        <p className="small muted pretty" style={{ marginTop: 10, maxWidth: "68ch" }}>
          Everything added here becomes an ordinary certificate. Capture the same thing again and
          the two link together, the difference shows, and{" "}
          <Link href="/verify" style={{ textDecoration: "underline" }}>
            the network can judge
          </Link>{" "}
          whether it was material. A contract that quietly changes its fee reads like a page that
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
