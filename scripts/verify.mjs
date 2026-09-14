/**
 * Read a deployed contract and report whether it is Standing.
 *
 *   npm run verify -- 0xCONTRACT --network=studio
 *
 * Read only: it signs nothing, needs no key and spends nothing, so it is safe
 * to point at any address. Worth running before an address goes into Vercel,
 * because a deployment that half worked, or an address missing a character,
 * is far cheaper to find here than on the live site.
 */
import { createClient } from "genlayer-js";

import { pickNetwork } from "./network.mjs";

const GEN = 10n ** 18n;
const net = pickNetwork();
const address = process.argv.slice(2).find((a) => /^0x[0-9a-fA-F]{40}$/.test(a));

/** The fields stats() returns. Any other shape is some other contract. */
const SHAPE = [
  "assess_fee", "assessments", "certificates", "fee", "fees_accrued", "max_bulk_targets",
  "max_claims", "max_watch_captures", "min_claims", "min_watch_captures", "owner",
  "prepaid_held", "snapshot_fee", "text_window", "watches",
];

const gen = (wei) => {
  const value = BigInt(wei);
  const frac = (value % GEN).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return `${value / GEN}${frac ? `.${frac}` : ""} GEN`;
};

async function stats(client, attempts = 4) {
  for (let i = 1; ; i += 1) {
    try {
      const raw = await client.readContract({ address, functionName: "stats", args: [] });
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      if (i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

if (!address) {
  console.error("\n  Usage: npm run verify -- 0xCONTRACT --network=studio");
  console.error("  A contract address is 0x followed by 40 hex characters.\n");
  process.exitCode = 1;
} else {
  try {
    const s = await stats(createClient({ chain: net.chain }));
    const keys = Object.keys(s ?? {}).sort();
    if (JSON.stringify(keys) !== JSON.stringify(SHAPE)) {
      throw new Error(`stats() answered with fields ${keys.join(", ")}, which is not Standing's shape`);
    }
    console.log("");
    console.log("  It answers, and it is Standing.");
    console.log("");
    console.log(`  address       ${address}`);
    console.log(`  network       ${net.chain.name} (chain ${net.chain.id}) [--network=${net.name}]`);
    console.log(`  owner         ${s.owner}`);
    console.log(`  capture       ${gen(s.fee)}`);
    console.log(`  assessment    ${gen(s.assess_fee)}`);
    console.log(`  snapshot      ${gen(s.snapshot_fee)}`);
    console.log(`  certificates  ${s.certificates}`);
    console.log(`  watches       ${s.watches}`);
    console.log(`  assessments   ${s.assessments}`);
    console.log(`  explorer      ${net.explorer}address/${address}`);
    console.log("");
    console.log("  Not proven here: that the deployed source is this repository's.");
    console.log(`  npm run match -- ${address} --network=${net.name}`);
    console.log("");
  } catch (e) {
    console.error("");
    console.error(`  Could not read a Standing contract at ${address} on ${net.chain.name}.`);
    console.error(`  ${e?.shortMessage ?? e?.message ?? e}`);
    console.error("");
    console.error("  Nothing is deployed there, the address is mistyped, the network flag is wrong,");
    console.error("  or what is deployed is a different contract. If it was deployed moments ago,");
    console.error(`  read the transaction first: npm run tx -- 0xHASH --network=${net.name}`);
    console.error("");
    process.exitCode = 1;
  }
}
