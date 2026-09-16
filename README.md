<div align="center">

# Standing

**What a page said, agreed by strangers.**

A notary for public web pages and intelligent contracts. Every validator reads the
page for itself and checks each claim against its own copy, and a certificate
records only the claims they all found, with the moment they read them.

[![Built by InferNode](https://img.shields.io/badge/built%20by-InferNode-7ac943?style=flat-square)](https://github.com/meitipro)
[![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-101216?style=flat-square)](https://genlayer.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-101216?style=flat-square)](https://nextjs.org)

</div>

---

## Overview

Pages change. Terms get rewritten, fees move, a promise leaves a sale page the week
after the sale. A screenshot taken by one party proves that party's word and no more.
Standing makes the record something several parties who do not know each other
agreed on, inside a contract anyone can read.

Paste a url and pay the capture price. The contract has every validator fetch and
render the page, one of them proposes the claims a reader would take away, and each of
the others checks every one of those claims against the copy it read itself. The
certificate stores the claims that survived that check, a sha256 of them, whether the
screenshot showed the same claims as the text, the moment, and who paid.

Three decisions carry the product:

**Every stored claim was found by every agreeing validator.** A validator does not
vote on how similar its reading is to the leader's; it checks each proposed claim
against its own page and agrees only if it finds them all. There is no overlap
threshold for a claim to slip through.

**Whether a change mattered is asked in both orders.** Two captures of a page can be
put to the network as one question. The model answers from a closed set, once with each
capture shown first, and when the two orders disagree the stored answer is `unclear`.
The uncertainty lives in the value, so validators can compare it exactly.

**Nothing moves the record but the chain.** The site holds no key and signs nothing.
Every capture, watch and question was paid for by the wallet that asked, and every
screen is read back from the contract.

---

## Live on GenLayer Studio

The contract is deployed on GenLayer Studio, chain 61999, at
[`0xc170960F46e8e0190544dfA3579120D843Bf3970`](https://explorer-studio.genlayer.com/address/0xc170960F46e8e0190544dfA3579120D843Bf3970),
and the site that reads it is [getstanding.xyz](https://getstanding.xyz). Every
line below was read back off the chain.

| What | Transaction |
| --- | --- |
| The contract, deployed | [`0xf0e75a15`](https://explorer-studio.genlayer.com/tx/0xf0e75a151c773a52c1dccb532ae89b904853c1565e9cc3dd19a223bf5ac9155e) |
| A capture that was agreed: `www.field-works.xyz`, six claims | [`0xeb848d7c`](https://explorer-studio.genlayer.com/tx/0xeb848d7cd50514728ca1b4b5d06adcc4e95ba4b61b2519e77b2e89e06be7dd83) |
| A capture that was refused: `the page answered with an error status` | [`0x0b8b00ea`](https://explorer-studio.genlayer.com/tx/0x0b8b00eaeefc037d76a27c51c1f13fcaa840ba080c8fa7254bddabecccee5938) |
| A watch opened over the same page, four captures prepaid | [`0xa8dd4fdc`](https://explorer-studio.genlayer.com/tx/0xa8dd4fdcef4abb0dbcc052161e4e7068b06c467db2a1701e09a7c7d7aadf4e1c) |
| Two contracts snapshotted in one transaction | [`0x344247c5`](https://explorer-studio.genlayer.com/tx/0x344247c5adf932ddd3ed9b34a3ef5970c59a4430c055a6b39c4067e0fceb5a44) |
| That watch closed, and its prepay released | [`0xca2a82bd`](https://explorer-studio.genlayer.com/tx/0xca2a82bd62f9fe69ad3f12e7cbd59122c23a7c0989a8c1adda241d0e3f22f696) |

Certificate 0 is the page capture. Its six claims are the ones every validator
found on the copy it read itself, and its digest,
`efb322987b8834f7981f24e400b59f8d9e168464939719fd8a3e765307217bcd`, is
recomputed from those claims by [the verify page](https://getstanding.xyz/verify).

Three things this deployment says plainly:

- **The capture price is four wei**, the contract's floor, so the site renders
  every price as `0 GEN`. The prices are still exact: a payment of anything but
  the price is refused before a page is fetched.
- **The refund left the contract and did not arrive.** Closing the watch
  released its prepay, and the transfer the contract emitted answers
  `Contract 0x3e1D... not found`: Studio delivers a payout as a contract call
  and a wallet is not a contract. The watch's own accounting is settled either
  way, which is what the record shows.
- **The deployed bytes came through the Studio editor**, which rewrites line
  endings, so `npm run match` reports COSMETIC ONLY rather than MATCH: the same
  source, CRLF where this repository has LF, and `genvm-lint` passes over the
  deployed bytes as it does over the file.

---

## How it works

| | Step | What the contract does |
| --- | --- | --- |
| 1 | Someone pastes a url and pays | Refuses a private address, a url it cannot read, or any amount but the exact price, before a page is fetched |
| 2 | The leader reads the page | Establishes the status, renders the text and a screenshot, and proposes two to six claims and whether the screenshot shows them |
| 3 | Every validator reads it again | Checks each proposed claim against its own copy, one at a time, compares its own image check exactly, and agrees only if both hold |
| 4 | The certificate | Stores the agreed claims, their digest, the image check, the moment and the payer, linked to the previous capture of the same url |
| 5 | A later capture | Links back to the one before it, so the page's history is a walk on chain |
| 6 | A question about the change | Each validator asks its own model in both presentation orders and resolves `material` with the lines that carry it, `immaterial`, or `unclear` |

Contracts can be recorded too. A snapshot reads another contract's zero-argument
views, which is deterministic, so up to ten go in one transaction and no model is
involved.

---

## Why this needs GenLayer

The contract does not use a model as a backend. It uses the network where **a reading
of the live web has to be settled between parties who do not trust each other**.

One server fetching one page is a trusted party, and so is one model deciding whether a
change mattered. Here the page is read by every validator separately, the claims that
reach the chain are the ones each of them confirmed, and the judgment of a change is
reached independently on every node and compared exactly. Nothing about that reduces to
a deterministic call, and nothing about it is safe for one party to compute.

- **The contract owns** the url guard, the reading, the claim check, the image check,
  the judgment, the prices, the watches and every refusal.
- **The site owns** the forms, the wallet prompt and the rendering. It refuses a bad
  url before anybody signs with the contract's own guard, held to it by a parity test.
- **The chain owns** the record. Every screen here can be rebuilt from the contract's
  views with no part of this site.

---

## The contract

**20 methods, 10 view and 10 write**, `genvm-lint` clean. There is no build step between
the source and the chain: the running site serves the file at
[`/api/contract-source`](https://getstanding.xyz/api/contract-source), and
`npm run match` compares it byte for byte with what an address returns.

### Behaviour worth knowing

- **A claim only the leader found is never stored.** The validators' check is per
  claim, and a certificate needs a majority of them to find every one.
- **Refusals are unanimous or they are nothing.** A page that answers with an error,
  renders almost no text or carries fewer than two claims is refused by every node with
  the same sentence, and that sentence is what the caller sees.
- **A question is filed by the change, not the pair.** The same change is answered
  once, whichever two certificates ask it, so capturing again cannot shop for a
  different verdict.
- **A watch keeps its price.** The capture price is locked when a watch opens, so a
  later fee change never strands its prepay, and closing refunds exactly what it holds.
- **Anyone can take a due capture.** The owner has already paid and the contract
  decides when a capture is due, so the schedule does not depend on one process staying
  alive. Topping up and closing belong to the owner alone.
- **Prices are exact.** Every payable call takes precisely the price `stats()` reports
  and refuses anything else, so nothing is silently kept as change.
- **No global scans.** Claims live in one flat array, a watch's captures and a page's
  history are linked lists through the certificates, and every list view is paged.

### How it is checked

`npm test` runs the house-style check, the parity tests that hold the browser's url
guard, claims digest and limits to the contract's, 61 direct tests against a GenVM
double in which every node has its own copy of the page, and 150 checks over the pure
half, including two sweeps that confirm agreement always implies the same storage.

[`docs/MUTATIONS.md`](docs/MUTATIONS.md) is generated by `npm run mutate`: 47 guards
deleted or loosened one at a time, each caught by a named test. The generator writes
no table if anything escapes.

### Corrections

Each of these was wrong in an earlier version of this repository, with what found it.

- Validators agreed when their claims overlapped the leader's by 60 percent, and the
  leader's claims were stored, so a certificate could carry a claim no validator
  found. Found by an audit against the rule that uncertainty belongs in the value.
- Claim lists sat inside storage dataclasses, which cannot be instantiated on a node.
  Found by the GenVM storage rules.
- Page text was wrapped in tags without neutralising angle brackets, so a page could
  close the block it sat in. Found by the prompt fencing rule.
- `top_up_watch` accepted any caller. Found by the static test that every write checks
  its sender or is named with a reason.
- Contract addresses were typed `Address`, which genlayer-js sends as a string.
- Deleting the private-prefix guard broke no Python test. Found by the mutation runner.
- The site described an evidence bundle, an API relayer, rate limits and webhook alerts
  that did not exist. Removed.

---

## The site

Next.js 14, App Router. A field and a button, a certificate built to be read as an
image, a page history with the claims that arrived and went, a verify page that
recomputes a certificate's digest, bulk adding for pages and contracts, and the same
records as JSON.

Every write reads its price from the contract, checks the leader receipt rather than the
status fields that read like success on a refusal, and then reads the new record back off
the chain. A refusal is shown as the contract's own sentence.

The network is GenLayer Studio, chain 61999. Test GEN comes from the Get 100 GEN button
in the header, which asks Studio's own faucet.

```bash
npm install
npm run dev          # http://localhost:3200
npm test
npm run lint:contract
npm run mutate
```

`npm test` needs Python 3.10 or later and a Node that strips types on import, 22.18 or
later. Nothing in it touches a network or needs pytest.

---

<div align="center">

Built by **InferNode**

</div>
