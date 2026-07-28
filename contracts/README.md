# The Standing contract

One method matters: `notarize(url)`. Everything else in the product is built on
calling it repeatedly against the same url.

```bash
genvm-lint check contracts/standing.py   # lint
python contracts/test_helpers.py         # 40 assertions on the pure helpers
```

`genvm-lint validate` cannot see a class named `Contract` — it skips it by name
in `validate/sdk_loader.py`, and `Contract` is the GenLayer convention, so every
real contract reports "No contract class found". To validate for real, copy the
file and rename the class first:

```bash
sed 's/class Contract(gl.Contract)/class StandingNotary(gl.Contract)/' contracts/standing.py > /tmp/v.py && genvm-lint check /tmp/v.py
```

That reports **29 methods, 20 view, 9 write, validation passed**.

## The shape

Above `run_nondet` is the non deterministic half: three fetches and one vision
prompt. Below it is the deterministic half, where storage moves. The line is
marked in both `notarize` and `capture_watch` and nothing crosses it.

Storage is thin on purpose. A certificate is a title, a claim list, two digests,
a timestamp and the threshold that was in force. That is what a person could
testify about, and nothing more.

## What the network actually agrees on

Each validator re-runs the whole capture and compares four things with the
leader:

| Compared | Rule |
| --- | --- |
| Claim set | Set overlap ≥ threshold, on normalised claims |
| Cloaking flag | Exact match |
| HTTP status | Exact match |
| Text digest | Recomputed from the bytes the leader shipped |

Wording is allowed to differ, substance is not. Strict equality on the text is
impossible: every fetch differs in ads, ordering and session data, which is the
entire reason this product needs GenLayer.

## Ten errors in the brief, and what was done instead

The brief's contract sketch is on pages 7 and 8. Working through it turned up
ten problems. Two of them stop the contract from running at all.

### 1. `hashlib.sha256(shot)` cannot work — crash

`gl.nondet.web.render(url, mode='screenshot')` returns
`gl.nondet.Image`, a dataclass of `raw: bytes` and `pil: PIL.Image`
(`gl/nondet/__init__.py:36`). `hashlib` cannot digest it. Every call to
`notarize` would die inside the consensus block.

Fixed: `hashlib.sha256(shot.raw)`.

### 2. `DynArray[u256]()` raises by design — crash

The brief's `watch()` ends with `cert_ids=DynArray[u256]()`. `DynArray.__init__`
raises `TypeError("this class can't be instantiated by user")` unconditionally
(`py/storage/vec.py:22`). Every call to `watch` would die.

Fixed: pass `[]`. `_DynArrayDesc.set` accepts any `Sequence` and copies it into
storage (`py/storage/vec.py:213`).

### 3. The digests were not checked by anyone — forgeable evidence

This is the serious one. In the brief, `leader_fn` computes `text_digest` and
`shot_digest`, but `validator_fn` compares only the claim overlap and the match
flag. Nothing binds either digest to anything. A leader could return the digest
of a file it invented, every validator would agree, and the chain would carry it
forever as evidence.

That voids the product's central promise — that "anyone can check the file they
were given is the file that was captured" (page 7). A digest nobody verified is
not evidence, it is a number.

Fixed for the text: the leader ships the exact 14,000 character window inside
the proposal, every validator recomputes `sha256` over it and compares, and the
window is dropped before storage. The chain keeps only the digest. This also
makes the evidence bundle real — the agreed bytes exist in the consensus data,
so the indexer can publish the exact text the digest refers to.

Not fixed for the screenshot, and it cannot be: two browsers never produce
identical pixels for the same page, so byte equality would fail on every honest
capture. The screenshot digest is the leader's, and every surface that displays
it says so in those words. The vision check still constrains the leader — the
image it hashed has to show the same claims the validators independently found.

A perceptual hash with a tolerance would close more of this gap. It is not here
because the threshold would be a guess. On the previous product in this series
a dHash was built, measured, and removed on the evidence: re-encoding the same
image scored *further apart* than two genuinely different images. The same
measurement has to be done on real captures before a number goes in. Until then
an unmeasured threshold would mostly manufacture false disagreements, which is
the exact failure page 6 is worried about.

### 4. `run_nondet_unsafe` turns honest refusals into bare disagreements

The brief raises `UserError("no claims extracted, page may be empty or
blocked")` inside `leader_fn`, then uses `run_nondet_unsafe` with a validator
that opens `if not isinstance(leader_res, gl.vm.Return): return False`.

So when a page is genuinely blocked, the leader raises, every validator returns
False, and the transaction fails as a consensus disagreement with no message.
The frontend chapter asks for the opposite: "Surface the contract error string
verbatim, since these are written for humans" (page 9).

