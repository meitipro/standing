"""Tests for the deterministic helpers in standing.py.

These four functions decide what gets refused before payment, what two nodes
compare when they agree, and when a watch is due. They are pure functions of
their arguments, so they can be exercised on a normal Python without GenVM.

Run:  python contracts/test_helpers.py
"""

import importlib.util
import pathlib
import sys
import types


def _install_genlayer_stub() -> None:
    """The smallest fake genlayer that lets standing.py import.

    Only the module level helpers are under test. Everything the contract class
    body needs is stubbed just well enough for the import to complete.
    """
    gl = types.ModuleType("genlayer")

    class UserError(Exception):
        def __init__(self, message: str):
            self.message = message
            super().__init__(message)

    vm = types.SimpleNamespace(UserError=UserError, Return=object, run_nondet=None)

    class _Anything:
        def __call__(self, *a, **k):
            return self

        def __getattr__(self, _name):
            return self

    class Event:
        def emit(self):
            pass

    glns = types.SimpleNamespace(
        vm=vm,
        Event=Event,
        Contract=object,
        public=_Anything(),
        nondet=_Anything(),
        message=_Anything(),
        message_raw={},
        get_contract_at=_Anything(),
    )

    class _Generic:
        def __class_getitem__(cls, _item):
            return cls

    class DynArray(list, _Generic):
        pass

    class TreeMap(dict, _Generic):
        pass

    gl.gl = glns
    gl.Address = str
    gl.u256 = int
    gl.i64 = int
    gl.DynArray = DynArray
    gl.TreeMap = TreeMap
    gl.allow_storage = lambda c: c
    gl.__all__ = [
        "gl",
        "Address",
        "u256",
        "i64",
        "DynArray",
        "TreeMap",
        "allow_storage",
    ]
    sys.modules["genlayer"] = gl


_install_genlayer_stub()

_spec = importlib.util.spec_from_file_location(
    "standing", pathlib.Path(__file__).with_name("standing.py")
)
standing = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(standing)

UserError = sys.modules["genlayer"].gl.vm.UserError

PASSED = 0
FAILED = []


def check(label, got, want):
    global PASSED
    if got == want:
        PASSED += 1
    else:
        FAILED.append(f"{label}\n      got  {got!r}\n      want {want!r}")


def check_refused(label, url):
    global PASSED
    try:
        got = standing._check_url(url)
        FAILED.append(f"{label}\n      accepted {url!r} as {got!r}, expected refusal")
    except UserError:
        PASSED += 1


# ---------- _check_url ----------

check(
    "keeps a plain page",
    standing._check_url("https://example.xyz/tokenomics"),
    "https://example.xyz/tokenomics",
)
check(
    "adds the root path",
    standing._check_url("https://example.xyz"),
    "https://example.xyz/",
)
check(
    "keeps the query, which changes what the server returns",
    standing._check_url("https://example.xyz/docs?v=2"),
    "https://example.xyz/docs?v=2",
)
check(
    "drops the fragment, which never reaches the server",
    standing._check_url("https://example.xyz/terms#refunds"),
    "https://example.xyz/terms",
)
check(
    "lowercases the host but not the path",
    standing._check_url("https://Example.XYZ/Token_Sale"),
    "https://example.xyz/Token_Sale",
)
check(
    "trims surrounding space",
    standing._check_url("  https://example.xyz/a  "),
    "https://example.xyz/a",
)

check_refused("refuses ftp", "ftp://example.xyz/a")
check_refused("refuses a bare host with no scheme", "example.xyz/a")
check_refused("refuses javascript", "javascript:alert(1)")
check_refused("refuses file", "file:///etc/passwd")
check_refused("refuses empty", "   ")
check_refused("refuses credentials in the url", "https://user:pw@example.xyz/a")
check_refused("refuses localhost", "http://localhost:8080/admin")
check_refused("refuses loopback", "http://127.0.0.1/admin")
check_refused("refuses the cloud metadata address", "http://169.254.169.254/latest/meta-data/")
check_refused("refuses a 10. address", "http://10.0.0.5/internal")
check_refused("refuses a 192.168. address", "http://192.168.1.1/router")
check_refused("refuses 172.16, the low end of the private range", "http://172.16.0.1/x")
check_refused("refuses 172.31, the high end of the private range", "http://172.31.255.254/x")
check_refused("refuses a .internal name", "http://db.internal/health")
check_refused("refuses a hostless url", "https:///path")
check_refused("refuses a url past the length cap", "https://example.xyz/" + "a" * 3000)

# 172.32 is public. Refusing it would be a silent false negative that only
# shows up as a support ticket, so it is pinned here.
check(
    "allows 172.32, which is outside the private range",
    standing._check_url("http://172.32.0.1/x"),
    "http://172.32.0.1/x",
)

# ---------- _normalise_claims ----------

