/**
 * Is the deployed contract this repository's contract?
 *
 *   npm run match -- 0xCONTRACT --network=studio
 *
 * Reads the deployed source back with gen_getContractCode, compares it with
 * contracts/standing.py, and runs genvm-lint over the deployed bytes, because
 * the deployment is what anyone reviewing it reads.
 *
 * Three outcomes, reported apart:
 *
 *   MATCH           byte for byte.
 *   COSMETIC ONLY   the same source once line endings and a final newline are
 *                   set aside. A web editor rewrites both, and neither is a
 *                   byte of what runs.
 *   DIFFERENT       the deployed contract is not this source. Redeploy, and
 *                   put the new address everywhere the old one is cited.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { pickNetwork } from "./network.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = join(HERE, "..", "contracts", "standing.py");
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

const net = pickNetwork();
const address = process.argv.slice(2).find((a) => /^0x[0-9a-fA-F]{40}$/.test(a));

const digest = (text) => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
const cosmetic = (text) => text.split(CR + LF).join(LF).replace(/\n$/, "");

async function deployedSource(attempts = 4) {
  for (let i = 1; ; i += 1) {
    try {
      const response = await fetch(net.rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_getContractCode", params: [address] }),
      });
      const body = await response.json();
      if (body.error) throw new Error(JSON.stringify(body.error).slice(0, 200));
      return Buffer.from(String(body.result), "base64").toString("utf8");
    } catch (e) {
      if (i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

if (!address) {
  console.error("\n  Usage: npm run match -- 0xCONTRACT --network=studio\n");
  process.exitCode = 1;
} else {
  const local = readFileSync(CONTRACT, "utf8");
  const deployed = await deployedSource();

  let outcome = "DIFFERENT";
  if (local === deployed) outcome = "MATCH";
  else if (cosmetic(local) === cosmetic(deployed)) outcome = "COSMETIC ONLY";

  console.log("");
  console.log(`  network   ${net.chain.name} [--network=${net.name}]`);
  console.log(`  local     ${local.length} chars  sha256 ${digest(local)}`);
  console.log(`  deployed  ${deployed.length} chars  sha256 ${digest(deployed)}`);
  console.log(`  outcome   ${outcome}`);

  if (outcome === "DIFFERENT") {
    const a = cosmetic(local).split(LF);
    const b = cosmetic(deployed).split(LF);
    const lines = [];
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) if (a[i] !== b[i]) lines.push(i + 1);
    console.log(`  differs   on ${lines.length} line${lines.length === 1 ? "" : "s"}, first at ${lines[0]}`);
    process.exitCode = 1;
  }

  const folder = mkdtempSync(join(tmpdir(), "standing-deployed-"));
  const copy = join(folder, "standing_deployed.py");
  writeFileSync(copy, deployed, "utf8");
  console.log("\n  genvm-lint over the deployed bytes:\n");
  const lint = spawnSync(process.execPath, [join(HERE, "lint-contract.mjs"), copy], { stdio: "inherit", shell: false });
  if (lint.status !== 0) process.exitCode = 1;

  console.log("");
  console.log("  Not proven here: that a capture works on this deployment. Notarize a page");
  console.log("  from the site, and read the transaction on the explorer.");
  console.log("");
}
