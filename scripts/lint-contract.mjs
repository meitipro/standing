/**
 * genvm-lint over the contract: the AST pass, then a load against the SDK.
 *
 *   npm run lint:contract
 *   node scripts/lint-contract.mjs path/to/other.py
 *
 * Wrapped rather than called directly, because three details turn a passing
 * contract into a failing one on this kind of machine:
 *
 *  1. The linter prints a tick character and dies on it under the cp1252
 *     stdout Windows gives a child process, so the child gets
 *     PYTHONIOENCODING=utf-8.
 *  2. It is never spawned through a shell. This repository lives under a
 *     directory with a space in its name, and a shell splits the path there.
 *  3. The linter picks the newest GenVM bundle in its cache. Once any project
 *     has fetched a later bundle, loading a contract pinned to this runtime
 *     fails with a missing-file error. The bundle that ships this runtime is
 *     pinned unless GENVM_VERSION is already set.
 *
 * `check` prints a green validation line even under a lint failure, so this
 * exits with the linter's own status and the first lines are the ones to read.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = process.argv[2] ?? join(HERE, "..", "contracts", "standing.py");

const result = spawnSync("genvm-lint", ["check", CONTRACT], {
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8", GENVM_VERSION: process.env.GENVM_VERSION ?? "v0.3.0-rc7" },
  shell: false,
});

if (result.error) {
  console.error(`\n  Could not run genvm-lint: ${result.error.message}\n  Install it with:  pip install genvm-linter\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
