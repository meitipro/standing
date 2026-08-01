/**
 * Read a deployed Standing contract and report whether it is really Standing
 * and whether its constructor arguments landed.
 *
 *   node scripts/check.mjs 0xCONTRACT
 *   npm run check -- 0xCONTRACT
 *
 * Read only. It signs nothing, needs no key, and spends nothing — so it is safe
 * to point at any address, including one somebody else deployed.
 *
 * Worth running before the address goes into Vercel. A deployment that half
 * worked, or an address copied with a character missing, is far cheaper to
 * find here than after the site is serving it.
 */
import { createClient } from "genlayer-js";
import { pickNetwork } from "./network.mjs";

const GEN = 10n ** 18n;
const net = pickNetwork();
const EXPLORER = net.explorer;

const address = process.argv[2];

if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("\n  Usage: node scripts/check.mjs 0xCONTRACT");
  console.error("  A contract address is 0x followed by 40 hex characters.\n");
  process.exitCode = 1;
} else {
  const client = createClient({ chain: net.chain });

  const read = (functionName, args = []) =>
    client.readContract({ address, functionName, args });

  const num = (v) => (typeof v === "bigint" ? v : BigInt(v ?? 0));

  try {
    /* One probe first, alone, then the rest together. The sdk prints its own
     * rpc error for every failed call, so firing all six at a dead address
     * buries this script's actual message under six identical stack traces. */
    const fee = await read("fee_value");

    /* fee_value and overlap_bps_value are the two constructor arguments read
     * back. If these answer at all, the address holds a contract with
     * Standing's shape; if they also carry the intended numbers, the deploy
     * did what it was told. */
    const [overlap, certs, watches, owner, window] = await Promise.all([
      read("overlap_bps_value"),
      read("total_certs"),
      read("total_watches"),
      read("owner_address"),
      read("text_window_size"),
    ]);

    const feeWei = num(fee);
    const feeGen = Number((feeWei * 10000n) / GEN) / 10000;
    const overlapBps = Number(num(overlap));

    console.log("");
    console.log("  It answers, and it is Standing.");
    console.log("");
    console.log(`  address     ${address}`);
    console.log(`  network     ${net.chain.name} (chain ${net.chain.id}) [--network=${net.name}]`);
    console.log(`  owner       ${owner}`);
    console.log(`  fee         ${feeGen} GEN  (${feeWei} wei)`);
    console.log(`  threshold   ${overlapBps} bps`);
    console.log(`  text window ${Number(num(window)).toLocaleString("en-US")} chars`);
    console.log(`  certs       ${Number(num(certs))}`);
    console.log(`  watches     ${Number(num(watches))}`);
    console.log(`  explorer    ${EXPLORER}address/${address}`);
    console.log("");

    const notes = [];
    if (feeGen !== 0.4) {
      notes.push(`fee is ${feeGen} GEN, not the intended 0.4`);
    }
    if (overlapBps !== 6000) {
      notes.push(`threshold is ${overlapBps} bps, not the intended 6000`);
    }

    if (notes.length) {
      console.log("  Deployed, but not with the numbers the brief specifies:");
      for (const n of notes) console.log(`    - ${n}`);
      console.log("");
      console.log("  Both are constructor arguments, so fixing them means");
      console.log("  deploying again and using the new address.");
      console.log("");
      process.exitCode = 1;
    } else {
      console.log("  Constructor arguments are correct.");
      console.log("");
      console.log("  Set this in Vercel (all three environments), then redeploy:");
      console.log("");
      console.log(`  NEXT_PUBLIC_STANDING_ADDRESS=${address}`);
      console.log("");
    }
  } catch (e) {
    const message = e?.shortMessage ?? e?.message ?? String(e);
    console.error("");
    console.error(`  Could not read a Standing contract at ${address}.`);
    console.error(`  ${message}`);
    console.error("");
    console.error("  Either nothing is deployed there, the address is mistyped,");
    console.error("  or what is deployed is a different contract.");
    console.error(`  ${EXPLORER}address/${address}`);
    console.error("");
    process.exitCode = 1;
  }
}