check(
    "lowercases, collapses space and sorts",
    standing._normalise_claims(["  Cliff  is 12   MONTHS ", "Team allocation is 12 percent"]),
    ["cliff is 12 months", "team allocation is 12 percent"],
)
check(
    "a trailing full stop is not a disagreement",
    standing._normalise_claims(["fee is 2.5 percent."]),
    standing._normalise_claims(["Fee is 2.5 percent"]),
)
check(
    "drops duplicates that differ only in case",
    standing._normalise_claims(["Cliff is 12 months", "cliff is 12 months"]),
    ["cliff is 12 months"],
)
check("drops blanks", standing._normalise_claims(["", "   ", "a real claim"]), ["a real claim"])
check(
    "caps a claim at fifteen words",
    len(standing._normalise_claims(["word " * 40])[0].split(" ")),
    15,
)
check("caps the list at eight", len(standing._normalise_claims([f"claim {i}" for i in range(30)])), 8)

# The cap must fall on the model's order, then sort. Cutting after the sort
# would keep whatever started with an early letter and silently drop the rest.
_ordered = ["zebra claim", "yak claim", "xenon claim"] + [f"alpha {i}" for i in range(9)]
check(
    "cuts in the model's order, not alphabetically",
    "zebra claim" in standing._normalise_claims(_ordered),
    True,
)

check("survives a non string", standing._normalise_claims([123, None]), ["123", "none"])

# ---------- _plus_hours ----------

check("adds hours", standing._plus_hours("2026-07-21T14:02:07", 24), "2026-07-22T14:02:07")
check("rolls the month", standing._plus_hours("2026-07-31T23:00:00", 2), "2026-08-01T01:00:00")
check("stays 19 chars", len(standing._plus_hours("2026-07-21T14:02:07", 1)), 19)

# String comparison decides whether a watch is due, so the format has to keep
# string order and time order pointing the same way.
check(
    "string order matches time order",
    standing._plus_hours("2026-07-21T14:02:07", 1) > "2026-07-21T14:02:07",
    True,
)

# ---------- _is_private_172 ----------

check("172.15 is public", standing._is_private_172("172.15.0.1"), False)
check("172.16 is private", standing._is_private_172("172.16.0.1"), True)
check("172.31 is private", standing._is_private_172("172.31.0.1"), True)
check("172.32 is public", standing._is_private_172("172.32.0.1"), False)
check("a name that merely starts with 172 is not an address", standing._is_private_172("172.example.xyz"), False)

# ---------- _clean_verdict ----------

check("the three pass through", standing._clean_verdict("material"), "material")
check("case and space are forgiven", standing._clean_verdict("  Reworded "), "reworded")
check("cosmetic maps to reworded", standing._clean_verdict("cosmetic"), "reworded")
check("substantive maps to material", standing._clean_verdict("substantive"), "material")
check("identical maps to unchanged", standing._clean_verdict("identical"), "unchanged")

# The important one. A verdict outside the three must raise rather than default,
# because a silent fallback would render an invented finding as a real one.
try:
    standing._clean_verdict("probably fine")
    check("an unknown verdict raises", False, True)
except Exception:
    check("an unknown verdict raises", True, True)

try:
    standing._clean_verdict("")
    check("an empty verdict raises", False, True)
except Exception:
    check("an empty verdict raises", True, True)

# ---------- _clean_changes ----------

check(
    "collapses, trims and sorts",
    standing._clean_changes(["  b was 2, now 3 ", "a was 1, now 2."]),
    ["a was 1, now 2", "b was 2, now 3"],
)
check("drops empties", standing._clean_changes(["", "   ", "real change"]), ["real change"])
check(
    "dedupes case insensitively",
    standing._clean_changes(["Fee was 1, now 5", "fee was 1, now 5"]),
    ["Fee was 1, now 5"],
)
check(
    "caps the count",
    len(standing._clean_changes(["change " + str(i) for i in range(20)])),
    standing.MAX_CHANGES,
)
check(
    "caps the length",
    len(standing._clean_changes(["x" * 500])[0]),
    standing.MAX_CHANGE_CHARS,
)

# ---------- _tokens ----------
#
# This decides whether two validators are pointing at the same edit, so it has
# to survive different prose about the same numbers.

check(
    "two phrasings of one edit share their values",
    len(
        standing._tokens(["team unlock was 24 months, now 36 months"])
        & standing._tokens(["the team unlock moved from 24 to 36 months"])
    )
    > 0,
    True,
)
check("short filler is dropped", "the" in standing._tokens(["the fee"]), False)
check("digits survive even when short", "24" in standing._tokens(["was 24"]), True)
check(
    "two unrelated edits do not overlap",
    standing._tokens(["fee was 1 percent, now 5 percent"])
    & standing._tokens(["headquarters moved to berlin"]),
    set(),
)

# ---------- _pair_key ----------

check("pair key is stable", standing._pair_key(3, 9), "3:9")
check("pair key is ordered, not a set", standing._pair_key(9, 3), "9:3")

# ---------- _clean_summary ----------

check("summary collapses whitespace", standing._clean_summary("  a   b \n c "), "a b c")
check("summary is capped", len(standing._clean_summary("x" * 999)), standing.MAX_SUMMARY)

# ---------- report ----------

print(f"{PASSED} passed, {len(FAILED)} failed")
for f in FAILED:
    print("  FAIL  " + f)
sys.exit(1 if FAILED else 0)
