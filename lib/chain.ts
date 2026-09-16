/**
 * Wiring to the Standing contract on GenLayer.
 *
 * Writes go through the reader's own wallet. The site holds no key and signs
 * nothing, so every capture, watch and question on chain was paid for by the
 * account that asked. Reads go through lib/store.ts on the server.
 */

import { createClient } from "genlayer-js";
import { studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { getAddress } from "viem";

import type { Stats, WriteStage } from "./types";
import { checkUrl, withScheme } from "./url";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* Which network this build talks to. A contract address is per network, so
 * changing this without changing NEXT_PUBLIC_STANDING_ADDRESS gives a site
 * that cannot find its own contract. */
const NETWORKS = {
  bradbury: testnetBradbury,
  asimov: testnetAsimov,
  studio: studionet,
} as const;

type NetworkName = keyof typeof NETWORKS;

/* GenLayer Studio is the default, because that is where the contract is
 * deployed. A default that disagrees with the deployment is a trap: the site
 * reads a network the address does not live on and shows empty states. */
const requested = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studio") as NetworkName;

export const NETWORK_NAME: NetworkName = requested in NETWORKS ? requested : "studio";

export const CHAIN = NETWORKS[NETWORK_NAME];

/* Studio's chain definition names an explorer host that answers 503. The one
 * that serves Studio transactions is pinned here instead. */
export const EXPLORER =
  NETWORK_NAME === "studio"
    ? "https://explorer-studio.genlayer.com"
    : (CHAIN.blockExplorers?.default.url ?? "https://explorer-bradbury.genlayer.com").replace(/\/$/, "");

export const RPC_URL = CHAIN.rpcUrls.default.http[0];

export const FAUCET_URL = "https://testnet-faucet.genlayer.foundation/";

export const STANDING = (process.env.NEXT_PUBLIC_STANDING_ADDRESS || "") as `0x${string}`;

export const IS_LIVE = STANDING.length > 0;

/* An explicit NEXT_PUBLIC_ORIGIN wins, so a real domain can be pinned. Failing
 * that, Vercel's production domain, which lets a first deploy print correct
 * citations with nothing configured. The NEXT_PUBLIC_ copy of the Vercel
 * variable is the one a client bundle can read. */
const VERCEL_PRODUCTION_URL = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const ORIGIN =
  process.env.NEXT_PUBLIC_ORIGIN ||
  (VERCEL_PRODUCTION_URL ? `https://${VERCEL_PRODUCTION_URL}` : "http://localhost:3200");

export function readClient() {
  return createClient({ chain: CHAIN });
}

export function writeClient(address: `0x${string}`, provider: any) {
  return createClient({ chain: CHAIN, account: address, provider });
}

function getProvider(): any {
  const provider = (globalThis as any).ethereum;
  if (!provider) throw new Error("no_wallet");
  return provider;
}

async function ensureNetwork(provider: any): Promise<void> {
  const chainId = `0x${CHAIN.id.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (e: any) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code !== 4902) throw e;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: CHAIN.name,
          rpcUrls: [RPC_URL],
          nativeCurrency: CHAIN.nativeCurrency,
          blockExplorerUrls: [EXPLORER],
        },
      ],
    });
  }
}

export async function connectWallet(): Promise<`0x${string}`> {
  const provider = getProvider();
  const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
  await ensureNetwork(provider);
  return accounts[0] as `0x${string}`;
}

/* -------------------------------------------------------------------------
 * The network, read defensively.
 * ---------------------------------------------------------------------- */

/**
 * A dropped connection is not a failed transaction. Studio drops TLS now and
 * then, and genlayer-js gives up on its own poll loop with a timeout. Neither
 * means anything went wrong on chain.
 */
function isTransientRpc(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return /fetch failed|ECONNRESET|socket|network|timed out|timeout|Server busy|-32006|rate limit|unknown RPC/i.test(msg);
}

async function waitFor(client: any, hash: string, status: TransactionStatus, attempts = 6): Promise<any> {
  let wait = 2000;
  for (let i = 1; ; i += 1) {
    try {
      return await client.waitForTransactionReceipt({ hash, status });
    } catch (e) {
      if (i >= attempts || !isTransientRpc(e)) throw e;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), 15000);
    }
  }
}

/** The sentence the contract refused with, from whichever shape the node sent. */
function refusalText(round: any): string {
  const res = round?.result;
  if (!res) return "";
  if (typeof res === "object") return String(res.payload ?? res.data ?? "");
  try {
    return atob(String(res)).slice(1).replace(/[^\x20-\x7e\n]/g, "").trim();
  } catch {
    return "";
  }
}

/**
 * Throw if the contract refused the call, however the receipt reads.
 *
 * A receipt carries three fields that look like a verdict and two of them do
 * not mean "my code ran": the status is final on a refused call, because
 * refusing is a successful transaction, and the result is agreement, because
 * validators agreeing that a call failed is still agreement. Only the leader
 * receipt's execution_result answers the question.
 */
function assertExecuted(receipt: any, what: string): void {
  const lr = receipt?.consensus_data?.leader_receipt ?? receipt?.consensusData?.leaderReceipt;
  const rounds = Array.isArray(lr) ? lr : lr ? [lr] : [];
  const leader = rounds.find((r: any) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0];
  if (!leader) return;
  const exec = String(leader.execution_result ?? leader.executionResult ?? "");
  if (exec === "" || exec.toUpperCase() === "SUCCESS") return;
  throw new Error(refusalText(leader) || `${what} was refused by the contract`);
}

/** One view, retried: reads are free and idempotent. */
export async function readView(functionName: string, args: unknown[] = [], attempts = 4): Promise<any> {
  let wait = 1200;
  for (let i = 1; ; i += 1) {
    try {
      return await (readClient() as any).readContract({ address: STANDING, functionName, args });
    } catch (e) {
      if (i >= attempts || !isTransientRpc(e)) throw e;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), 10000);
    }
  }
}

/** Every Standing view returns JSON text with sorted keys. */
export async function readJson<T = any>(functionName: string, args: unknown[] = []): Promise<T> {
  const raw = await readView(functionName, args);
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

export function mapStats(raw: any): Stats {
  return {
    owner: String(raw?.owner ?? ""),
    fee: BigInt(raw?.fee ?? 0),
    assessFee: BigInt(raw?.assess_fee ?? 0),
    snapshotFee: BigInt(raw?.snapshot_fee ?? 0),
    feesAccrued: BigInt(raw?.fees_accrued ?? 0),
    prepaidHeld: BigInt(raw?.prepaid_held ?? 0),
    certificates: Number(raw?.certificates ?? 0),
    watches: Number(raw?.watches ?? 0),
    assessments: Number(raw?.assessments ?? 0),
  };
}

/** The contract's own prices and counts, read at the moment they are needed. */
export async function readStats(): Promise<Stats> {
  return mapStats(await readJson("stats"));
}

/* -------------------------------------------------------------------------
 * Writes. Every one reads its price from the contract immediately before it
 * signs, because the contract accepts only the exact price.
 * ---------------------------------------------------------------------- */

type Staged = { onStage?: (s: WriteStage, note?: string) => void };

async function send(opts: {
  address: `0x${string}`;
  functionName: string;
  args: unknown[];
  value: bigint;
  what: string;
  note?: string;
} & Staged): Promise<string> {
  if (!IS_LIVE) throw new Error("not_deployed");
  const client = writeClient(opts.address, getProvider());
  opts.onStage?.("signing");
  const hash = await client.writeContract({
    address: STANDING,
    functionName: opts.functionName,
    args: opts.args as any,
    value: opts.value,
  });
  opts.onStage?.("sent", opts.note);
  const accepted = await waitFor(client, hash, TransactionStatus.ACCEPTED);
  assertExecuted(accepted, opts.what);
  opts.onStage?.("accepted");
  return hash;
}

function normalised(url: string): string {
  const checked = checkUrl(withScheme(url));
  if (!checked.ok) throw new Error(checked.reason);
  return checked.url;
}

/** Certify what a page states now. */
export async function notarize(opts: { address: `0x${string}`; url: string } & Staged): Promise<{ certId: number; hash: string }> {
  const target = normalised(opts.url);
  const { fee } = await readStats();
  const hash = await send({
    ...opts,
    functionName: "notarize",
    args: [target],
    value: fee,
    what: "This capture",
    note: "Each validator is reading the page for itself and checking every claim against its own copy.",
  });
  /* The receipt does not carry the new id in a shape worth trusting, so it is
   * asked of the contract: the page's newest captures, and the one this
   * account paid for. */
  const page = await readJson<{ items: any[] }>("history", [target, 5]);
  const mine = page.items.find((c) => String(c.requester).toLowerCase() === opts.address.toLowerCase());
  if (!mine) throw new Error("capture_not_found");
  return { certId: Number(mine.id), hash };
}

/** Prepay captures of a page on a cadence. */
export async function openWatch(
  opts: { address: `0x${string}`; url: string; cadenceHours: number; captures: number } & Staged,
): Promise<{ watchId: number; hash: string }> {
  const target = normalised(opts.url);
  /* On Studio a refused payable call keeps what was sent with it, so a page
   * that is already watched is caught here, before anyone signs. */
  const existing = await readJson<any>("watch_for_url", [target]);
  if (existing?.active) throw new Error(`already_watched:${existing.id}`);
  const { fee } = await readStats();
  const hash = await send({
    ...opts,
    functionName: "watch",
    args: [target, opts.cadenceHours],
    value: fee * BigInt(opts.captures),
    what: "Opening this watch",
  });
  const watch = await readJson<any>("watch_for_url", [target]);
  if (!watch || String(watch.owner).toLowerCase() !== opts.address.toLowerCase()) throw new Error("watch_not_found");
  return { watchId: Number(watch.id), hash };
}

/** Take a watch's due capture. Any account may; the owner already paid. */
export async function captureWatch(opts: { address: `0x${string}`; watchId: number } & Staged): Promise<{ certId: number | null; hash: string }> {
  const hash = await send({
    ...opts,
    functionName: "capture_watch",
    args: [opts.watchId],
    value: 0n,
    what: "This capture",
    note: "Each validator is reading the page for itself and checking every claim against its own copy.",
  });
  const watch = await readJson<any>("watch_record", [opts.watchId]);
  return { certId: watch?.last_cert ?? null, hash };
}

/** Add captures to a watch at the price it opened with. Owner only. */
export async function topUpWatch(opts: { address: `0x${string}`; watchId: number; unit: bigint; captures: number } & Staged): Promise<string> {
  return send({
    ...opts,
    functionName: "top_up_watch",
    args: [opts.watchId],
    value: opts.unit * BigInt(opts.captures),
    what: "This top up",
  });
}

/** Close a watch; whatever it still holds goes back to its owner. */
export async function closeWatch(opts: { address: `0x${string}`; watchId: number } & Staged): Promise<string> {
  return send({ ...opts, functionName: "close_watch", args: [opts.watchId], value: 0n, what: "Closing this watch" });
}

/** Put one question to the network about two captures of the same page. */
export async function assess(opts: { address: `0x${string}`; certA: number; certB: number } & Staged): Promise<{ assessmentId: number; hash: string }> {
  const { assessFee } = await readStats();
  const hash = await send({
    ...opts,
    functionName: "assess",
    args: [opts.certA, opts.certB],
    value: assessFee,
    what: "This question",
    note: "Each validator is asking its own model, in both orders, and comparing the answer.",
  });
  const found = await readJson<any>("assessment_for_pair", [opts.certA, opts.certB]);
  if (!found) throw new Error("assessment_not_found");
  return { assessmentId: Number(found.id), hash };
}

/**
 * Snapshot other contracts' views in one transaction. Addresses go out
 * checksummed as strings: the contract parses them, and Studio reads a
 * lowercased address as a contract that does not exist.
 */
export async function notarizeContracts(
  opts: { address: `0x${string}`; targets: string[]; methodSets: string[][] } & Staged,
): Promise<{ hash: string; count: number }> {
  if (opts.targets.length === 0) throw new Error("nothing_to_add");
  const { snapshotFee } = await readStats();
  const hash = await send({
    ...opts,
    functionName: "notarize_contracts",
    args: [opts.targets.map((t) => getAddress(t.toLowerCase())), opts.methodSets.map((m) => m.join(","))],
    value: snapshotFee * BigInt(opts.targets.length),
    what: "These snapshots",
    note: `Reading the views of ${opts.targets.length} contracts.`,
  });
  return { hash, count: opts.targets.length };
}

/**
 * Another contract's zero-argument view methods, from its schema: a method
 * with parameters has no single answer to record, and a write would change
 * the thing being observed.
 */
export async function contractViewMethods(address: string, attempts = 3): Promise<string[]> {
  const client = readClient();
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const schema: any = await client.getContractSchema(getAddress(address.toLowerCase()));
      const methods = schema?.methods ?? {};
      return Object.keys(methods)
        .filter((name) => methods[name]?.readonly === true && (methods[name]?.params ?? []).length === 0 && !name.startsWith("_"))
        .sort();
    } catch (e) {
      if (!isTransientRpc(e) || i === attempts) throw e;
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
  return [];
}

/** The contract's refusals are sentences written to be read, so they are shown as they are. */
export function readableError(e: any): string {
  const raw = e?.message ?? e?.data?.message ?? e?.shortMessage ?? (typeof e === "string" ? e : "");
  if (/user rejected|denied|4001/i.test(raw)) return "You cancelled the signature.";
  if (/no_wallet/.test(raw)) return "No wallet was found in this browser.";
  const watched = /already_watched:(\d+)/.exec(raw);
  if (watched) return `That page is already watched, as watch ${watched[1]}. Its owner can top that one up.`;
  if (/not_deployed/.test(raw)) return "This site is not pointed at a Standing contract yet.";
  if (/capture_not_found|watch_not_found|assessment_not_found/.test(raw)) {
    return "The transaction went through, but the new record could not be read back yet. Reload in a moment.";
  }
  if (/insufficient funds|insufficient balance/i.test(raw)) {
    return `This account does not hold enough GEN for the price. Testnet GEN comes from ${FAUCET_URL}`;
  }
  const quoted = /UserError\(?['"]?(.+?)['"]?\)?$/.exec(raw);
  const text = quoted ? quoted[1] : raw;
  if (!text) return "The transaction failed.";
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/\.?$/, ".");
}
