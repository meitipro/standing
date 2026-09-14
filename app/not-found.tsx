import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap section" style={{ maxWidth: 640 }}>
      <p className="eyebrow">// 404</p>
      <h1 className="h2" style={{ marginTop: 12 }}>
        No record here.
      </h1>
      <p className="lede" style={{ marginTop: 14 }}>
        A certificate that does not exist is not the same as a certificate that
        failed. If you were shown a number, check it on the verify page - a
        missing record is itself worth knowing about.
      </p>
      <div className="row" style={{ marginTop: 26 }}>
        <Link className="btn btn-accent" href="/verify">
          Verify a certificate
        </Link>
        <Link className="btn" href="/">
          Notarize a page
        </Link>
      </div>
    </div>
  );
}
