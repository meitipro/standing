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
import { pickNetwork } from "./network.mjs";
import { TransactionStatus } from "genlayer-js/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = join(HERE, "..", "contracts", "standing.py");
const net = pickNetwork();
const EXPLORER = net.explorer;
const FAUCET = "https://testnet-faucet.genlayer.foundation/";

const GEN = 10n ** 18n;

/**
 * Thrown rather than exiting on the spot.
 *
 * `process.exit()` while the rpc connection is still open trips a libuv
 * assertion on Windows — the script dies with a C level stack trace on top of
 * whatever message it was trying to deliver, which is a rotten way to be told
 * to visit the faucet. Unwinding to one handler and setting exitCode lets node
 * close its own handles and leaves the message as the last thing on screen.
 */
class Abort extends Error {}

function die(message) {
  throw new Abort(message);
}

function flag(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * genlayer-js's deployContract estimates gas itself, and if that single rpc
 * call drops — a lone ECONNRESET, seen twice in testing — it silently falls
 * back to a hardcoded 200_000 gas rather than retrying. For a contract this
 * size that is not enough, and the chain answers "intrinsic gas too low"
 * before the transaction ever reaches consensus, so nothing is spent — only
 * the attempt is wasted.
 *
 * There is no public way to hand deployContract a gas value of our own, so
 * the only lever from outside is to retry the whole call when this exact
 * shape of failure shows up. A real contract error (the constructor itself
 * rejecting, say) does not look like this and is left to propagate.
 */
async function deployWithRetry(client, code, feeWei, overlapBps, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await client.deployContract({ code, args: [feeWei, overlapBps] });
    } catch (e) {
      const msg = String(e?.message ?? e);
      const lookedStarved = /intrinsic gas too low/i.test(msg);
      const lookedFlaky = /fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);

      if ((lookedStarved || lookedFlaky) && i < attempts) {
        console.log(
          `  attempt ${i} hit a transient rpc hiccup (${
            lookedStarved ? "gas estimation fell back too low" : "connection dropped"
          }), nothing was spent — retrying…`
        );
        await sleep(2000 * i);
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  const key = process.env.STANDING_DEPLOYER_KEY;

  if (!key) {
    die(
      [
        "STANDING_DEPLOYER_KEY is not set.",
        "",
        '  PowerShell:  $env:STANDING_DEPLOYER_KEY = "0x..."',
        "  bash:        export STANDING_DEPLOYER_KEY=0x...",
        "",
        "  The account needs testnet GEN. Faucet:",
        `  ${FAUCET}`,
      ].join("\n")
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    // Deliberately says nothing about what was found, only what is expected.
    die("STANDING_DEPLOYER_KEY is not a 32 byte hex private key (0x + 64 hex).");
  }

  /* The brief's numbers. Both are constructor arguments rather than constants
   * in the contract, so a redeploy can change them without touching source. */
  const feeGen = Number(flag("fee", "0.4"));
  const overlapBps = Number(flag("overlap", "6000"));

  if (!Number.isFinite(feeGen) || feeGen <= 0) {
    die("--fee must be a positive number of GEN.");
  }
  if (!Number.isInteger(overlapBps) || overlapBps < 5000 || overlapBps > 10000) {
    die(
      "--overlap must be a whole number of basis points between 5000 and 10000.\n" +
        "  Below 5000 a certificate could be issued when most validators disagreed."
    );
  }

  // Scaled in two steps rather than Math.round(feeGen * 1e18). The one step
  // version overflows float64's 53 bit mantissa and is silently wrong for about
  // one fee in eleven: --fee=0.009 becomes 8999999999999999 wei, a hair under
  // the number the contract then rejects every payment against. 0.4 happens to
  // land exactly, which is why this is worth guarding rather than spot checking.
  const feeWei = BigInt(Math.round(feeGen * 1e9)) * (GEN / 10n ** 9n);

  const code = readFileSync(CONTRACT, "utf8");
  const account = createAccount(key);
  const client = createClient({ chain: net.chain, account });

  /* Checked before the confirmation prompt rather than after it. An unfunded
   * account fails somewhere inside the send with a message about gas that reads
   * like the contract is broken, and the real problem — a faucet visit — is
   * nowhere in it. */
  let balance;
  try {
    balance = await client.getBalance({ address: account.address });
  } catch (e) {
    die(
      `Could not reach ${net.rpc} to read the balance.\n` +
        `  ${e?.shortMessage ?? e?.message ?? e}`
    );
  }

  if (balance === 0n) {
    die(
      [
        `${account.address} holds no GEN, so the deployment would fail.`,
        "",
        "  Fund it from the faucet, then run this again:",
        `  ${FAUCET}`,
      ].join("\n")
    );
  }

  const balanceGen = Number((balance * 10000n) / GEN) / 10000;

  console.log("");
  console.log("  contract    contracts/standing.py");
  console.log(`  bytes       ${code.length.toLocaleString("en-US")}`);
  console.log(`  network     ${net.chain.name} (chain ${net.chain.id}) [--network=${net.name}]`);
  console.log(`  deployer    ${account.address}`);
  console.log(`  balance     ${balanceGen} GEN`);
  console.log(`  fee         ${feeGen} GEN  (${feeWei} wei)`);
  console.log(`  overlap     ${overlapBps} bps`);
  console.log("");

  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("  Deploy this? Type yes to continue: ");
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") die("Nothing was deployed.");
  }

  console.log("\n  deploying…");

  const hash = await deployWithRetry(client, code, feeWei, overlapBps);

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
    console.error("  Look the transaction up and read the address there:");
    console.error(`  ${EXPLORER}tx/${hash}\n`);
    console.error(JSON.stringify(accepted, null, 2).slice(0, 2000));
    die("Could not read the deployed address.");
  }

  console.log("  waiting for finality…");
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });

  console.log("");
  console.log("  deployed");
  console.log(`  address     ${address}`);
  console.log(`  explorer    ${EXPLORER}address/${address}`);
  console.log("");
  console.log("  Set this in Vercel, and in .env.local for local runs:");
  console.log("");
  console.log(`  NEXT_PUBLIC_STANDING_ADDRESS=${address}`);
  console.log("");
  console.log("  The sample-data banner disappears on its own once that is set");
  console.log("  and the site is redeployed.");
  console.log("");
}

try {
  await main();
} catch (e) {
  console.error(`\n  ${e instanceof Abort ? e.message : e?.shortMessage ?? e?.message ?? e}\n`);
  process.exitCode = 1;
}
