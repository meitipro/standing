"""
A stand-in for the parts of genlayer that contracts/standing.py touches.

What it proves: the contract's own logic. Which guard fires first, what each
method writes, how a validator decides, and what text reaches the model.

What it does not prove: anything about GenVM itself. Storage here is plain
Python, so slot layout, calldata encoding and gas are out of its reach.
genvm-lint's validate step and a deployment cover those.

Two things it models on purpose, because a thinner double passes contracts a
network fails:

  Each node has its own world. The leader and every validator read their own
  copy of a page and ask their own model, so a contract that assumes every
  node sees identical bytes fails here the way it would on chain.

  run_nondet behaves as runtime 5jycge4q's does. The validator is handed the
  leader's result as it came back, a Return or a UserError, and its bool is
  its vote; a validator that raises votes against. The leader's result has to
  be a flat dict of strings, which on a node is enforced outside the contract
  by the calldata encoder.

Addresses compare by value and case-insensitively, as twenty raw bytes do. The
SDK's as_hex returns the checksummed form; this one returns what it was given.
"""

from __future__ import annotations

import dataclasses
import types
import typing


class UserError(Exception):
    """gl.vm.UserError. On runtime 5jycge4q the sentence is .data; there is no .message."""

    def __init__(self, data: str, /) -> None:
        super().__init__(data)
        self.data = data


class VMError(Exception):
    def __init__(self, message: str = "") -> None:
        super().__init__(message)
        self.message = message


class Disagreement(VMError):
    """A majority of validators voted against the leader. Nothing is written."""

    def __init__(self, votes: list) -> None:
        super().__init__(f"validators disagreed: {votes}")
        self.votes = votes


class Return:
    """gl.vm.Return. A leader result that came back rather than raising."""

    def __init__(self, value: typing.Any) -> None:
        self.calldata = value


class Address:
    def __init__(self, value: typing.Any) -> None:
        text = value._hex if isinstance(value, Address) else str(value).strip()
        if not text.startswith("0x") or len(text) != 42:
            raise ValueError(f"not an address: {text}")
        int(text[2:], 16)
        self._hex = text

    @property
    def as_hex(self) -> str:
        return self._hex

    def __eq__(self, other: typing.Any) -> bool:
        return isinstance(other, Address) and other._hex.lower() == self._hex.lower()

    def __ne__(self, other: typing.Any) -> bool:
        return not self.__eq__(other)

    def __hash__(self) -> int:
        return hash(self._hex.lower())

    def __repr__(self) -> str:
        return f"Address({self._hex})"


def _sized(bits: int):
    limit = 1 << bits

    def make(value: typing.Any = 0) -> int:
        number = int(value)
        if number < 0 or number >= limit:
            raise ValueError(f"u{bits} out of range: {number}")
        return number

    return make


u8 = _sized(8)
u32 = _sized(32)
u64 = _sized(64)
u256 = _sized(256)


class _Generic:
    """Makes DynArray[Cert] and TreeMap[str, u256] valid annotations."""

    def __init__(self, empty) -> None:
        self._empty = empty

    def __getitem__(self, _item) -> "_Generic":
        return self

    def empty(self):
        return self._empty()


DynArray = _Generic(list)
TreeMap = _Generic(dict)


def allow_storage(cls):
    return cls


class _Write:
    def __init__(self, surface: "_Public") -> None:
        self._surface = surface

    def __call__(self, fn):
        self._surface.writes.append(fn.__name__)
        return fn

    def payable(self, fn):
        self._surface.writes.append(fn.__name__)
        self._surface.payables.append(fn.__name__)
        return fn


class _Public:
    def __init__(self) -> None:
        self.writes: list[str] = []
        self.views: list[str] = []
        self.payables: list[str] = []
        self.write = _Write(self)

    def view(self, fn):
        self.views.append(fn.__name__)
        return fn


@dataclasses.dataclass
class Page:
    status: int
    text: str
    shot: bytes


@dataclasses.dataclass
class Response:
    status: int
    headers: dict
    body: bytes


@dataclasses.dataclass
class Image:
    raw: bytes
    pil: typing.Any


def _block(prompt: str, tag: str) -> str:
    """The body of a block, read the way a model reads it: to the first close."""
    start = prompt.index("<" + tag + ">\n") + len(tag) + 3
    end = prompt.index("\n</" + tag + ">", start - 1)
    return prompt[start:end] if end >= start else ""


def _ids(body: str) -> list:
    out = []
    for line in body.split("\n"):
        if line == "":
            continue
        label, _, text = line.partition(": ")
        out.append((label, text))
    return out


class Model:
    """
    One node's model. It answers the three prompts the contract builds by
    reading them, so a test exercises the real prompt text.

    extractions and facts are keyed by the fenced page text, exactly as it
    appears inside the prompt's page block.
    """

    def __init__(self) -> None:
        self.extractions: dict = {}
        self.facts: dict = {}
        self.judge = None
        self.prompts: list[str] = []

    def __call__(self, prompt: str, images, response_format: str):
        self.prompts.append(prompt)
        if "\n<record_a>\n" in prompt:
            if self.judge is None:
                raise AssertionError("no judge set for this node")
            return self.judge(_ids(_block(prompt, "record_a")), _ids(_block(prompt, "record_b")))
        if "\n<claims>\n" in prompt:
            facts = self.facts.get(_block(prompt, "page"), set())
            return {label: ("yes" if text in facts else "no") for label, text in _ids(_block(prompt, "claims"))}
        claims, match = self.extractions[_block(prompt, "page")]
        return {"claims": list(claims), "image_matches_text": match}