Fixed two ways. `gl.vm.run_nondet` compares user errors by message and
propagates a unanimous one (`gl/vm.py:191`). And `validator_fn` calls
`leader_fn()` on its **first** line, before it looks at the leader's result, so
a validator that also finds the page blocked raises the same message instead of
voting no. Ordering those two lines the other way round quietly breaks it.

Every refusal message is therefore a constant. Interpolating a node-specific
value into one would stop the messages matching and reintroduce the bug.

### 5. `agreement_bps` claims to be something a contract cannot know

The field is commented "overlap actually achieved, stored for the record", but
the code assigns `self.overlap_bps`, the threshold. The two are different
numbers and only one of them is knowable: a contract cannot see how many
validators agreed or by how much. That lives in the consensus layer.

The screens inherit the confusion — the home page prints "4 of 5 validators
matched" and the certificate prints "4 of 5 matched, threshold 60 percent",
neither of which the contract can produce.

Fixed by naming the field `threshold_bps` and having the UI say only what is
true: the threshold that was in force, and that the capture cleared it. The
`AgreementMeter` component reads as a threshold gauge, not a vote count.

### 6. `certificate()` omits `text_digest`

The view returns url, title, claims, shot_digest, cloaking, agreement_bps and
at. The certificate screen on page 13 displays "text window sha256 77ab...31c9",
which that view cannot supply.

Fixed: the view returns every stored field, including `text_chars` and
`status_code`.

### 7. A watch could never produce a timeline

`Watch.cert_ids` is created empty and nothing ever appends to it. There is no
method that takes a capture and files it under a watch, so `/w/[id]` — a full
screen, and the revenue line the brief calls "the highest margin line in the
product" — has no data source.

Fixed with `capture_watch(watch_id)`: spends one prepaid capture, appends the
certificate id, stamps `last_checked`, and emits `WatchCaptured` carrying the
added and removed claims so the indexer gets the diff without recomputing it.
It is callable by anyone once the cadence is due. The owner has already paid,
the schedule is on chain, and the caller earns nothing, so leaving it open means
the schedule does not depend on one worker process staying alive.

### 8. Prepaid captures were treated as revenue

`watch()` takes four captures of prepay up front. In the brief that money lands
in the same undifferentiated balance as fees, with no withdraw method at all —
so it is simultaneously unreachable and, the moment one is added, spendable by
the owner before the captures are delivered.

Fixed: `prepaid_held` and `fees_accrued` are separate. A watch's prepay is a
liability, and only the change moves to fees. Each capture moves exactly one fee
across. `withdraw_fees` can only ever reach `fees_accrued`, and `close_watch`
refunds unspent credits.

### 9. Nothing refused a url before payment

Page 15 lists "only public pages are supported, checked and refused before
payment" as the answer to the paywall risk, but no check exists.

Worse, every validator fetches whatever url it is handed, which makes an
unguarded contract a way to point the whole validator set at an address of the
requester's choosing. `_check_url` refuses non-http schemes, urls carrying
credentials, loopback, link-local, cloud metadata, the three private ranges and
names with no public dot, and it runs before the fee is taken.

It also normalises: the fragment is dropped, because it never reaches the server
and would otherwise let one page look like two in the watch index.

### 10. The claim cap was applied after sorting

`sorted({...})[:8]` sorts alphabetically and then keeps the first eight, so a
page whose important claims start with late letters loses them to whatever began
with "a". The model returns claims in its own order of importance.

Fixed: cap in the model's order, then sort. There is a test pinning this.

## Two smaller changes

A `404` renders as a page with text on it, and a model will summarise it
happily. The brief wants the status code on the failure path, so the leader
makes one cheap `web.request` before anything expensive runs, and the status
travels with the proposal and is compared exactly.

`MIN_CLAIMS = 2` implements page 6's "the claim list is thin and the capture is
refused" for consent walls, which otherwise render as one line of boilerplate.

## Prompt injection

The page text and the screenshot are attacker controlled. The prompt says so,
in those words, and tells the model to ignore any instruction inside them. That
is necessary but not sufficient — the real defence is structural, and it is that
an injected instruction has to land identically on independent nodes running the
capture separately to survive the overlap check.

## Not done

Deployment. It needs a funded Bradbury account, which means a keystore password
and a faucet visit, both of which are the user's to make. Constructor arguments
are `fee` and `overlap_bps`; the brief's numbers are 0.4 GEN and 6000.

`min_gas` is deliberately unset until there are real gas figures to set it from.
