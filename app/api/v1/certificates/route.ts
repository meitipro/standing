import { NextResponse } from "next/server";
import { getCertificateByDigest, historyForUrl, listCertificates } from "@/lib/store";
import { SAMPLE_MODE } from "@/lib/seed";
import { isDigest } from "@/lib/format";
import { certificateJson } from "@/lib/api";

export const revalidate = 5;

const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const digest = searchParams.get("digest");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get("limit") ?? 20) || 20)
  );

  if (digest) {
    if (!isDigest(digest)) {
      return NextResponse.json(
        {
          error: "bad_digest",
          message: "A digest is 64 hexadecimal characters.",
        },
        { status: 400 }
      );
    }
    const cert = await getCertificateByDigest(digest);
    return NextResponse.json(
      {
        sample: SAMPLE_MODE,
        matched: Boolean(cert),
        certificate: cert ? certificateJson(cert) : null,
        message: cert
          ? undefined
          : "No certificate carries that digest. Either it was never captured here, or the file is not the file that was captured.",
      },
      { status: cert ? 200 : 404 }
    );
  }

  const certs = url ? (await historyForUrl(url)).reverse() : await listCertificates(limit);

  return NextResponse.json(
    {
      sample: SAMPLE_MODE,
      count: certs.length,
      certificates: certs.slice(0, limit).map(certificateJson),
    },
    { headers: { "cache-control": "public, max-age=5, stale-while-revalidate=30" } }
  );
}
