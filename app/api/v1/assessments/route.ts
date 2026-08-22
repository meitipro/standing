import { NextResponse } from "next/server";
import { assessmentForPair } from "@/lib/store";
import { SAMPLE_MODE } from "@/lib/seed";
import { assessmentJson } from "@/lib/api";

export const revalidate = 5;

/**
 * The network's verdict on one pair of captures.
 *
 * Keyed by the pair rather than by an assessment id, because a caller who has
 * two certificates in hand wants to know whether the change between them was
 * substantive — and never has an assessment id until after someone has asked.
 *
 * A pair nobody has assessed answers 404 rather than an empty verdict. There is
 * a real difference between "the network judged this unchanged" and "nobody has
 * asked", and a consumer that cannot tell them apart would report the second as
 * the first.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = Number(searchParams.get("from"));
  const to = Number(searchParams.get("to"));

  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0
  ) {
    return NextResponse.json(
      {
        error: "bad_pair",
        message:
          "Pass ?from= and ?to=, both non negative certificate ids, the earlier one first.",
      },
      { status: 400 }
    );
  }

  if (from === to) {
    return NextResponse.json(
      {
        error: "bad_pair",
        message: "A certificate cannot be compared against itself.",
      },
      { status: 400 }
    );
  }

  const assessment = await assessmentForPair(from, to);
  if (!assessment) {
    return NextResponse.json(
      {
        error: "not_assessed",
        message: `No one has asked the network to compare certificate ${from} with ${to} yet. This is not a verdict of "unchanged".`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { sample: SAMPLE_MODE, assessment: assessmentJson(assessment) },
    {
      headers: {
        "cache-control": "public, max-age=5, stale-while-revalidate=30",
      },
    }
  );
}
