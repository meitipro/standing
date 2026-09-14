import { NextResponse } from "next/server";

import { getTimeline, getWatch } from "@/lib/store";
import { watchJson } from "@/lib/api";

export const revalidate = 5;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 0) {
    return NextResponse.json({ error: "bad_id", message: "A watch id is a non negative integer." }, { status: 400 });
  }
  const watch = await getWatch(id);
  if (!watch) {
    return NextResponse.json({ error: "not_found", message: `There is no watch ${id}.` }, { status: 404 });
  }
  const timeline = await getTimeline(watch.url);
  return NextResponse.json(
    { watch: watchJson(watch, timeline) },
    { headers: { "cache-control": "public, max-age=5, stale-while-revalidate=30" } },
  );
}
