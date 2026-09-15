# The Standing contract

`standing.py` is one file with no build step. What is deployed is this file with LF
line endings.

```bash
npm run lint:contract                     # genvm-lint check: the AST pass and a load against the SDK
python contracts/test_helpers.py          # the pure half, 153 checks
python -m unittest discover -s tests/direct   # the contract against a GenVM double, 63 tests
python scripts/mutate.py                  # 49 mutants, each must be caught
```

## API names, checked against the pinned SDK

The file opens with `# v0.3.0` and depends on
`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`, the GenVM v0.6 runtime
that GenLayer Studio Next runs. Every name below was read from that runtime's standard
library, not from documentation.

| Used | For |
| --- | --- |
| `gl.contract.Contract` | The base class. `import genlayer as gl` is explicit: the star import no longer binds `gl` |
| `DynArray`, `TreeMap`, `allow` from `genlayer.storage` | Storage types, and the storage-class decorator, imported as `allow_storage` because that is the name the linter checks |
| `gl.vm.run_nondet(leader_fn, validator_fn)` | Both blocks. The validator is handed the leader's result as it came back, and a validator that raises counts as a vote against |
| `gl.vm.Return`, `gl.vm.UserError` | Reading the leader's result, and every refusal. A refusal's sentence is its `.data` |
| `gl.nondet.web.get(url).status` | The status, before anything expensive |
| `gl.nondet.web.render(url, mode="text" or "screenshot")` | The text window and the screenshot, which renders as an `Image` with `.raw` |
| `gl.nondet.exec_prompt(prompt, images=[...], response_format="json")` | The three prompts |
| `gl.contract.get_at(Address).view()` | A snapshot's reads, by name |
| `gl.contract.get_at(Address).emit_transfer(value=...)` | Refunds and withdrawals, sent on finality |
| `gl.message.raw["datetime"]` | The only clock. There is no block timestamp |

`run_nondet` rather than the sandboxed `run_nondet_default`, because genvm-lint 0.11.1rc2
recognises only `run_nondet` and `run_nondet_unsafe` as blocks, and fails every
`gl.nondet` call reached from the other. The cost is that a refusal is no longer compared
for the contract, so each validator compares it itself; see below.

## Consensus

### A capture

The leader fetches the page, renders its text window and a screenshot, and asks its model
for two to six claims and whether the screenshot shows them. It returns a flat dict of
two strings: the normalised claims joined by newlines, and `yes` or `no`.

Each validator first reads the page itself and runs the same extraction. If that
refuses, the validator agrees only with a leader that refused with the same sentence
(`_same_refusal`), so a page blocked for every node arrives as its sentence rather than as
a disagreement. Otherwise it checks:

1. The proposal is exactly the shape a leader could honestly produce: two keys, string
   values, claims already normalised, between two and six of them.
2. Its own image check equals the leader's.
3. Its own model, shown the numbered claims and this validator's own page text, answers
   `yes` for every claim.

A certificate stores exactly the claims that were checked and the image check that was
compared. Agreement therefore always means the validator found every stored claim on its
own copy, and `test_helpers.py` confirms it over every proposal and world it builds.

### A judgment of a change

The contract takes the claims only the earlier capture has and the claims only the later
has, and numbers them `c1` onwards, earlier first. It asks the model twice in one block,
once with each set shown first. Neither record says which capture it came from, because the
answer does not depend on direction.

Each answer is `material` with the ids of the lines that carry the difference, or
`immaterial`. An answer the contract cannot act on, such as a line id the question never
had or `material` naming no line, counts as `unclear`. The block resolves to the answer
both orders gave, or `unclear` when they differ, and validators compare that resolved
answer exactly. The stored verdict and lines are the compared value. A validator whose
own asking refuses agrees only with the same refusal, as in a capture.

The question is filed under a digest of the url and both sets of lines, so the same change
is answered once whichever pair asks it.

### A contract snapshot

