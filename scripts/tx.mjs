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
import { testnetBradbury } from "genlayer-js/chains";

const EXPLORER = testnetBradbury.blockExplorers.default.url;

const hash = process.argv[2];

if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  console.error("\n  Usage: node scripts/tx.mjs 0xTXHASH");
  console.error("  A transaction hash is 0x followed by 64 hex characters.");
  console.error("  Copy it whole — a hash short a character looks like a typo");
  console.error("  for a transaction that does not exist.\n");
  process.exitCode = 1;
} else {
  const client = createClient({ chain: testnetBradbury });

  try {
    const tx = await client.getTransaction({ hash });

    if (!tx) {
      console.error(`\n  No transaction found with hash ${hash}\n`);
      process.exitCode = 1;
    } else {
      /* The address turns up under different keys depending on how far along
       * the transaction is and which shape the node returns, so every place it
       * has been seen is checked rather than assuming one. */
      const address =
        tx?.data?.contract_address ??
        tx?.contract_address ??
        tx?.result?.contract_address ??
        tx?.data?.deployed_contract_address ??
        null;

      const status = tx?.status ?? tx?.consensus_status ?? "unknown";

      console.log("");
      console.log(`  hash        ${hash}`);
      console.log(`  status      ${status}`);
      console.log(`  type        ${tx?.type ?? "?"}`);
      console.log(`  from        ${tx?.from_address ?? tx?.from ?? "?"}`);
      console.log("");

      if (address) {
        console.log("  contract address");
        console.log(`  ${address}`);
        console.log("");
        console.log("  Confirm it really is Standing before using it:");
        console.log(`  npm run check -- ${address}`);
        console.log("");
      } else {
        console.log("  No contract address on this transaction yet.");
        console.log("");
        console.log("  If the status is still committing or activated, consensus");
        console.log("  has not finished and there is nothing to read yet — wait");
        console.log("  and run this again. If it is finalized and there is still");
        console.log("  no address, the deployment did not produce a contract.");
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
