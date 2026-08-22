/**
 * Tests for the bulk classifier.
 *
 * Run:  node lib/bulk.test.mjs
 *
 * This is the rule that decides what each pasted line costs — a line read as a
 * page costs a full capture, one read as a contract costs a quarter of that,
 * and one read wrongly costs a transaction that fails after signing. Worth
 * exercising without a browser.
 *
 * The real source is compiled with the project's own TypeScript rather than
 * having its types stripped by hand. A first attempt did the latter and spent
 * its time debugging the stripper; worse, it would have been testing a mangled
 * copy rather than the module that ships.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = mkdtempSync(join(tmpdir(), "standing-bulk-"));

try {
  /* The compiler is invoked through node on tsc.js rather than through npx.
   * Spawning a .cmd shim without a shell fails with EINVAL on Windows, and
   * spawning it with one would mean quoting paths that contain spaces — which
   * this project's path does. */
  execFileSync(
    process.execPath,
    [
      join(ROOT, "node_modules", "typescript", "bin", "tsc"),
      join(HERE, "bulk.ts"),
      join(HERE, "format.ts"),
      "--outDir",
      OUT,
      "--module",
      "commonjs",
      "--target",
      "es2022",
      "--moduleResolution",
      "node",
      "--skipLibCheck",
    ],
    { cwd: ROOT, stdio: "pipe" }
  );
} catch (e) {
  console.error("could not compile lib/bulk.ts:\n" + (e.stdout ?? e).toString());
  process.exit(1);
}

/* Emitted as CommonJS and loaded with require, because tsc preserves the
 * extensionless "./format" import and Node's ESM resolver refuses that. CJS
 * resolves it the way the bundler does. */
const { classify, classifyAll } = createRequire(import.meta.url)(
  join(OUT, "bulk.js")
);

let passed = 0;
const failed = [];

function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else
    failed.push(
      `${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`
    );
}

// ---------- contract addresses ----------

check("a 40 hex address is a contract", classify("0x" + "a".repeat(40)).kind, "contract");
check("addresses are lowercased", classify("0x" + "A".repeat(40)).key, "0x" + "a".repeat(40));

// The one that would otherwise send someone hunting in the wrong place.
check("a short address is not called a bad url", classify("0xabc").kind, "bad");
check(
  "a short address says it is a bad address",
  /contract address/i.test(classify("0xabc").problem),
  true
);
check("a 41 hex address is refused", classify("0x" + "a".repeat(41)).kind, "bad");

// ---------- pages ----------

check("a bare host is a page", classify("example.com").kind, "page");
check("a scheme is added", classify("example.com").key, "https://example.com/");
check("http is kept", classify("http://example.com/x").key, "http://example.com/x");
check("the fragment is dropped", classify("example.com/a#frag").key, "https://example.com/a");
check("the query is kept", classify("example.com/a?b=1").key, "https://example.com/a?b=1");
check("the host is lowercased", classify("EXAMPLE.com/A").key, "https://example.com/A");

// ---------- refusals that mirror the contract ----------

check("localhost is refused", classify("localhost/x").kind, "bad");
check("a private range is refused", classify("10.0.0.1/x").kind, "bad");
check("172.16 is refused", classify("172.16.0.1/x").kind, "bad");
check("172.15 is allowed", classify("172.15.0.1/x").kind, "page");
check("a .local host is refused", classify("printer.local/x").kind, "bad");
check("a host with no dot is refused", classify("intranet/x").kind, "bad");
check("credentials are refused", classify("https://u:p@example.com").kind, "bad");
check("a non http scheme is refused", classify("ftp://example.com").kind, "bad");
check("gibberish is refused", classify("!!!").kind, "bad");

// ---------- duplicates ----------
//
// Matching is on the normalised key, so the same page written three ways is one
// page. That is the whole reason this is not a Set of raw strings.

const rows = classifyAll(
  ["example.com", "https://example.com", "EXAMPLE.com/", "other.com"].join("\n")
);
check("four lines in", rows.length, 4);
check("first is kept", rows[0].duplicate, false);
check("second is a duplicate despite different text", rows[1].duplicate, true);
check("third too", rows[2].duplicate, true);
check("a genuinely different page is not", rows[3].duplicate, false);

const mixed = classifyAll(
  ["0x" + "a".repeat(40), "0x" + "A".repeat(40), "example.com"].join("\n")
);
check("an address repeated in another case is a duplicate", mixed[1].duplicate, true);
check("a page after addresses is fine", mixed[2].duplicate, false);

check("blank lines are dropped", classifyAll("a.com\n\n  \nb.com").length, 2);

// A bad line is never a duplicate of another bad line: neither has a real key,
// and the screen must show each one its own reason.
const bads = classifyAll("!!!\n!!!");
check("two bad lines stay two bad lines", bads.filter((r) => r.duplicate).length, 0);

rmSync(OUT, { recursive: true, force: true });

console.log(`${passed} passed, ${failed.length} failed`);
for (const f of failed) console.log("  FAIL  " + f);
process.exitCode = failed.length ? 1 : 0;
