// Wiring to the Standing Intelligent Contract on GenLayer Testnet Bradbury.
// Writes go through the browser wallet; reads go through a cached server route.

import { createClient } from "genlayer-js";
import { studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { WriteStage } from "./types";
import { normaliseUrl } from "./format";

/* Which GenLayer network this build talks to.
 *
 * Bradbury is the default and where the contract lives. The switch exists
 * because a node can be healthy at the consensus layer and still not serve a
 * contract from the execution layer — that happened here: a deployment
 * finalized correctly and stayed unreadable for hours before the node caught
 * up. Being able to point a build elsewhere without editing source is worth
 * the handful of lines.
 *
 * A contract address is per network. Changing this without changing
 * NEXT_PUBLIC_STANDING_ADDRESS gives a site that cannot find its own contract,
 * which is why the name is printed in the console banner below.
 */
const NETWORKS = {
  bradbury: testnetBradbury,
  asimov: testnetAsimov,
  studio: studionet,
} as const;

type NetworkName = keyof typeof NETWORKS;

const requested = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK ??
  "bradbury") as NetworkName;

export const NETWORK_NAME: NetworkName = requested in NETWORKS
  ? requested
  : "bradbury";

export const CHAIN = NETWORKS[NETWORK_NAME];

export const FAUCET_URL = "https://testnet-faucet.genlayer.foundation/";

/* Read off the chain definition the client is already using rather than typed
 * out again. A hand written explorer url was wrong here once — it pointed at a
 * host that no longer exists, and it was being handed to wallets as the
 * explorer for the network they were being asked to add. */
export const EXPLORER = (
  CHAIN.blockExplorers?.default.url ??
  "https://explorer-bradbury.genlayer.com"
).replace(/\/$/, "");

export const RPC_URL = CHAIN.rpcUrls.default.http[0];

export const STANDING = (process.env.NEXT_PUBLIC_STANDING_ADDRESS ||
  "") as `0x${string}`;

export const IS_LIVE = STANDING.length > 0;

/* Resolution order, and each step earns its place.
 *
 * An explicit NEXT_PUBLIC_ORIGIN always wins, so a real domain can be pinned
 * once there is one. Failing that, Vercel hands every build its own production
 * domain, which is what lets a first deploy produce correct citations and open
 * graph cards with nothing configured at all — and this origin is not
 * cosmetic, it is the url printed inside every citation somebody pastes into
 * an article. The literal is the last resort, for local runs.
 *
 * The NEXT_PUBLIC_ prefixed copy of the Vercel variable is deliberate: this
 * module is imported by client components, and the bare
 * VERCEL_PROJECT_PRODUCTION_URL is server only, so it would inline as undefined
 * in the browser bundle and silently fall through to the literal.
 */
const VERCEL_PRODUCTION_URL =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const ORIGIN =
  process.env.NEXT_PUBLIC_ORIGIN ||
  (VERCEL_PRODUCTION_URL
    ? `https://${VERCEL_PRODUCTION_URL}`
    : "https://standing.wtf");

const BRADBURY = {
  chainIdHex: `0x${CHAIN.id.toString(16)}`,
  chainName: CHAIN.name,
  rpcUrls: [RPC_URL],
  nativeCurrency: CHAIN.nativeCurrency,
  blockExplorerUrls: [EXPLORER],
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export function readClient() {
  return createClient({ chain: CHAIN });
}

export function writeClient(address: `0x${string}`, provider: any) {
  return createClient({ chain: CHAIN, account: address, provider });
}

async function ensureNetwork(provider: any): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY.chainIdHex }],
    });
  } catch (e: any) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BRADBURY.chainIdHex,
            chainName: BRADBURY.chainName,
            rpcUrls: BRADBURY.rpcUrls,
            nativeCurrency: BRADBURY.nativeCurrency,
            blockExplorerUrls: BRADBURY.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

export async function connectWallet(): Promise<string> {
  const provider = (globalThis as any).ethereum;
  if (!provider) throw new Error("no_wallet");
  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });
  await ensureNetwork(provider);
  return accounts[0];
}

