/**
 * Look up a transaction on Bradbury and, for a deployment, dig the contract
 * address out of it.
 *
 *   node scripts/tx.mjs 0xTXHASH
 *   npm run tx -- 0xTXHASH
 *
 * Read only. Signs nothing, needs no key, spends nothing.
 *
 * This exists because deploying through the Studio leaves you holding a
 * transaction hash rather than an address, and the address is not shown at all
 * until consensus finishes. Rather than refreshing a page waiting for a field
 * to appear, this says which stage the transaction is at and prints the address
 * the moment there is one.
 */
import { createClient } from "genlayer-js";
import { pickNetwork } from "./network.mjs";

const net = pickNetwork();
const EXPLORER = net.explorer;

/**
 * The calldata decoder returns Maps, and JSON.stringify(new Map()) is "{}"
 * no matter what the Map holds. Printing args through JSON therefore reported
 * a deploy that carried [0.4 GEN, 6000] as having sent nothing at all, and a
 * Studio deploy that sent [0, 0] the same way — two different failures, one
 * of them not a failure, all displayed identically. Render Maps by hand.
 */
function showArgs(value) {
  if (value === undefined || value === null) return "(none)";
  if (value instanceof Map) {
    const parts = [...value.entries()].map(([k, v]) => `${k}: ${showArgs(v)}`);
    return `{ ${parts.join(", ")} }`;
  }
  if (Array.isArray(value)) return `[${value.map(showArgs).join(", ")}]`;
  if (typeof value === "bigint") return value.toString();
  return JSON.stringify(value);
}

/** Zeroed args are the Studio's signature: fields left empty go out as 0, 0. */
function argsLookZeroed(value) {
  if (value instanceof Map) return [...value.values()].every(argsLookZeroed);
  if (Array.isArray(value)) return value.length > 0 && value.every(argsLookZeroed);
  return value === 0n || value === 0;
}

const hash = process.argv[2];

if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  console.error("\n  Usage: node scripts/tx.mjs 0xTXHASH");
  console.error("  A transaction hash is 0x followed by 64 hex characters.");
  console.error("  Copy it whole — a hash short a character looks like a typo");
  console.error("  for a transaction that does not exist.\n");
  process.exitCode = 1;
} else {
  const client = createClient({ chain: net.chain });

  try {
    const tx = await client.getTransaction({ hash });

    if (!tx) {
      console.error(`\n  No transaction found with hash ${hash}\n`);
      process.exitCode = 1;
    } else {
      const decoded = tx?.txDataDecoded ?? {};
      const address = decoded.contractAddress ?? tx?.recipient ?? null;
      const args = decoded.constructorArgs;

      /* Consensus and execution are two different verdicts and the difference
       * is the whole point of this script. A deployment can be ACCEPTED with
       * every validator in AGREE — agreeing that the constructor threw. Reading
       * only the consensus status says "success" about a contract that does not
       * exist. */
      const consensus = tx?.statusName ?? tx?.status ?? "unknown";
      const execution = tx?.txExecutionResultName ?? "";
      const failed = /ERROR/i.test(execution);

      console.log("");
      console.log(`  hash        ${hash}`);
      console.log(`  type        ${decoded.type ?? "?"}`);
      console.log(`  from        ${tx?.sender ?? "?"}`);
      console.log(`  consensus   ${consensus} / ${tx?.resultName ?? "?"}`);
      console.log(`  execution   ${execution || "(not reported yet)"}`);
      if (address) console.log(`  address     ${address}`);
      if (args !== undefined) console.log(`  args        ${showArgs(args)}`);
      console.log("");

      if (failed) {
        console.log("  The deployment FAILED.");
        console.log("");
        console.log("  Consensus succeeded — the validators agreed with each other");
        console.log("  that running it raised an error — so nothing was created at");
        console.log("  that address. Nothing to salvage; deploy again.");
        if (argsLookZeroed(args)) {
          console.log("");
          console.log("  Constructor arguments went out as zeros — the Studio sends");
          console.log("  0 for every field left empty, and overlap_bps=0 is below");
          console.log("  the 3000 floor, so __init__ refused it.");
          console.log("  npm run deploy passes the real values, and prints the address.");
        }
        console.log("");
        console.log(`  ${EXPLORER}tx/${hash}`);
        console.log("");
        process.exitCode = 1;
      } else if (address && /FINISHED/i.test(execution)) {
        console.log("  Deployed. Confirm it really is Standing before using it:");
        console.log(`  npm run check -- ${address}`);
        console.log("");
      } else {
        console.log("  Consensus has not finished yet — wait and run this again.");
        console.log("");
        console.log(`  ${EXPLORER}tx/${hash}`);
        console.log("");
        process.exitCode = 1;
      }
    }
  } catch (e) {
    console.error("");
    console.error(`  Could not read transaction ${hash}`);
    console.error(`  ${e?.shortMessage ?? e?.message ?? e}`);
    console.error("");
    console.error(`  ${EXPLORER}tx/${hash}`);
    console.error("");
    process.exitCode = 1;
  }
}
