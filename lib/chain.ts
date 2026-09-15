/**
 * Wiring to the Standing contract on GenLayer Studio Next.
 *
 * Writes go through the reader's own wallet. The site holds no key and signs
 * nothing, so every capture, watch and question on chain was paid for by the
 * account that asked. Reads go through lib/store.ts on the server.
 *
 * Studio Next runs consensus v0.6, where every write carries a fee deposit
 * beside the price the contract asks. The deposit pays the validators for the
 * time they spend, and what they do not spend comes back at finalization.
 */

import {
  createClient,
  deriveExternalMessageCallKey,
  encodeExternalMessageFeeParams,
  MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
} from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { getAddress } from "viem";

import { formatGen } from "./format";
import type { Stats, WriteStage } from "./types";
import { checkUrl, withScheme } from "./url";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* Studio Next is the SDK's studioDevnet: studio-next.genlayer.com and
 * studio-dev.genlayer.com are one network, chain 61997. The organisers name
 * the first, so its RPC is pinned here, and so is the explorer, which the SDK
 * leaves unset for this network. scripts/network.mjs pins the same two. */
export const CHAIN = {
  ...studioDevnet,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } },
} as typeof studioDevnet;

export const EXPLORER = "https://explorer-studio-dev.genlayer.com";

export const RPC_URL = CHAIN.rpcUrls.default.http[0];

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

/** One call, retried while the failure is the connection's and not the chain's. */
async function retried<T>(fn: () => Promise<T>, attempts = 4, first = 1200, cap = 10000): Promise<T> {
  let wait = first;
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isTransientRpc(e)) throw e;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(Math.round(wait * 1.8), cap);
    }
  }
}

/**
 * Until the validators have decided. A capture reads a page and asks a model
 * on every node, so the poll runs for up to six minutes. The full transaction
 * is asked for because the simplified receipt drops the leader's result, and
 * that is where a refusal's sentence is.
 */
