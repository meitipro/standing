import { NextResponse } from "next/server";

import { getCertificate } from "@/lib/store";
import { certificateJson } from "@/lib/api";

export const revalidate = 5;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) {
    return NextResponse.json({ error: "bad_id", message: "A certificate id is a non negative integer." }, { status: 400 });
  }
  const cert = await getCertificate(id);
  if (!cert) {
    return NextResponse.json({ error: "not_found", message: `There is no certificate ${id}.` }, { status: 404 });
  }
  return NextResponse.json(
    { certificate: certificateJson(cert) },
    { headers: { "cache-control": "public, max-age=5, stale-while-revalidate=30" } },
  );
}
