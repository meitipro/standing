/**
 * The browser and the contract must give the same answers.
 *
 *   npm test
 *
 * lib/url.ts refuses and normalises a url before anybody signs. If it
 * disagrees with `_check_url` by one character, the site either refuses a page
 * the contract would certify, or sends a url the contract stores under a
 * different key, and every lookup by that url then misses. lib/claims.ts
 * recomputes digests the verify page shows next to the chain's.
 *
 * Nothing here is written by hand. contracts/test_helpers.py --json prints the
 * Python half's answers and this file re-derives each of them from lib/.
 * Node strips types from .ts on import, so the real modules are under test.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_URL, REFUSALS, checkUrl } from "../../lib/url.ts";
import { claimsDigest, diffClaims } from "../../lib/claims.ts";
import { LIMITS, VERDICTS } from "../../lib/limits.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const REPORT = JSON.parse(
  execFileSync(
    process.platform === "win32" ? "python" : "python3",
    [join(ROOT, "contracts", "test_helpers.py"), "--json"],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  ),
);

test("the report covers enough urls to mean something", () => {
  assert.ok(REPORT.urls.length >= 50);
  assert.ok(REPORT.urls.some((row) => row.ok));
  assert.ok(new Set(REPORT.urls.map((row) => row.refusal).filter(Boolean)).size >= 7);
});

test("every url is accepted or refused exactly as the contract does", () => {
  for (const row of REPORT.urls) {
    const got = checkUrl(row.input);
    const label = JSON.stringify(row.input).slice(0, 80);
    if (row.ok) {
      assert.equal(got.ok, true, `${label} is refused here and accepted on chain`);
      assert.equal(got.url, row.url, `${label} normalises differently`);
    } else {
      assert.equal(got.ok, false, `${label} is accepted here and refused on chain`);
      assert.equal(got.refusal, row.refusal, `${label} is refused for a different reason`);
    }
  }
});

test("every refusal reads as the contract's own sentence", () => {
  for (const [name, message] of Object.entries(REPORT.refusals)) {
    assert.equal(REFUSALS[name], message, name);
  }
});

test("the claims digest matches the contract's", async () => {
  for (const row of REPORT.digests) {
    assert.equal(await claimsDigest(row.claims), row.digest, JSON.stringify(row.claims));
  }
});

test("the claim difference matches the contract's, in Python's order", () => {
  for (const row of REPORT.diffs) {
    assert.deepEqual(diffClaims(row.before, row.after), { gone: row.gone, fresh: row.fresh });
  }
});

test("the limits the screens enforce are the contract's", () => {
  assert.equal(MAX_URL, REPORT.limits.MAX_URL);
  const { MAX_URL: _url, ...rest } = REPORT.limits;
  assert.deepEqual({ ...LIMITS }, rest);
  assert.deepEqual([...VERDICTS], REPORT.verdicts);
});
