"""
Loads the real contracts/standing.py against the double in genvm_double.py.

Nothing is copied or re-implemented: a change to the contract is a change to
what these tests run. The Depends comment on line one is a runner declaration
that CPython ignores, so the file imports as ordinary Python.
"""

from __future__ import annotations

import datetime
import importlib.util
import json
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CONTRACT = ROOT / "contracts" / "standing.py"

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18
FEE = 4 * GEN // 10


def load(gl: D.GL) -> types.ModuleType:
    """
    Publish a `genlayer` package shaped like runtime 5jycge4q, which Studio Next
    runs: the package itself is `gl`, the star import brings Address and the
    integer types, and the storage names live in genlayer.storage. An import
    the contract makes that this runtime lacks fails here, not on chain.
    """
    storage = types.ModuleType("genlayer.storage")
    storage.DynArray = D.DynArray
    storage.TreeMap = D.TreeMap
    storage.allow = D.allow_storage
    module = types.ModuleType("genlayer")
    for name in ("vm", "public", "message", "nondet", "contract"):
        setattr(module, name, getattr(gl, name))
    module.storage = storage
    module.Address = D.Address
    module.u8 = D.u8
    module.u32 = D.u32
    module.u64 = D.u64
    module.u256 = D.u256
    module.__all__ = ["Address", "u8", "u32", "u64", "u256"]
    sys.modules["genlayer"] = module
    sys.modules["genlayer.storage"] = storage
    spec = importlib.util.spec_from_file_location("standing_under_test", CONTRACT)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


class _Fake:
    """Another contract, reduced to the zero-argument views it answers."""

    def __init__(self, views: dict) -> None:
        for name, value in views.items():
            setattr(self, name, (lambda v: (lambda: v))(value))


class World:
    """
    One Standing contract, five nodes, and the accounts around them.

    Time is explicit: at() and advance() set the transaction datetime the
    contract reads, because nothing on chain moves it on its own and a watch's
    cadence is the thing most worth controlling.
    """

    OWNER = "0x" + "a1" * 20
    ALICE = "0x" + "b2" * 20
    BOB = "0x" + "c3" * 20
    KEEPER = "0x" + "d4" * 20
    SELF = "0x" + "e5" * 20
    #: Mixed case on purpose: a snapshot's url must keep the casing it was given.
    OTHER = "0x" + "F6" * 20
    THIRD = "0x" + "9a" * 20

    def __init__(self, validators: int = 4, fee: int = FEE) -> None:
        self.gl = D.GL(nodes=validators + 1)
        self.m = load(self.gl)
        self.gl.message.contract_address = D.Address(self.SELF)
        self.at("2026-09-15T10:00:00")
        self.act(self.OWNER)
        self.c = self.m.Standing(fee)

    # -- controls -----------------------------------------------------------

    def at(self, stamp: str) -> "World":
        self.now = stamp
        self.gl.message_raw["datetime"] = stamp + "Z"
        return self

    def advance(self, hours: int) -> "World":
        moved = datetime.datetime.fromisoformat(self.now) + datetime.timedelta(hours=hours)
        return self.at(moved.isoformat()[:19])

    def act(self, who: str, value: int = 0) -> None:
        self.gl.message.sender_address = D.Address(who)
        self.gl.message.origin_address = D.Address(who)
        self.gl.message.value = value

    def call(self, method: str, *args, who: str | None = None, value: int = 0):
        self.act(who or self.OWNER, value)
        return getattr(self.c, method)(*args)

    def refusal(self, method: str, *args, who: str | None = None, value: int = 0) -> str:
        try:
            self.call(method, *args, who=who, value=value)
        except D.UserError as error:
            return error.data
        raise AssertionError(f"{method}{args} was expected to refuse and did not")

    def view(self, method: str, *args):
        return json.loads(getattr(self.c, method)(*args))

    # -- the world each node sees ---------------------------------------------

    @staticmethod
    def text_for(claims: list, node: int) -> str:
        """Each node's copy differs, the way two fetches of a live page do."""
        body = " ".join(claim.capitalize() + "." for claim in claims)
        return f"Terms as served to node {node}. {body} Sponsored slot {node * 7}."

    def page(
        self,
        url: str,
        claims: list,
        *,
        match: object = True,
        text: str | None = None,
        status: int = 200,
        nodes=None,
        facts: list | None = None,
    ) -> None:
        """Give each named node its own copy of a page, and its model's reading of it."""
        indexes = range(len(self.gl.nodes)) if nodes is None else nodes
        for index in indexes:
            body = text if text is not None else self.text_for(claims, index)
            node = self.gl.nodes[index]
            node.pages[url] = D.Page(status=status, text=body, shot=b"png:" + bytes([index]))
            key = self.m._fence(body[: self.m.TEXT_WINDOW])
            node.model.extractions[key] = (list(claims), match)
            known = facts if facts is not None else claims
            node.model.facts[key] = {self.m._fence(self.m._normalise_claims([c])[0]) for c in known}

    def judge(self, fn, nodes=None) -> None:
        indexes = range(len(self.gl.nodes)) if nodes is None else nodes
        for index in indexes:
            self.gl.nodes[index].model.judge = fn

    def deploy_other(self, address: str, views: dict) -> None:
        self.gl.bus.contracts[address.lower()] = _Fake(views)

    def prompts(self, node: int, marker: str) -> list:
        return [p for p in self.gl.nodes[node].model.prompts if marker in p]
