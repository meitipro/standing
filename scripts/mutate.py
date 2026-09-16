#!/usr/bin/env python3
"""
Break each defence in contracts/standing.py on purpose, and check the suite
goes red.

    python scripts/mutate.py
    python scripts/mutate.py --table docs/MUTATIONS.md

A green suite says the tests agree with the code. It does not say they would
notice the code being wrong, and only the second is worth quoting. So this
deletes or loosens one guard at a time, runs the suite against each mutant, and
names the first test that failed. A mutant nothing catches is an escape, and an
escape is a finding: a missing test, or a later guard strict enough that an
earlier test can no longer fail.

The table is not written when anything escapes. A document listing defences
nobody verified reads as coverage and is worse than no document.

Nothing here edits the repository. The contract and the tests are copied to a
scratch directory and mutated there. The contract is read and written as
bytes, because text mode on Windows turns every LF into CRLF.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def lit(text: str) -> str:
    """Contract snippets that contain a backslash-n are written here with ~n~."""
    return text.replace("~n~", "\\" + "n")


#: (what is being broken, the code as it is, what it becomes). Each is a bug
#: somebody could plausibly ship, not a syntactic mangling.
MUTANTS = [
    # -- what reaches the chain from a capture --------------------------------
    ("a validator agrees without checking the claims",
     "            return _all_confirmed(answer, len(claims))",
     "            return True"),
    ("a missing confirmation counts as yes",
     '        if str(answer.get("c" + str(number), "")).strip().lower() != "yes":',
     '        if str(answer.get("c" + str(number), "")).strip().lower() == "no":'),
    ("a validator ignores its own image check",
     '    if theirs["match"] != my_match:\n        return None',
     '    if False:\n        return None'),
    ("a proposal need not be normalised",
     "    if _normalise_claims(claims) != claims or len(claims) < MIN_CLAIMS:",
     "    if len(claims) < MIN_CLAIMS:"),
    ("a proposal of one claim is enough",
     "    if _normalise_claims(claims) != claims or len(claims) < MIN_CLAIMS:",
     "    if _normalise_claims(claims) != claims:"),
    ("a validator trusts the leader's refusal instead of reading the page",
     "            text, shot = _read_page(target)\n            mine = _extract(text, shot)\n"
     "            if not isinstance(leader_res, gl.vm.Return):\n                return False",
     "            if not isinstance(leader_res, gl.vm.Return):\n                return False\n"
     "            text, shot = _read_page(target)\n            mine = _extract(text, shot)"),
    ("cloaking is stored inverted",
     lit('    return res["claims"].split("~n~"), res["match"] == "no"'),
     lit('    return res["claims"].split("~n~"), res["match"] == "yes"')),
    ("an unreadable image check counts as a match",
     '    if raw is False or str(raw).strip().lower() in ("false", "no"):\n        return "no"\n'
     "    raise gl.vm.UserError(R_MODEL)",
     '    return "yes"'),
    # -- the prompt boundary --------------------------------------------------
    ("the fence does nothing",
     '    return str(raw).replace("<", "(").replace(">", ")")',
     "    return str(raw)"),
    ("the page reaches the extraction prompt unfenced",
     lit('        f"<page>~n~{_fence(text)}~n~</page>~n~~n~"\n        "List the factual'),
     lit('        f"<page>~n~{text}~n~</page>~n~~n~"\n        "List the factual')),
    ("the page reaches the check prompt unfenced",
     lit('        f"<page>~n~{_fence(text)}~n~</page>~n~~n~"\n        "For each claim id'),
     lit('        f"<page>~n~{text}~n~</page>~n~~n~"\n        "For each claim id')),
    ("numbered lines reach the model unfenced",
     '        text = _fence(" ".join(str(item).split()))',
     '        text = " ".join(str(item).split())'),
    # -- the judgment ---------------------------------------------------------
    ("only one presentation order is asked",
     '            reverse = gl.nondet.exec_prompt(_assess_prompt(earlier, later, True), response_format="json")',
     "            reverse = forward"),
    ("the orders' disagreement is forgiven",
     "    if forward == reverse and forward[0] != UNCLEAR:",
     "    if forward[0] != UNCLEAR:"),
    ("a judgment agrees on the verdict alone",
     '    return _flat(theirs, ("verdict", "lines")) and theirs == mine',
     '    return _flat(theirs, ("verdict", "lines")) and theirs["verdict"] == mine["verdict"]'),
    ("a line id outside the question is accepted",
     '        if number < 1 or number > count:\n            return (UNCLEAR, "")',
     '        if number < 1:\n            return (UNCLEAR, "")'),
    ("a material verdict needs no line",
     '    if len(picked) == 0:\n        return (UNCLEAR, "")',
     '    if False:\n        return (UNCLEAR, "")'),
    ("a question is filed by its pair, so it can be asked again",
     "        question = _question_digest(a.url, gone, fresh)",
     "        question = _question_digest(a.url, [str(cert_a)], [str(cert_b)])"),
    ("identical captures are judged",
     "        if len(gone) == 0 and len(fresh) == 0:\n            raise gl.vm.UserError(R_IDENTICAL)",
     "        if False:\n            raise gl.vm.UserError(R_IDENTICAL)"),
    ("a later certificate may come first",
     "        if cert_a > cert_b:\n            raise gl.vm.UserError(R_ORDER)",
     "        if False:\n            raise gl.vm.UserError(R_ORDER)"),
    ("two different pages can be compared",
     "        if a.url != b.url:\n            raise gl.vm.UserError(R_OTHER_PAGE)",
     "        if False:\n            raise gl.vm.UserError(R_OTHER_PAGE)"),
    # -- prices ---------------------------------------------------------------
    ("the capture price is not checked",
     "        self._require_price(int(self.fee))\n        claims, cloaking = self._capture(target)",
     "        claims, cloaking = self._capture(target)"),
    ("a price only has to be at least right",
     "        if int(gl.message.value) != int(price):",
     "        if int(gl.message.value) < int(price):"),
    ("the snapshot price is not checked",
     "        self._require_price(int(self.fee) // SNAPSHOT_DIVISOR * len(targets))",
     "        pass"),
    ("the assessment price is not checked",
     "        self._require_price(int(self.fee) // ASSESS_DIVISOR)",
     "        pass"),
    ("the constructor takes any fee",
     "    def __init__(self, fee: u256):\n        if fee < MIN_FEE:",
     "    def __init__(self, fee: u256):\n        if False:"),
    # -- watches --------------------------------------------------------------
    ("anyone may top up a watch",
     "        if gl.message.sender_address != w.owner:\n            raise gl.vm.UserError(R_WATCH_OWNER)\n"
     "        if not w.active:\n            raise gl.vm.UserError(R_CLOSED)\n        unit = int(w.unit)",
     "        if not w.active:\n            raise gl.vm.UserError(R_CLOSED)\n        unit = int(w.unit)"),
    ("anyone may close a watch",
     "        if gl.message.sender_address != w.owner:\n            raise gl.vm.UserError(R_WATCH_OWNER)\n"
     "        if not w.active:\n            raise gl.vm.UserError(R_CLOSED)\n        refund = int(w.held)",
     "        if not w.active:\n            raise gl.vm.UserError(R_CLOSED)\n        refund = int(w.held)"),
    ("a capture is taken before it is due",
     "        if w.last_checked != \"\" and now < _plus_hours(w.last_checked, int(w.cadence_hours)):",
     "        if False:"),
    ("an empty watch is captured anyway",
     "        if int(w.held) < unit:\n            raise gl.vm.UserError(R_EMPTY)",
     "        if False:\n            raise gl.vm.UserError(R_EMPTY)"),
    ("a closed watch is captured",
     "        if not w.active:\n            raise gl.vm.UserError(R_CLOSED)\n        unit = int(w.unit)\n        if int(w.held) < unit:",
     "        unit = int(w.unit)\n        if int(w.held) < unit:"),
    ("a capture spends the current fee rather than the watch's price",
     "        unit = int(w.unit)\n        if int(w.held) < unit:",
     "        unit = int(self.fee)\n        if int(w.held) < unit:"),
    ("a watched page can be watched twice",
     "        if existing != NONE and self.watches[existing].active:",
     "        if False:"),
    ("a watch can open short of the minimum",
     "        if value // unit < MIN_WATCH_CAPTURES:",
     "        if value // unit < 1:"),
    ("a top-up can overfill a watch",
     "        if held // unit > MAX_WATCH_CAPTURES:\n            raise gl.vm.UserError(R_WATCH_MAX)",
     "        if False:\n            raise gl.vm.UserError(R_WATCH_MAX)"),
    ("a close refunds nothing",
     "        if refund > 0:\n            self._pay(w.owner, refund)",
     "        if False:\n            self._pay(w.owner, refund)"),
    ("a watch's chain of captures breaks",
     "            self.certs[w.last_cert].watch_next = u256(cert_id)",
     "            pass"),
    # -- governance and records -----------------------------------------------
    ("the owner check does nothing",
     "        if gl.message.sender_address != self.owner:\n            raise gl.vm.UserError(R_OWNER)",
     "        if False:\n            raise gl.vm.UserError(R_OWNER)"),
    ("a withdrawal reaches the prepay",
     "        amount = int(self.fees_accrued)",
     "        amount = int(self.fees_accrued) + int(self.prepaid_held)"),
    ("a snapshot view that fails is skipped",
     "                except Exception:\n                    raise gl.vm.UserError(R_METHOD_READ)",
     "                except Exception:\n                    continue"),
    ("the digest index keeps the newest certificate",
     "        if digest not in self.cert_of_digest:",
     "        if True:"),
    ("a page's history loses its link",
     "                url_prev=previous,",
     "                url_prev=u256(NONE),"),
    ("a snapshot's address is lowercased",
     "    return CONTRACT_SCHEME + target.as_hex",
     "    return CONTRACT_SCHEME + target.as_hex.lower()"),
    # -- the url guard --------------------------------------------------------
    ("a private prefix is fetched",
     "    if host in BLOCKED_HOSTS or host.startswith(BLOCKED_PREFIXES):",
     "    if host in BLOCKED_HOSTS:"),
    ("the private 172 range ends early",
     "    return 16 <= int(piece[1]) <= 31",
     "    return 16 <= int(piece[1]) <= 30"),
    ("a non-ascii url is read",
     '    if not all("!" <= ch <= "~" for ch in raw):',
     "    if False:"),
    ("an empty path is kept empty",
     '    path = parts.path if parts.path != "" else "/"',
     "    path = parts.path"),
]


def first_failure(output: str) -> str:
    """The test a run failed on, named the way the report names it."""
    match = re.search(r"^(FAIL|ERROR): (\w+) \(([\w.]+)\)", output, re.MULTILINE)
    if match:
        return f"{match.group(3).rsplit('.', 1)[0]}.{match.group(2)}"
    match = re.search(r"^   x (.+)$", output, re.MULTILINE)
    if match:
        return f"test_helpers: {match.group(1).strip()}"
    return ""


def run_suite(work: pathlib.Path) -> tuple[int, str]:
    direct = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", "tests/direct"],
        cwd=work, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if direct.returncode != 0:
        return direct.returncode, direct.stdout + direct.stderr
    helpers = subprocess.run(
        [sys.executable, "contracts/test_helpers.py"],
        cwd=work, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return helpers.returncode, helpers.stdout + helpers.stderr


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", default="", help="write a markdown table to this path")
    args = parser.parse_args()

    work = pathlib.Path(tempfile.mkdtemp(prefix="standing-mutate-"))
    try:
        for folder in ("contracts", "tests"):
            shutil.copytree(ROOT / folder, work / folder, ignore=shutil.ignore_patterns("__pycache__"))
        target = work / "contracts" / "standing.py"
        original = target.read_bytes()

        code, output = run_suite(work)
        if code != 0:
            print("The suite does not pass before any mutation, so nothing below would mean")
            print("anything. Fix that first.\n")
            print(output[-2000:])
            return 1
        print("baseline green\n")

        rows = []
        escaped = []
        for label, old, new in MUTANTS:
            source = original.decode("utf-8")
            if source.count(old) != 1:
                print(f"  stale mutant, its code is not in the contract exactly once: {label}")
                return 1
            target.write_bytes(source.replace(old, new).encode("utf-8"))
            code, output = run_suite(work)
            caught = first_failure(output) if code != 0 else ""
            if code != 0 and not caught:
                # Red with no named test is a crash, not a catch. Scoring it as
                # a kill is how a runner reports a perfect score testing nothing.
                print(f"  CRASH   {label}\n{output[-800:]}")
                return 1
            if caught:
                rows.append((label, caught))
                print(f"  caught  {label}\n          by {caught}")
            else:
                escaped.append(label)
                print(f"  ESCAPED {label}")
        target.write_bytes(original)

        print(f"\n{len(rows)} of {len(MUTANTS)} mutants caught")
        if escaped:
            print("\nEscapes are findings. No table was written.")
            return 1

        if args.table:
            lines = [
                "# Mutations",
                "",
                "Generated by `python scripts/mutate.py --table docs/MUTATIONS.md`. Each row",
                "is one guard in `contracts/standing.py` deleted or loosened on purpose, and",
                "the first test that failed because of it. The generator writes this file",
                "only when every mutant is caught.",
                "",
                f"**{len(rows)} of {len(MUTANTS)} caught.**",
                "",
                "| What was broken | Caught by |",
                "| --- | --- |",
            ]
            lines += [f"| {label} | `{caught}` |" for label, caught in rows]
            out = ROOT / args.table
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(("\n".join(lines) + "\n").encode("utf-8"))
            print(f"wrote {args.table}")
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
