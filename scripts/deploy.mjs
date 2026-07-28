/**
 * Deploy contracts/standing.py to GenLayer Testnet Bradbury.
 *
 *   $env:STANDING_DEPLOYER_KEY = "0x..."     # PowerShell
 *   npm run deploy
 *
 * The key is read from the environment and never from an argument, because
 * arguments end up in shell history and in the process list. It is never
 * printed, and only the derived address is shown so you can check you are
 * spending from the account you meant to.
 *
 * Deploying costs gas and creates a permanent record on a public network, so
 * this prints exactly what it is about to do and waits for you to confirm
 * before it sends anything. Pass --yes to skip that in a scripted run.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = join(HERE, "..", "contracts", "standing.py");

const GEN = 10n ** 18n;

function flag(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const key = process.env.STANDING_DEPLOYER_KEY;

if (!key) {
  die(
    [
      "STANDING_DEPLOYER_KEY is not set.",
      "",
      "  PowerShell:  $env:STANDING_DEPLOYER_KEY = \"0x...\"",
      "  bash:        export STANDING_DEPLOYER_KEY=0x...",
      "",
      "  The account needs testnet GEN. Faucet:",
      "  https://testnet-faucet.genlayer.foundation/",
    ].join("\n")
  );
}

if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  // Deliberately says nothing about what was found, only what is expected.
  die("STANDING_DEPLOYER_KEY is not a 32 byte hex private key (0x + 64 hex).");
}

/* The brief's numbers. Both are constructor arguments rather than constants in
 * the contract, so a redeploy can change them without touching the source. */
const feeGen = Number(flag("fee", "0.4"));
const overlapBps = Number(flag("overlap", "6000"));

if (!Number.isFinite(feeGen) || feeGen <= 0) die("--fee must be a positive number of GEN.");
if (!Number.isInteger(overlapBps) || overlapBps < 5000 || overlapBps > 10000) {
  die(
    "--overlap must be a whole number of basis points between 5000 and 10000.\n" +
      "  Below 5000 a certificate could be issued when most validators disagreed."
  );
}

// Scaled in two steps rather than Math.round(feeGen * 1e18). The one step
// version overflows float64's 53 bit mantissa and is silently wrong for about
// one fee in eleven: --fee=0.009 becomes 8999999999999999 wei, a hair under the
// number the contract will then reject every payment against. 0.4 happens to
// land exactly, which is precisely why this is worth guarding rather than
// spot checking.
const feeWei = BigInt(Math.round(feeGen * 1e9)) * (GEN / 10n ** 9n);

const code = readFileSync(CONTRACT, "utf8");
const account = createAccount(key);

console.log("");
console.log("  contract    contracts/standing.py");
console.log(`  bytes       ${code.length.toLocaleString("en-US")}`);
console.log(`  network     ${testnetBradbury.name} (chain ${testnetBradbury.id})`);
console.log(`  deployer    ${account.address}`);
console.log(`  fee         ${feeGen} GEN  (${feeWei} wei)`);
console.log(`  overlap     ${overlapBps} bps`);
console.log("");

if (!process.argv.includes("--yes")) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question("  Deploy this? Type yes to continue: ");
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") die("Nothing was deployed.");
}

const client = createClient({ chain: testnetBradbury, account });

console.log("\n  deploying…");

const hash = await client.deployContract({
  code,
  args: [feeWei, overlapBps],
});

console.log(`  tx          ${hash}`);
console.log("  waiting for the network to accept it…");

const accepted = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.ACCEPTED,
});

const address =
  accepted?.data?.contract_address ??
  accepted?.contract_address ??
  accepted?.result?.contract_address;

if (!address) {
  console.error("\n  Accepted, but no contract address came back on the receipt.");
  console.error("  Look the transaction up in the explorer and read the address there:");
  console.error(`  ${testnetBradbury.blockExplorers.default.url}tx/${hash}\n`);
  console.error(JSON.stringify(accepted, null, 2).slice(0, 2000));
  process.exit(1);
}

console.log("  waiting for finality…");
await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.FINALIZED,
});

console.log("");
console.log("  deployed");
console.log(`  address     ${address}`);
console.log(`  explorer    ${testnetBradbury.blockExplorers.default.url}address/${address}`);
console.log("");
console.log("  Put this in .env.local, then restart the dev server:");
console.log("");
console.log(`  NEXT_PUBLIC_STANDING_ADDRESS=${address}`);
console.log("");
console.log("  The sample-data banner disappears on its own once that is set.");
console.log("");
