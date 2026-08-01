# Standing

A notary for public web pages. Paste a url, several validators independently
fetch it, agree on what it claims, and record a permanent certificate with a
screenshot digest and a timestamp.

Project 04 of 10 in the InferNode build brief series. Built against GenLayer
Testnet Bradbury with the GenVM Python SDK.

> One server capturing one screenshot is a trusted party. Many nodes agreeing on
> the claims is evidence.

## Running it

```bash
npm install
npm run dev
```

Then <http://localhost:3200>.

```bash
npm run build                       # production build
genvm-lint check contracts/standing.py
python contracts/test_helpers.py    # 40 assertions on the deterministic helpers
```

Copy `.env.example` to `.env.local`. With `NEXT_PUBLIC_STANDING_ADDRESS` unset
the site runs on the seeded records in `lib/seed.ts`, every screen says so in a
black banner, and every write is refused with a message explaining why.

## What is here

| Path | What it is |
| --- | --- |
| `contracts/standing.py` | The contract. 29 methods, passes lint and validation. |
| `contracts/README.md` | How settlement works, and ten errors found in the brief. |
| `contracts/test_helpers.py` | Tests for the url guard, claim normaliser and cadence maths. |
| `app/page.tsx` | Home. One field, one button, a real certificate underneath. |
| `app/c/[id]/` | The certificate. The screen the product lives or dies on. |
| `app/w/[id]/` | A watch timeline: diffs, and every claim's first and last sighting. |
| `app/watch/` | Open a watch, and the list of watched pages. |
| `app/verify/` | What a certificate proves, and what it does not. |
| `app/api/` | The API page, plus the JSON endpoints under `/api/v1`. |
| `lib/store.ts` | Reads, cached five seconds, chain or seed. |
| `app/globals.css` | The whole brand: tokens, both themes, every component class. |
| `design-brief.pdf` | The handoff that produced the current visual system. |

## The look

Rebuilt from a Claude Design handoff (`Standing Site.dc.html`). Three typefaces,
each with a job it never leaves: **Instrument Serif** for the few sentences meant
to be read as a statement, **IBM Plex Mono** for anything that is evidence,
**Archivo** for everything that is explanation. A reader can tell a fact from a
paragraph about a fact without reading either. All three are self hosted through
`next/font` — a site whose whole claim is that it does not depend on one server
should not need a request to a font CDN to finish rendering.

Light and dark, chosen by an inline script in the document head before first
paint, so the page is never painted in the wrong theme and then corrected. A
stored choice wins; without one the operating system's preference is honoured.

Everything is drawn with one border weight and a 2px radius, and the whole site
sits inside one ruled column with the borders running its full height, so each
section reads as a row of the same ledger. Depth, where it exists at all, is a
hard offset shadow rather than a blur: these are meant to look like stamped
paper, not glass.

Three things in the design are load bearing rather than decorative, and a future
restyle must keep them:

- The captured moment is the largest thing on a certificate by a wide margin.
- `network-verified` and `leader-attested` are different badges on the two
  digests, everywhere both appear.
- The cloaking flag keeps its own colour on every surface — including the share
  card, where a plain `.sharecard .tag` rule would otherwise outrank
  `.tag-flag` and quietly grey it out.

## The one thing worth knowing

The two digests on a certificate are **not** worth the same, and every surface
that shows them says so.

The **text digest** is agreed: the leader ships the exact 14,000 character
window inside the consensus block, every validator recomputes sha256 over it and
compares, and the window is dropped before storage. A copy of the text you are
handed can be checked against it.

The **screenshot digest** is attested: two browsers never render one page to
identical pixels, so the network cannot compare images byte for byte. It pins
the leader to a single image, and the vision check constrains what that image
can have shown, but the network did not verify those bytes.

In the brief neither digest was checked by anyone — the leader computed both and
the validator compared only the claim overlap and the cloaking flag, so a leader
could have reported the digest of a file it invented and been agreed with. That
and nine other problems are written up in
[contracts/README.md](contracts/README.md).

The product also never prints "4 of 5 validators matched", which both of the
brief's screens do. A contract cannot see how many validators agreed; that lives
in the consensus layer. It shows the threshold, which is true and on chain.

