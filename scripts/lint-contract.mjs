/**
 * genvm-lint over the contract: the AST pass, then a load against the SDK.
 *
 *   npm run lint:contract
 *   node scripts/lint-contract.mjs path/to/other.py
 *
 * The contract runs on GenVM v0.6 (runtime 5jycge4q), which only genvm-linter
 * 0.11.1rc2 and later can load; 0.11.0 knows no release past v0.3.0-rc7. So
 * the linter in this repository's .venv is used when there is one:
 *
 *   python -m venv .venv
 *   .venv/Scripts/pip install genvm-linter==0.11.1rc2
 *
 * Wrapped rather than called directly, because three details turn a passing
 * contract into a failing one on this kind of machine:
 *
 *  1. The linter prints a tick character and dies on it under the cp1252
 *     stdout Windows gives a child process, so the child gets
 *     PYTHONIOENCODING=utf-8.
 *  2. It is never spawned through a shell. This repository lives under a
 *     directory with a space in its name, and a shell splits the path there.
 *  3. The linter picks the newest GenVM bundle in its cache. v0.6.0-rc5 is the
 *     bundle that ships runtime 5jycge4q, so it is pinned unless GENVM_VERSION
 *     is already set.
 *
 * `check` prints a green validation line even under a lint failure, so this
 * exits with the linter's own status and the first lines are the ones to read.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = process.argv[2] ?? join(HERE, "..", "contracts", "standing.py");
const LOCAL = join(HERE, "..", ".venv", ...(process.platform === "win32" ? ["Scripts", "genvm-lint.exe"] : ["bin", "genvm-lint"]));
const LINTER = existsSync(LOCAL) ? LOCAL : "genvm-lint";

const result = spawnSync(LINTER, ["check", CONTRACT], {
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8", GENVM_VERSION: process.env.GENVM_VERSION ?? "v0.6.0-rc5" },
  shell: false,
});

if (result.error) {
  console.error(`\n  Could not run genvm-lint: ${result.error.message}`);
  console.error("  Install it with:  python -m venv .venv && .venv/Scripts/pip install genvm-linter==0.11.1rc2\n");
  process.exit(1);
}

process.exit(result.status ?? 1);