/**
 * Which certificate a capture produced, asked of the contract rather than
 * scraped off the receipt.
 *
 * The obvious source is the transaction's return value, and the obvious field
 * is `result` — which is the consensus vote (1 = AGREE), not the contract's
 * return, so reading it sent every capture to certificate 1. The real return
 * lives under `consensus_data.leader_receipt[].result`, a shape the Bradbury
 * receipt does not carry at all.
 *
 * So: read the counter and walk back, matching on url and requester. Slightly
 * more work, but it depends only on the contract's own public view methods,
 * which are the one part of this whose shape is guaranteed. The walk is
 * bounded because a handful of captures can land between the send and the
 * read; if none of them is ours, the caller is told rather than sent to
 * somebody else's record.
 */
async function findCertId(
  client: any,
  url: string,
  requester: string
): Promise<number> {
  const total = Number(
    await client.readContract({
      address: STANDING,
      functionName: "total_certs",
      args: [],
    })
  );

  const wanted = requester.toLowerCase();
  let mineButOtherUrl = -1;

  for (let id = total - 1; id >= 0 && id > total - 12; id--) {
    try {
      const cert: any = await client.readContract({
        address: STANDING,
        functionName: "certificate",
        args: [id],
      });
      if (String(cert?.requester).toLowerCase() !== wanted) continue;

      if (String(cert?.url) === url) return id;

      /* Ours, but the url does not match to the byte. The contract normalises
       * what it stores, and this client normalises the same way, so that
       * should not happen — but if the two ever drift, landing on this
       * requester's newest capture is far better than throwing after they
       * have already paid the fee. */
      if (mineButOtherUrl === -1) mineButOtherUrl = id;
    } catch {
      // A single unreadable record should not abandon the search.
    }
  }

  if (mineButOtherUrl !== -1) return mineButOtherUrl;

  throw new Error("capture_not_found");
}

/**
 * A capture takes about forty seconds, because several validators are each
 * fetching the page, rendering it and running a vision model. That is not a
 * spinner, so the caller is told which stage it is in and the copy narrates
 * what the network is doing.
 */
export async function notarize(opts: {
  address: `0x${string}`;
  url: string;
  onStage?: (s: WriteStage, note?: string) => void;
}): Promise<{ certId: number; hash: string }> {
  const { address, url, onStage } = opts;
  const provider = (globalThis as any).ethereum;
  if (!provider) throw new Error("no_wallet");
  if (!IS_LIVE) throw new Error("not_deployed");

  const client = writeClient(address, provider);

  // Never hardcoded. The fee is a governance value that can move, and a stale
  // constant in the client would fail the write with "fee too low".
  const fee = (await client.readContract({
    address: STANDING,
    functionName: "fee_value",
    args: [],
  })) as bigint;

  onStage?.("signing");

  /* Normalised here rather than trusting the caller, so the string sent and
   * the string findCertId matches on are the same one. */
  const target = normaliseUrl(url);

  const hash = await client.writeContract({
    address: STANDING,
    functionName: "notarize",
    args: [target],
    value: BigInt(fee),
  });

  onStage?.("sent", "validators are fetching the page");

  // Readable on acceptance: the certificate exists and can be shown. The share
  // and embed actions stay locked until finality, and the page says provisional
  // until then.
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  onStage?.("accepted", "agreed, writing the certificate");

  const certId = await findCertId(client, target, address);

  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  onStage?.("finalized");

  return { certId, hash };
}

