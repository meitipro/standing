import { NextResponse } from "next/server";
import { IS_LIVE } from "@/lib/chain";

/**
 * Capture a page on behalf of an API caller.
 *
 * A write has to be signed, so this endpoint needs a funded relayer account
 * whose key lives on the server and whose spend is billed against the caller's
 * key. Neither exists yet, so it answers 501 and says exactly what is missing
 * rather than accepting a request it cannot honour.
 *
 * Anyone who wants to capture a page today can call `notarize(url)` on the
 * contract directly with their own wallet. That path needs nothing from us,
 * which is the point.
 */
export async function POST(req: Request) {
  let url = "";
  try {
    const body = await req.json();
    url = String(body?.url ?? "");
  } catch {
    return NextResponse.json(
      { error: "bad_body", message: 'Send {"url": "https://..."}.' },
      { status: 400 }
    );
  }

  if (!url) {
    return NextResponse.json(
      { error: "missing_url", message: 'Send {"url": "https://..."}.' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: "not_implemented",
      message: IS_LIVE
        ? "The relayer that signs captures for API callers is not configured on this deployment. Call notarize(url) on the contract with your own wallet, or use the site."
        : "The contract is not deployed yet, so nothing can be captured.",
      contract_method: "notarize(url) — payable, costs one fee",
      docs: "/api",
    },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "Captures are POSTed. Read certificates from /api/v1/certificates.",
    },
    { status: 405 }
  );
}
