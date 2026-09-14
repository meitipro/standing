import { NextResponse } from "next/server";

import { assessmentForPair } from "@/lib/store";
import { assessmentJson } from "@/lib/api";

export const revalidate = 5;

/**
 * The judgment of the change between two captures.
 *
 * Keyed by the pair, because a caller holding two certificates never has an
 * assessment id until someone has asked. The contract files each question by
 * the change itself, so a pair carrying a change another pair already asked
 * about answers with that judgment.
 *
 * A pair nobody has asked about is a 404, never an empty verdict: "judged
 * immaterial" and "never asked" are different facts.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = Number(searchParams.get("from"));
  const to = Number(searchParams.get("to"));

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= to) {
    return NextResponse.json(
      { error: "bad_pair", message: "Pass ?from= and ?to=, two certificate ids of the same page, the earlier one first." },
      { status: 400 },
    );
  }

  const assessment = await assessmentForPair(from, to);
  if (!assessment) {
    return NextResponse.json(
      { error: "not_assessed", message: `Nobody has asked the network about the change from certificate ${from} to ${to}.` },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { assessment: assessmentJson(assessment) },
    { headers: { "cache-control": "public, max-age=5, stale-while-revalidate=30" } },
  );
}
