import { NextResponse } from "next/server";

import { getCertificateByDigest, historyForUrl, listCertificates } from "@/lib/store";
import { isDigest } from "@/lib/format";
import { certificateJson } from "@/lib/api";
import { checkUrl, withScheme } from "@/lib/url";

export const revalidate = 5;

const CACHE = { "cache-control": "public, max-age=5, stale-while-revalidate=30" };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const digest = searchParams.get("digest");

  if (digest !== null) {
    if (!isDigest(digest)) {
      return NextResponse.json({ error: "bad_digest", message: "A claims digest is 64 hexadecimal characters." }, { status: 400 });
    }
    const cert = await getCertificateByDigest(digest);
    if (!cert) {
      return NextResponse.json({ error: "not_found", message: "No certificate carries that claims digest." }, { status: 404 });
    }
    return NextResponse.json({ certificate: certificateJson(cert) }, { headers: CACHE });
  }

  if (url !== null) {
    const checked = checkUrl(withScheme(url));
    if (!checked.ok) {
      return NextResponse.json({ error: "bad_url", message: checked.reason }, { status: 400 });
    }
    const certs = await historyForUrl(checked.url);
    return NextResponse.json({ url: checked.url, count: certs.length, certificates: certs.map(certificateJson) }, { headers: CACHE });
  }

  const limit = Math.min(25, Math.max(1, Number(searchParams.get("limit") ?? 20) || 20));
  const certs = await listCertificates(limit);
  return NextResponse.json({ count: certs.length, certificates: certs.map(certificateJson) }, { headers: CACHE });
}