export async function openWatch(opts: {
  address: `0x${string}`;
  url: string;
  cadenceHours: number;
  captures: number;
  onStage?: (s: WriteStage, note?: string) => void;
}): Promise<{ watchId: number; hash: string }> {
  const { address, url, cadenceHours, captures, onStage } = opts;
  const provider = (globalThis as any).ethereum;
  if (!provider) throw new Error("no_wallet");
  if (!IS_LIVE) throw new Error("not_deployed");

  const client = writeClient(address, provider);
  const fee = (await client.readContract({
    address: STANDING,
    functionName: "fee_value",
    args: [],
  })) as bigint;

  onStage?.("signing");

  const hash = await client.writeContract({
    address: STANDING,
    functionName: "watch",
    args: [url, cadenceHours],
    value: BigInt(fee) * BigInt(captures),
  });

  onStage?.("sent", "opening the watch");

  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  onStage?.("accepted");

  /* Same receipt problem as a capture, but the contract offers a direct
   * lookup here — one url has at most one watch — so this needs no walk.
   *
   * The lookup key is the url the contract stored, which is the normalised
   * one, so it is normalised here too rather than passed as typed. */
  const raw = await client.readContract({
    address: STANDING,
    functionName: "watch_for_url",
    args: [normaliseUrl(url)],
  });

  /* The contract answers with max u256 for a url it has no watch for, because
   * zero is a real watch id. Unguarded that becomes a redirect to a watch
   * numbered 1.1e77. */
  const watchId = Number(raw);
  if (!Number.isSafeInteger(watchId)) throw new Error("watch_not_found");

  // A watch holds prepaid captures, which is somebody's money sitting in the
  // contract, so nothing here calls it done before finality.
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  onStage?.("finalized");

  return { watchId, hash };
}

/**
 * Ask the network whether the change between two captures was substantive.
 *
 * This is the one call in the product that is a judgment rather than a record.
 * Several validators each read the same two claim sets, each decide
 * independently, and the transaction only lands if they reach the same verdict
 * — so the answer on chain is not one model's opinion.
 */
export async function assess(opts: {
  address: `0x${string}`;
  certA: number;
  certB: number;
  onStage?: (s: WriteStage, note?: string) => void;
}): Promise<{ assessmentId: number; hash: string }> {
  const { address, certA, certB, onStage } = opts;
  const provider = (globalThis as any).ethereum;
  if (!provider) throw new Error("no_wallet");
  if (!IS_LIVE) throw new Error("not_deployed");

  const client = writeClient(address, provider);

  // Read at call time, never hardcoded: it is derived from the capture fee and
  // moves with it.
  const price = (await client.readContract({
    address: STANDING,
    functionName: "assess_fee",
    args: [],
  })) as bigint;

  onStage?.("signing");

  const hash = await client.writeContract({
    address: STANDING,
    functionName: "assess",
    args: [certA, certB],
    value: BigInt(price),
  });

  onStage?.("sent", "validators are each reading both captures and deciding");

  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  onStage?.("accepted", "agreed. writing the verdict");

  /* Same receipt problem as the other writes — `result` is the consensus vote,
   * not the return — so the id comes from the contract's own pair lookup. */
  const raw = await client.readContract({
    address: STANDING,
    functionName: "assessment_for_pair",
    args: [certA, certB],
  });

  const assessmentId = Number(raw);
  if (!Number.isSafeInteger(assessmentId)) throw new Error("assessment_not_found");

  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  });
  onStage?.("finalized");

  return { assessmentId, hash };
}

/**
 * The contract's error strings are written for people to read, so they are
 * shown as they are rather than replaced with a generic failure.
 */
export function readableError(e: any): string {
  const raw =
    e?.message ??
    e?.data?.message ??
    e?.shortMessage ??
    (typeof e === "string" ? e : "");

  if (/user rejected|denied|4001/i.test(raw)) return "You cancelled the signature.";
  if (/no_wallet/.test(raw))
    return "No wallet was found in this browser.";
  if (/not_deployed/.test(raw))
    return "The contract is not deployed yet, so nothing can be captured.";
  if (/insufficient funds|insufficient balance/i.test(raw))
    return `Not enough GEN in this account to pay the fee. Bradbury is a testnet, so top it up at ${FAUCET_URL}`;

  // The interesting failures come back carrying the contract's own sentence.
  const m = /UserError\(?['"]?(.+?)['"]?\)?$/.exec(raw);
  if (m) return m[1];
  return raw || "The transaction failed.";
}
