# The Standing contract

`standing.py` is one file with no build step. What is deployed is this file with LF
line endings.

```bash
npm run lint:contract                     # genvm-lint check: the AST pass and a load against the SDK
python contracts/test_helpers.py          # the pure half, 150 checks
python -m unittest discover -s tests/direct   # the contract against a GenVM double, 61 tests
python scripts/mutate.py                  # 47 mutants, each must be caught
```

## API names, checked against the pinned SDK

The runtime is `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
Every name below was read from that SDK's source, not from documentation.

| Used | For |
| --- | --- |
| `gl.vm.run_nondet(leader_fn, validator_fn)` | Both blocks. The validator runs sandboxed, and a refusal agrees with a refusal only when the messages match |
| `gl.vm.Return`, `gl.vm.UserError` | Reading the leader's result, and every refusal |
| `gl.nondet.web.get(url).status` | The status, before anything expensive |
| `gl.nondet.web.render(url, mode="text" or "screenshot")` | The text window and the screenshot, which renders as an `Image` with `.raw` |
| `gl.nondet.exec_prompt(prompt, images=[...], response_format="json")` | The three prompts |
| `gl.get_contract_at(address).view()` | A snapshot's reads, by name |
| `gl.get_contract_at(address).emit_transfer(value=...)` | Refunds and withdrawals, sent on finality |
| `gl.message_raw["datetime"]` | The only clock. There is no block timestamp |

## Consensus

### A capture

The leader fetches the page, renders its text window and a screenshot, and asks its model
for two to six claims and whether the screenshot shows them. It returns a flat dict of
two strings: the normalised claims joined by newlines, and `yes` or `no`.

Each validator first reads the page itself and runs the same extraction. That raises the
same refusal the leader raised when a page is blocked or empty, so a unanimous refusal
arrives as its sentence rather than as a disagreement. Then it checks:

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
answer exactly. The stored verdict and lines are the compared value.

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
- **Pin the GenVM bundle.** The linter loads the newest bundle in its cache, and a later
  one does not ship this runtime. `scripts/lint-contract.mjs` sets `GENVM_VERSION`.
- **Only printable ascii urls.** Python's urlsplit and a browser's url parser disagree
  outside that range and on bracketed hosts, and one disagreement is enough for a lookup
  by url to miss. Refusing both is what lets the browser's copy of the guard agree exactly.
- **Checksummed addresses.** Studio reads a lowercased contract address as one that does
  not exist, so snapshot urls keep the checksummed form and the site sends it.
- **A string, not an Address, for address parameters.** genlayer-js sends a hex string as
  a string.
- **Refunds on studionet.** An `emit_transfer` payout has been measured on another contract
  not to credit the payee there. The contract's accounting is right either way; check the
  recipient's balance after a close.

## Deploying

The network is GenLayer Studio, chain 61999, and the scripts default to it.

```bash
npm run deploy -- --fund      # reads STANDING_DEPLOYER_KEY from the shell, funds the account
npm run verify -- 0xADDRESS
npm run match -- 0xADDRESS
```

The constructor takes one argument, the capture price in wei, at least four.

The `studio-next` branch carries this contract ported to consensus v0.6, for
GenLayer Studio Next. The two runtimes exclude each other: Studio Next will not load this
one, and Studio answers `execution failed` for that one, so they cannot share a build.