## Networks

Bradbury is the default and where the contract lives. Every script takes
`--network=bradbury|asimov|studio`, and the site reads
`NEXT_PUBLIC_GENLAYER_NETWORK` (same three names).

A contract address only means anything on the chain it was deployed to —
reading a Bradbury address against Asimov reports "contract not found", which
looks exactly like a failed deployment. That is why every script prints the
network it just asked.

**A deployment can also be readable at the consensus layer and unreadable at
the execution layer.** That happened here: a deploy finalized correctly, and
`gen_call` answered "contract not found at address" for hours afterwards before
the node caught up on its own. If `npm run check` says not found on a contract
you just deployed, check the transaction with `npm run tx` first — if the
execution result is `FINISHED_WITH_RETURN`, the deployment is fine and the node
is behind. Wait rather than redeploying.

## Deploying

```bash
npm run deploy
```

The script reads the deployer key from `STANDING_DEPLOYER_KEY` in the
environment — never from an argument, because arguments land in shell history
and in the process list. It prints the derived address, the fee and the
threshold, and waits for you to type `yes` before it sends anything. Pass
`--yes` to skip the prompt, `--fee=` and `--overlap=` to change the constructor
arguments from the brief's 0.4 GEN and 6000 bps.

```powershell
$env:STANDING_DEPLOYER_KEY = "0x..."   # PowerShell
npm run deploy
```

The account needs testnet GEN from <https://testnet-faucet.genlayer.foundation/>.
On success the script prints the contract address; put it in `.env.local` as
`NEXT_PUBLIC_STANDING_ADDRESS` and restart. The sample-data banner disappears on
its own once that is set, the seeded records stop being served, and writes start
going to the chain.

Note that `--fee` is converted to wei in two steps rather than
`Math.round(fee * 1e18)`. The one-step version overflows float64's mantissa and
is silently wrong for roughly one fee value in eleven.

## Sample data

The fourteen seeded records are demonstration data on the RFC 2606 example
domains, and every screen that renders them says so. They are not real captures
and must not be cited.

That is not pedantry about a demo. This product exists because a convincing fake
record is harmful, so shipping fourteen invented ones dressed as genuine would be
the exact thing it was built to stop. The launch checklist's "ten real records
seeded before any announcement" means ten genuine captures, which needs the
contract deployed.

## Known caveat: open graph cards on Windows

`app/c/[id]/opengraph-image.tsx` declares `runtime = "edge"`, and it has to.

`next/og`'s **node** build loads its own fallback font at module scope with
`fileURLToPath(join(import.meta.url, "../noto-sans.ttf"))`. Joining a `file://`
url with `path.join` survives on posix by accident — the result still parses as
a file url — and does not on win32, where it becomes `.\file:\G:\...` and throws
`ERR_INVALID_URL`. It runs at import time, so every card 500s before any
argument of ours is read and passing our own font cannot help. It also takes the
dev server down with it.

The **edge** build defers the same font behind a promise it only awaits if it is
needed, so it imports cleanly on both platforms. Same renderer, same output.

Only a regular weight is available either way, so the card takes its hierarchy
from size and colour rather than from weight.

## Not done

**Deployment.** Scripted but not run — it needs a funded Bradbury account, which
is the owner's to provide. See "Deploying" above.

**The relayer.** `POST /api/v1/notarize` answers 501. A capture is a signed
payable transaction, so serving it for an API caller needs a funded server side
account billed against their key. Calling `notarize(url)` from a wallet works
today and needs nothing from us.

**The indexer.** `lib/store.ts` reads the contract directly, which is why the
site works against a bare node. Postgres mirroring, the watch scheduler and
webhook alerts are the second week of work. The contract already emits
`CertificateIssued` and `WatchCaptured` with the added and removed claims, so
the diff does not have to be recomputed downstream.

**Finality.** Contract storage cannot see transaction finality, so a record read
from a live chain is reported as provisional. Wiring that to real transaction
status is an indexer job.

**A measured median capture time.** The home page says "~40s typical", not a
median, because nothing has been measured yet.