A cross contract read is part of deterministic execution, so every validator computes the
same lines and there is no block. Each line is `name = value`, with values rendered the same
way on every node and mapping keys sorted.

## Storage

No storage dataclass holds a collection. A `DynArray` inside one cannot be instantiated by
user code on a node, while every host-side check passes it. So:

- a certificate's claims are `(claim_first, claim_count)` into one flat `claim_text` array;
- a watch's captures are a linked list through `Cert.watch_next`, from `first_cert` to
  `last_cert`;
- a url's history is a linked list through `Cert.url_prev`, from `latest_of_url[url]`.

Every field in the contract and the three dataclasses carries a `#:` comment saying what
it holds.

## Who may write

| Method | Price | Who |
| --- | --- | --- |
| `notarize(url)` | the fee | anyone; the payer is stored as requester |
| `notarize_contracts(targets, method_sets)` | a quarter of the fee, each | anyone; the payer is stored as requester |
| `watch(url, cadence_hours)` | the fee per capture, 4 to 400 | anyone; the sender becomes the owner |
| `capture_watch(watch_id)` | free | anyone, once a capture is due |
| `top_up_watch(watch_id)` | the watch's own price per capture | the watch's owner |
| `close_watch(watch_id)` | free | the watch's owner, refunded what the watch holds |
| `assess(cert_a, cert_b)` | half the fee | anyone, once per change |
| `set_fee`, `withdraw_fees`, `transfer_ownership` | free | the contract owner |

`tests/direct/test_static.py` parses the source and fails if a write neither checks its
sender nor appears in its list of open methods, each listed with its reason.

Views return JSON with sorted keys, and wei amounts as strings: `stats`, `certificate`,
`certificates`, `history`, `cert_for_digest`, `watch_record`, `watches_page`,
`watch_for_url`, `assessment`, `assessment_for_pair`. An absent record reads as `null`.

## Refusals

Every refusal is a module constant, and a static test holds that. The ones raised inside a
block have to be: a node-specific value in the message would turn a unanimous refusal into
a disagreement. The url refusals are mirrored word for word in `lib/url.ts`, and the parity
test compares them.

## Traps worth knowing

- **Name the class after the product.** `genvm-lint validate` skips a class named
  `Contract`, and reports "No contract class found" for a contract that is fine.
- **Use the v0.6 linter, and pin its bundle.** genvm-linter 0.11.0 knows no GenVM past
  v0.3.0-rc7, so it cannot load this runtime; 0.11.1rc2 can. The linter also loads the
  newest bundle in its cache, so `scripts/lint-contract.mjs` runs the one in `.venv` with
  `GENVM_VERSION=v0.6.0-rc5`, the bundle that ships `5jycge4q`.
- **Only printable ascii urls.** Python's urlsplit and a browser's url parser disagree
  outside that range and on bracketed hosts, and one disagreement is enough for a lookup
  by url to miss. Refusing both is what lets the browser's copy of the guard agree exactly.
- **Checksummed addresses.** Studio reads a lowercased contract address as one that does
  not exist, so snapshot urls keep the checksummed form and the site sends it.
- **A string, not an Address, for address parameters.** genlayer-js sends a hex string as
  a string.
- **A payout has to be declared.** On consensus v0.6 a transfer out of the contract is an
  external message, funded only when the transaction declares it at the root of its
  message tree: the payee, the unnamed call key of a value transfer, and a budget. The
  site declares one for `close_watch`. Whoever calls `withdraw_fees` has to declare one for
  the `to` address, or the transfer fails with `fee no_matching_allocation # external`.

## Deploying

```bash
npm run deploy -- --fund      # reads STANDING_DEPLOYER_KEY from the shell; --fund asks Studio Next's faucet first
npm run verify -- 0xADDRESS
npm run match -- 0xADDRESS
```

The constructor takes one argument, the capture price in wei, at least four. Every
transaction on Studio Next carries a fee deposit beside its value. The scripts and the
site ask for the most time a phase may have, 600 time units, and what the validators do
not spend comes back at finalization.
