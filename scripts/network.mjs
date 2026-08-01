/**
 * Which GenLayer network the scripts talk to.
 *
 * Shared by deploy, check and tx so that a --network flag means the same thing
 * everywhere, and so that the name of the chain is printed by every one of them.
 * A contract address is meaningless without the network it lives on: reading a
 * Bradbury address against Asimov reports "contract not found", which is
 * indistinguishable from a failed deployment unless the tool says which chain
 * it just asked.
 */
import { studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

export const NETWORKS = {
  bradbury: testnetBradbury,
  asimov: testnetAsimov,
  studio: studionet,
};

export const NETWORK_NAMES = Object.keys(NETWORKS);

/**
 * Reads --network=NAME from argv, defaulting to bradbury.
 * Returns { name, chain, explorer, rpc } or throws a plain Error naming the
 * valid options — the callers all turn that into their own tidy message.
 */
export function pickNetwork(argv = process.argv) {
  const hit = argv.find((a) => a.startsWith("--network="));
  const name = hit ? hit.slice("--network=".length) : "bradbury";

  const chain = NETWORKS[name];
  if (!chain) {
    /* Exits rather than throwing. This runs at module load in all three
     * scripts, before any rpc connection exists, so there are no open handles
     * for process.exit to trip over — and a thrown error here surfaced as a
     * node stack trace burying the one line that says what to type instead. */
    console.error(`\n  Unknown --network=${name}`);
    console.error(`  Valid values: ${NETWORK_NAMES.join(", ")}\n`);
    process.exit(1);
  }

  return {
    name,
    chain,
    explorer: (chain.blockExplorers?.default?.url ?? "").replace(/\/?$/, "/"),
    rpc: chain.rpcUrls.default.http[0],
  };
}