function waitFor(client: any, hash: string): Promise<any> {
  return retried(
    () => client.waitForTransactionReceipt({ hash, waitUntil: "decided", fullTransaction: true, interval: 3000, retries: 120 }),
    6,
    2000,
    15000,
  );
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
 * Throw unless the contract ran the call and returned.
 *
 * A decided transaction is not a successful one. The validators can decide
 * that they could not agree, and they can agree that the contract refused:
 * refusing is a transaction that completed. Only the execution result, which
 * v0.6 reports at the top of the receipt, says the code returned.
 */
function assertExecuted(receipt: any, what: string): void {
  const outcome = receipt?.lifecycle?.outcome;
  if (outcome && outcome !== "accepted") throw new Error(`no_agreement:${outcome}`);
  const execution = String(receipt?.txExecutionResultName ?? "");
  if (execution === "FINISHED_WITH_RETURN") return;
  if (execution === "NONDET_DISAGREE" || execution === "TIMEOUT") throw new Error(`no_agreement:${execution}`);
  const lr = receipt?.consensus_data?.leader_receipt;
  const rounds = Array.isArray(lr) ? lr : lr ? [lr] : [];
  const leader = rounds.find((r: any) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0];
  throw new Error(refusalText(leader) || `${what} was refused by the contract`);
}

/** One view, retried: reads are free and idempotent. */
export function readView(functionName: string, args: unknown[] = []): Promise<any> {
  return retried(() => (readClient() as any).readContract({ address: STANDING, functionName, args }));
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
 * The fee deposit.
 *
 * Asked for at the most time Studio Next lets a phase have, because a capture
 * reads a page and asks a model on every node, and a deposit that runs out
 * part way wastes the capture. It is refundable: what is not spent comes back.
 * ---------------------------------------------------------------------- */

/** Studio Next accepts 30 to 600 time units per phase. */
const TIMEUNITS = 600;

/* A refund leaves the contract as an external message, and consensus v0.6
 * funds one only when the transaction declares it at the root of its message
 * tree: the payee, the unnamed call key of a plain value transfer, and a
 * budget for the transfer's gas. Without it the transfer fails with
 * "fee no_matching_allocation # external", after everything else has run. */
const PAYOUT_BUDGET = 10n ** 15n;
const PAYOUT_GAS = { gasLimit: 100_000n, maxGasPrice: 10n ** 9n };

function payoutNode(payee: string) {
  return {
    messageType: 0,
    onAcceptance: false,
    parentIndex: MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,
    recipient: getAddress(payee.toLowerCase()),
    callKey: deriveExternalMessageCallKey("0x"),
    budget: PAYOUT_BUDGET,
    feeParams: encodeExternalMessageFeeParams(PAYOUT_GAS),
  };
}

type Fees = { distribution: any; feeValue: bigint; messageAllocations?: any[] };

/** The deposit for one write, or none when the network charges nothing. */
async function feeDeposit(client: any, payee?: string): Promise<Fees | undefined> {
  const options: any = { leaderTimeunitsAllocation: TIMEUNITS, validatorTimeunitsAllocation: TIMEUNITS, rotations: [1] };
  /* The SDK derives the message total from the allocations. A stated 0 beside
   * a budget reverts at submission with MessageAllocationsNotEqualBudget. */
  if (payee) options.messageAllocations = [payoutNode(payee)];
  else options.totalMessageFees = 0;
  const estimate = await retried(() => client.estimateTransactionFees(options) as Promise<any>);
  if (estimate?.policy?.enabled === false) return undefined;
  const fees: Fees = { distribution: estimate.distribution, feeValue: BigInt(estimate.feeValue) };
  const allocations = estimate.messageAllocations?.length ? estimate.messageAllocations : options.messageAllocations;
  if (allocations) fees.messageAllocations = allocations;
  return fees;
}

function signingNote(value: bigint, fees?: Fees): string {
  const price = value > 0n ? `${formatGen(value)} GEN to the contract` : "no price";
  if (!fees) return `Confirm in your wallet: ${price}.`;
  return `Confirm in your wallet: ${price}, plus a fee deposit of ${formatGen(fees.feeValue)} GEN. What the validators do not use comes back.`;
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
  /** Who the call pays out to, when it can. */
  payee?: string;
} & Staged): Promise<string> {
  if (!IS_LIVE) throw new Error("not_deployed");
  const client = writeClient(opts.address, getProvider());
  const fees = await feeDeposit(client, opts.payee);
  opts.onStage?.("signing", signingNote(opts.value, fees));
  const hash = await client.writeContract({
    address: STANDING,
    functionName: opts.functionName,
    args: opts.args as any,
    value: opts.value,
    ...(fees ? { fees } : {}),
  });
  opts.onStage?.("sent", opts.note);
  const decided = await waitFor(client, hash);
  assertExecuted(decided, opts.what);
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
  /* A page that is already watched is caught here, before anyone signs for a
   * call the contract would refuse. */
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

/** Close a watch; whatever it still holds goes back to its owner, who is the caller. */
export async function closeWatch(opts: { address: `0x${string}`; watchId: number } & Staged): Promise<string> {
  return send({
    ...opts,
    functionName: "close_watch",
    args: [opts.watchId],
    value: 0n,
    what: "Closing this watch",
    payee: opts.address,
  });
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
export async function contractViewMethods(address: string): Promise<string[]> {
  const client = readClient();
  const schema: any = await retried(() => client.getContractSchema(getAddress(address.toLowerCase())) as Promise<any>, 3, 800);
  const methods = schema?.methods ?? {};
  return Object.keys(methods)
    .filter((name) => methods[name]?.readonly === true && (methods[name]?.params ?? []).length === 0 && !name.startsWith("_"))
    .sort();
}

/** The contract's refusals are sentences written to be read, so they are shown as they are. */
export function readableError(e: any): string {
  const raw = e?.message ?? e?.data?.message ?? e?.shortMessage ?? (typeof e === "string" ? e : "");
  if (/user rejected|denied|4001/i.test(raw)) return "You cancelled the signature.";
  if (/no_wallet/.test(raw)) return "No wallet was found in this browser.";
  const watched = /already_watched:(\d+)/.exec(raw);
  if (watched) return `That page is already watched, as watch ${watched[1]}. Its owner can top that one up.`;
  if (/not_deployed/.test(raw)) return "This site is not pointed at a Standing contract yet.";
  if (/no_agreement/.test(raw)) return "The validators did not agree on this, so nothing was recorded.";
  if (/capture_not_found|watch_not_found|assessment_not_found/.test(raw)) {
    return "The transaction went through, but the new record could not be read back yet. Reload in a moment.";
  }
  if (/insufficient funds|insufficient balance/i.test(raw)) {
    return "This account does not hold enough GEN for the price and the fee deposit. The Get 100 GEN button at the top of the page adds test GEN.";
  }
  const quoted = /UserError\(?['"]?(.+?)['"]?\)?$/.exec(raw);
  const text = quoted ? quoted[1] : raw;
  if (!text) return "The transaction failed.";
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/\.?$/, ".");
}
