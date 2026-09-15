/**
 * The GenLayer network the scripts talk to: Studio Next.
 *
 * Shared by deploy, verify, match and tx, so the chain is named the same way
 * everywhere and printed by every one of them. A contract address means
 * nothing without its network: an address read against the wrong chain
 * reports "contract not found", which looks exactly like a failed deployment
 * unless the tool says which chain it just asked.
 *
 * Studio Next is the SDK's studioDevnet: studio-next.genlayer.com and
 * studio-dev.genlayer.com are one network, chain 61997. The organisers name
 * the first, so its RPC is pinned here, and so is the explorer, which the SDK
 * leaves unset for this network. lib/chain.ts pins the same two.
 */
import { studioDevnet } from "genlayer-js/chains";

const STUDIO_NEXT = {
  ...studioDevnet,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } },
};

export const NETWORKS = { "studio-next": STUDIO_NEXT };

const EXPLORERS = { "studio-next": "https://explorer-studio-dev.genlayer.com/" };

export const NETWORK_NAMES = Object.keys(NETWORKS);

/**
 * Reads --network=NAME from argv, defaulting to studio-next.
 * Returns { name, chain, explorer, rpc }.
 */
export function pickNetwork(argv = process.argv) {
  const hit = argv.find((a) => a.startsWith("--network="));
  const name = hit ? hit.slice("--network=".length) : "studio-next";

  const chain = NETWORKS[name];
  if (!chain) {
    /* Exits rather than throwing. This runs at module load in every script,
     * before any rpc connection exists, so there are no open handles for
     * process.exit to trip over, and a thrown error here surfaced as a node
     * stack trace burying the one line that says what to type instead. */
    console.error(`\n  Unknown --network=${name}`);
    console.error(`  Valid values: ${NETWORK_NAMES.join(", ")}\n`);
    process.exit(1);
  }

  return { name, chain, explorer: EXPLORERS[name], rpc: chain.rpcUrls.default.http[0] };
}
