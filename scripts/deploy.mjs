/**
 * Deploy contracts/standing.py.
 *
 *   read -s -p "key: " STANDING_DEPLOYER_KEY && export STANDING_DEPLOYER_KEY && echo
 *   npm run deploy -- --fund
 *
 * The key is read from the environment, never from an argument, because
 * arguments end up in shell history and in the process list. The line above
 * reads it without echoing it and without writing it to history. It is never
 * printed; only the derived address is shown, so you can check you are
 * spending from the account you meant to.
 *
 * Deploying creates a permanent record on a public network, so this prints
 * exactly what it is about to do and waits for you to type yes. Pass --yes to
 * skip that in a scripted run, --fee=0.4 to set the capture price in GEN, and
 * --fund to ask Studio's own faucet for 100 GEN first.
 *
 * The source is sent with LF line endings on every platform, so the deployed
 * bytes are the bytes the repository stores and `npm run match` can compare
 * them from any checkout.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { createClient, createAccount } from "genlayer-js";
import { TransactionStatus } from "genlayer-js/types";

import { pickNetwork } from "./network.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = join(HERE, "..", "contracts", "standing.py");
const net = pickNetwork();
const FAUCET = "https://testnet-faucet.genlayer.foundation/";
const GEN = 10n ** 18n;
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

/**
 * Thrown rather than exiting on the spot. process.exit() while the rpc
 * connection is open trips a libuv assertion on Windows, which buries the
 * message under a C level stack trace.
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

const GEN_PER_FUND = 100n;

/**
 * Studio's own faucet, for the deployer account. Studio only: bradbury's is a
 * browser page and cannot be automated. The amount goes as a decimal string,
 * and success is decided by reading the balance back, because the answer to
 * sim_fundAccount says nothing either way about whether the credit landed.
 */
async function fund(client, address) {
  const before = await client.getBalance({ address });
  await fetch(net.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sim_fundAccount", params: [address, String(GEN_PER_FUND * GEN)] }),
  }).catch(() => null);
  for (let i = 0; i < 12; i += 1) {
    await sleep(1500);
    const after = await client.getBalance({ address });
    if (after > before) return after;
  }
  return die("The faucet was asked, but the balance has not moved. Run this again in a minute.");
}

/**
 * genlayer-js estimates gas itself, and if that one rpc call drops it falls
 * back to a fixed 200_000 gas, which is too little for this contract: the
 * chain answers "intrinsic gas too low" before consensus and nothing is spent.
 * There is no public way to pass a gas value, so the whole call is retried
 * when that exact failure appears. A real constructor refusal is left alone.
 */
async function deployWithRetry(client, code, feeWei, attempts = 3) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await client.deployContract({ code, args: [feeWei] });
    } catch (e) {
      const msg = String(e?.message ?? e);
      const starved = /intrinsic gas too low/i.test(msg);
      const flaky = /fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);
      if ((starved || flaky) && i < attempts) {
        console.log(`  attempt ${i} hit a transient rpc failure, nothing was spent, retrying`);
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
        "STANDING_DEPLOYER_KEY is not set. In Git Bash:",
        "",
        '  read -s -p "key: " STANDING_DEPLOYER_KEY && export STANDING_DEPLOYER_KEY && echo',
        "",
        net.name === "studio"
          ? "  The account needs GEN. npm run deploy -- --fund asks Studio's faucet for 100 first."
          : `  The account needs testnet GEN: ${FAUCET}`,
      ].join("\n"),
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    die("STANDING_DEPLOYER_KEY is not a 32 byte hex private key (0x and 64 hex characters).");
  }

  const feeGen = Number(flag("fee", "0.4"));
  if (!Number.isFinite(feeGen) || feeGen <= 0) die("--fee must be a positive number of GEN.");

  /* Scaled in two steps. Math.round(fee * 1e18) overflows a float's mantissa
   * and is wrong for about one fee in eleven; 0.4 happens to land exactly. */
  const feeWei = BigInt(Math.round(feeGen * 1e9)) * (GEN / 10n ** 9n);
  if (feeWei < 4n) die("--fee is below the contract's floor of four wei.");

  const code = readFileSync(CONTRACT, "utf8").split(CR + LF).join(LF);
  const account = createAccount(key);
  const client = createClient({ chain: net.chain, account });

  const funding = process.argv.includes("--fund");
  if (funding && net.name !== "studio") die("--fund is Studio's faucet. On this network, fund the account yourself: " + FAUCET);

  let balance;
  try {
    if (funding) {
      console.log("\n  asking Studio's faucet for test GEN");
      balance = await fund(client, account.address);
    } else {
      balance = await client.getBalance({ address: account.address });
    }
  } catch (e) {
    if (e instanceof Abort) throw e;
    die(`Could not reach ${net.rpc} to read the balance.\n  ${e?.shortMessage ?? e?.message ?? e}`);
  }

  console.log("");
  console.log("  contract    contracts/standing.py");
  console.log(`  bytes       ${Buffer.byteLength(code, "utf8").toLocaleString("en-US")}`);
  console.log(`  network     ${net.chain.name} (chain ${net.chain.id}) [--network=${net.name}]`);
  console.log(`  deployer    ${account.address}`);
  console.log(`  balance     ${Number((balance * 10000n) / GEN) / 10000} GEN`);
  console.log(`  fee         ${feeGen} GEN  (${feeWei} wei)`);
  console.log("");

  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("  Deploy this? Type yes to continue: ");
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") die("Nothing was deployed.");
  }

  console.log("\n  deploying");
  const hash = await deployWithRetry(client, code, feeWei);
  console.log(`  tx          ${hash}`);
  console.log("  waiting for the network to accept it");

  const accepted = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
  const address = accepted?.data?.contract_address ?? accepted?.contract_address ?? accepted?.result?.contract_address;
  if (!address) {
    console.error("\n  Accepted, but no contract address came back on the receipt. Read it with:");
    console.error(`  npm run tx -- ${hash} --network=${net.name}\n`);
    die("Could not read the deployed address.");
  }

  console.log("");
  console.log("  deployed");
  console.log(`  address     ${address}`);
  console.log(`  explorer    ${net.explorer}address/${address}`);
  console.log("");
  console.log("  Next:");
  console.log(`    npm run verify -- ${address} --network=${net.name}`);
  console.log(`    npm run match -- ${address} --network=${net.name}`);
  console.log("");
  console.log("  Then set these in Vercel and in .env.local, and redeploy the site:");
  console.log(`    NEXT_PUBLIC_STANDING_ADDRESS=${address}`);
  console.log(`    NEXT_PUBLIC_GENLAYER_NETWORK=${net.name}`);
  console.log("");
}

try {
  await main();
} catch (e) {
  console.error(`\n  ${e instanceof Abort ? e.message : e?.shortMessage ?? e?.message ?? e}\n`);
  process.exitCode = 1;
}
