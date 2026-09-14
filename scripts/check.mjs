/**
 * House style, as a check that fails.
 *
 *   npm run check
 *
 * One connector, the spaced hyphen, and three periods for an ellipsis. Nine
 * characters are banned outright. Intending to remember has not worked, so
 * this runs as the first step of `npm test`.
 *
 * Two things to keep right if this is ever edited:
 *
 *  1. Every pattern is built from character codes. Written literally, this
 *     file would contain each character it bans and report itself.
 *  2. A character is caught in every form that renders as it: the character
 *     itself, a named or numeric HTML entity, and a JS or CSS escape. A source
 *     scan that only looks for the character passes an entity that the
 *     browser then draws.
 *
 * The replacements it names are substitutions, never deletions. Deleting a
 * character that carried meaning is how a truncated address once turned into
 * valid hex that read as a whole one.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath rather than .pathname: this repo lives under a directory with
   a space in its name, and the raw pathname keeps it percent-encoded. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const AMP = String.fromCharCode(38);
const SLASH = String.fromCharCode(92);

/** [code point, name, what to write instead, entity names that render it] */
const BANNED = [
  [0x2014, "em dash", " - ", ["mdash"]],
  [0x2013, "en dash", " - ", ["ndash"]],
  [0x2010, "hyphen", "-", ["hyphen", "dash"]],
  [0x2012, "figure dash", "-", []],
  [0x2015, "horizontal bar", "-", ["horbar"]],
  [0x2212, "minus sign", "-", ["minus"]],
  [0x00b7, "middle dot", " - ", ["middot", "centerdot", "CenterDot"]],
  [0x2022, "bullet", "-", ["bull", "bullet"]],
  [0x2026, "ellipsis", "...", ["hellip", "mldr"]],
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, (c) => SLASH + c);
}

/** Every spelling of one character that ends up on screen as that character. */
function patternFor(code, entities) {
  const hex = code.toString(16);
  const four = hex.padStart(4, "0");
  const exact = [String.fromCodePoint(code), ...entities.map((name) => AMP + name + ";")];
  const loose = [
    AMP + "#" + code + ";",
    AMP + "#x0*" + hex + ";",
    SLASH + SLASH + "u" + four,
    SLASH + SLASH + "u\\{0*" + hex + "\\}",
    SLASH + SLASH + "0*" + hex + "(?![0-9a-f])",
  ];
  if (code < 0x100) loose.push(SLASH + SLASH + "x" + hex);
  const exactPart = exact.map(escapeRegExp).join("|");
  return {
    exact: new RegExp(exactPart, "g"),
    loose: new RegExp(loose.map((p) => p.replace(AMP + "#", escapeRegExp(AMP + "#"))).join("|"), "gi"),
  };
}

const PATTERNS = BANNED.map(([code, name, instead, entities]) => ({ name, instead, ...patternFor(code, entities) }));

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "build", "__pycache__", ".vercel"]);
const SKIP_FILES = new Set(["package-lock.json"]);
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".py", ".md", ".json", ".html", ".svg", ".txt", ".yml", ".yaml"];
const DOTFILES = new Set([".env.example", ".gitignore", ".gitattributes"]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry) && !entry.startsWith(".")) yield* walk(full);
      continue;
    }
    if (SKIP_FILES.has(entry)) continue;
    if (DOTFILES.has(entry) || (!entry.startsWith(".") && EXTENSIONS.some((ext) => entry.endsWith(ext)))) {
      yield full;
    }
  }
}

let files = 0;
const byFile = new Map();

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join("/");
  files += 1;
  const source = readFileSync(file, "utf8");
  for (const { name, exact, loose } of PATTERNS) {
    for (const re of [exact, loose]) {
      for (const match of source.matchAll(re)) {
        const line = source.slice(0, match.index).split("\n").length;
        if (!byFile.has(rel)) byFile.set(rel, []);
        byFile.get(rel).push({ name, line });
      }
    }
  }
}

if (byFile.size === 0) {
  console.log(`clean  (${BANNED.length} characters, as characters, entities and escapes, across ${files} files)`);
  process.exit(0);
}

const total = [...byFile.values()].reduce((n, list) => n + list.length, 0);
console.error(`${total} banned characters in ${byFile.size} files:\n`);
for (const [rel, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  const counts = new Map();
  for (const hit of list) counts.set(hit.name, (counts.get(hit.name) ?? 0) + 1);
  const summary = [...counts].map(([name, n]) => `${n} ${name}${n > 1 ? "s" : ""}`).join(", ");
  console.error(`  ${rel}  ${summary}  (first at line ${Math.min(...list.map((h) => h.line))})`);
}
console.error("\nThe connector is a spaced hyphen. The ellipsis is three periods.");
process.exit(1);
