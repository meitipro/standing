import { NextResponse } from "next/server";
import { getAddress } from "viem";

import { NETWORK_NAME, RPC_URL } from "@/lib/chain";

/**
 * Put test GEN in a visitor's wallet on GenLayer Studio.
 *
 * Studio charges no gas, which reads as "you need no balance". That is true of
 * gas only: every Standing write carries a price, so a fresh wallet could read
 * everything and certify nothing. This closes that, on Studio alone.
 *
 * Runs on the server because Studio's RPC is not guaranteed to answer a
 * browser's CORS check, and so the amount is not a number the page can edit.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whole GEN per request. Not exported: a route file may export only the
 *  names Next recognises. */
const FAUCET_GEN = 100;

/**
 * The amount goes as a decimal string, measured on Studio while building
 * Fieldwork: passed a number, sim_fundAccount answers with a hash and the
 * balance never moves; passed a string, it answers with an error after the
 * credit has already landed. The answer therefore carries no information
 * either way, and success is decided by reading the balance back.
 */
const AMOUNT_WEI = String(BigInt(FAUCET_GEN) * 10n ** 18n);

/** Best effort, per address. Serverless instances do not share it, so it slows
 *  a casual loop rather than enforcing anything. */
const COOLDOWN_MS = 20_000;
const lastCall = new Map<string, number>();

async function rpc(method: string, params: unknown[]): Promise<{ result?: string }> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    cache: "no-store",
  });
  return res.json();
}

async function balanceOf(address: string): Promise<bigint> {
  try {
    const out = await rpc("eth_getBalance", [address, "latest"]);
    return BigInt(out?.result ?? "0x0");
  } catch {
    return 0n;
  }
}

export async function POST(req: Request) {
  if (NETWORK_NAME !== "studio") {
    return NextResponse.json(
      { error: "not_studio", message: "This faucet exists only on GenLayer Studio. Other networks have their own faucet." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const given = String(body?.address ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(given)) {
    return NextResponse.json({ error: "bad_address", message: "That is not a wallet address." }, { status: 400 });
  }
  /* Checksummed, always. A wallet hands back a lowercased address, and on the
   * newer Studio network that form is answered with a hash and credited with
   * nothing. Measured 2026-09-16. */
  const address = getAddress(given.toLowerCase());

  const key = address.toLowerCase();
  const since = Date.now() - (lastCall.get(key) ?? 0);
  if (since < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "too_soon", message: `Give it ${Math.ceil((COOLDOWN_MS - since) / 1000)} seconds and ask again.` },
      { status: 429 },
    );
  }
  lastCall.set(key, Date.now());

  const before = await balanceOf(address);
  await rpc("sim_fundAccount", [address, AMOUNT_WEI]).catch(() => null);

  // The credit lands in seconds. Polled rather than slept, so a fast credit is
  // reported fast and a slow one is still caught.
  let after = before;
  for (let i = 0; i < 12; i += 1) {
    await new Promise((r) => setTimeout(r, 1500));
    after = await balanceOf(address);
    if (after > before) break;
  }

  if (after <= before) {
    lastCall.delete(key);
    return NextResponse.json(
      { error: "not_funded", message: "The faucet was asked, but the balance has not moved yet. Wait a moment and try again." },
      { status: 502 },
    );
  }

  const whole = (wei: bigint) => Number((wei * 100n) / 10n ** 18n) / 100;
  return NextResponse.json({ funded: true, added: whole(after - before), balance: whole(after) });
}