class Node:
    def __init__(self) -> None:
        self.pages: dict[str, Page] = {}
        self.model = Model()


class Transfer(typing.NamedTuple):
    sender: str
    to: str
    value: int


class Bus:
    def __init__(self) -> None:
        self.transfers: list[Transfer] = []
        self.contracts: dict[str, typing.Any] = {}
        #: One list of validator votes per non-deterministic block that ran.
        self.runs: list[list[bool]] = []


def _assert_flat(value: typing.Any) -> None:
    ok = isinstance(value, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in value.items())
    if not ok:
        raise AssertionError(f"a non-deterministic block must return a flat dict of strings, got {value!r}")


class _Vm:
    UserError = UserError
    VMError = VMError
    Return = Return

    def __init__(self, gl: "GL") -> None:
        self._gl = gl

    def run_nondet(self, leader_fn, validator_fn):
        gl = self._gl
        if gl.in_nondet:
            raise AssertionError("a non-deterministic block inside another one")
        gl.in_nondet = True
        votes: list[bool] = []
        try:
            gl.current = 0
            try:
                value = leader_fn()
                _assert_flat(value)
                leader: typing.Any = Return(value)
            except UserError as error:
                leader = error
            for index in range(1, len(gl.nodes)):
                gl.current = index
                try:
                    vote = validator_fn(leader)
                except (UserError, VMError):
                    vote = False
                if not isinstance(vote, bool):
                    raise TypeError(f"validator returned a non-bool: {vote!r}")
                votes.append(vote)
        finally:
            gl.in_nondet = False
            gl.current = 0
        gl.bus.runs.append(votes)
        if sum(votes) * 2 <= len(votes):
            raise Disagreement(votes)
        if isinstance(leader, Return):
            return leader.calldata
        raise leader


class _Web:
    def __init__(self, gl: "GL") -> None:
        self._gl = gl

    def get(self, url: str, *, headers: dict | None = None) -> Response:
        page = self._gl.node().pages.get(url)
        if page is None:
            return Response(404, {}, b"")
        return Response(page.status, {}, page.text.encode("utf-8"))

    def render(self, url: str, *, mode: str = "text", wait_after_loaded: str | None = None):
        page = self._gl.node().pages.get(url)
        if mode == "screenshot":
            return Image(page.shot if page else b"", None)
        return page.text if page else ""


class _Nondet:
    def __init__(self, gl: "GL") -> None:
        self._gl = gl
        self.web = _Web(gl)

    def exec_prompt(self, prompt: str, **config):
        node = self._gl.node()
        return node.model(prompt, config.get("images"), config.get("response_format", "text"))


class _Message:
    def __init__(self) -> None:
        self.sender_address = Address("0x" + "11" * 20)
        self.origin_address = Address("0x" + "11" * 20)
        self.contract_address = Address("0x" + "cc" * 20)
        self.value = 0
        self.chain_id = 61999


class _Views:
    def __init__(self, target: typing.Any) -> None:
        self._target = target

    def __getattr__(self, name: str):
        method = getattr(self._target, name, None) if self._target is not None else None
        if method is None or name.startswith("_"):
            def missing(*_args, **_kwargs):
                raise VMError(f"no view method {name}")
            return missing
        return method


class _ContractAt:
    def __init__(self, gl: "GL", address: Address) -> None:
        if not isinstance(address, Address):
            raise TypeError("address expected")
        self._gl = gl
        self.address = address

    def view(self, **_state) -> _Views:
        return _Views(self._gl.bus.contracts.get(self.address.as_hex.lower()))

    def emit_transfer(self, *, value: int, on: str = "finalized") -> None:
        if value <= 0:
            raise ValueError("value must be greater than 0 for emit_transfer")
        self._gl.bus.transfers.append(
            Transfer(self._gl.message.contract_address.as_hex, self.address.as_hex, int(value))
        )


class Contract:
    """Zero-initialises annotated storage the way GenVM does."""

    def __new__(cls, *args, **kwargs):
        instance = super().__new__(cls)
        for name, annotation in getattr(cls, "__annotations__", {}).items():
            if isinstance(annotation, _Generic):
                setattr(instance, name, annotation.empty())
            elif annotation is str:
                setattr(instance, name, "")
            elif annotation is bool:
                setattr(instance, name, False)
            elif annotation is Address:
                setattr(instance, name, Address("0x" + "00" * 20))
            else:
                setattr(instance, name, 0)
        return instance


class GL:
    """The gl namespace, with one Node per validator plus the leader at index 0."""

    def __init__(self, nodes: int = 5) -> None:
        self.nodes = [Node() for _ in range(nodes)]
        self.current = 0
        self.in_nondet = False
        self.bus = Bus()
        self.vm = _Vm(self)
        self.public = _Public()
        self.message = _Message()
        self.message_raw: dict = {"datetime": "2026-09-15T10:00:00Z", "is_init": True}
        # The runtime reads the transaction's datetime from message.raw, the
        # same dict, so a test that moves the clock moves it here too.
        self.message.raw = self.message_raw
        self.nondet = _Nondet(self)
        self.Contract = Contract
        self.contract = types.SimpleNamespace(Contract=Contract, get_at=self.get_contract_at)

    def node(self) -> Node:
        if not self.in_nondet:
            raise AssertionError("gl.nondet reached outside a non-deterministic block")
        return self.nodes[self.current]

    def get_contract_at(self, address: Address) -> _ContractAt:
        return _ContractAt(self, address)
