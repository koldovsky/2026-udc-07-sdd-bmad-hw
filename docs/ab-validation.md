# A/B validation: specification vs ad-hoc (Task D)

**Feature:** discounts from `materials/feature-request.md`
**Host / model:** Claude Code / Opus 5, both runs
**Date:** 2026-09-06

## How the experiment was isolated

Run B was executed in a separate working copy, built
from the starter commit `c339625` — the last commit before Task A. Removed from
that copy: `docs/` (the walkthrough names the forks), the root `AGENTS.md` and
`CLAUDE.md` (they describe the homework), and every artifact produced by Runs A
and B of this repository. `app/src/index.ts` was taken from the starter commit,
so the ad-hoc agent could not see the exported names `priceOrder`,
`PriceBreakdown` or `RejectionReason`. Kept: the seeded `app/`, `app/AGENTS.md`,
and `materials/feature-request.md`.

Two properties of the setup work against Run A and are recorded deliberately.

1. The ticket was handed over **verbatim**, including its closing section that
   lists eight of the forks. Run B therefore started with a hint list that a
   real ad-hoc developer would not have. Any fork it still closed silently is a
   stronger finding for it.
2. The seeded `app/AGENTS.md` states that "rounding, discount stacking order and
   coupon precedence are specification decisions. If the code needs one and the
   spec does not state it, the spec is incomplete — fix the spec first." Run B
   followed that instruction and wrote its own specification before coding. So
   this is not spec-driven against no-spec; it is a 963-line specification
   against a 120-line one written in the same four minutes as the code.

Run B received one message — the implementation request below — and no answers
to any question. Nothing from `docs/spec/pricing-discounts.md` was quoted to it.

> Read materials/feature-request.md — it is a ticket from our Head of Growth for
> the autumn campaign.
>
> Implement it in this repository. The pricing domain lives in app/src: types.ts
> and pricing.ts are an existing contract — do not change their signatures. Put
> the discount engine in app/src/discounts.ts and export its public surface from
> app/src/index.ts.
>
> Write tests next to the code, and make sure `cd app && npm test` is green when
> you are done.

A third property of the setup, this one in Run B's favour: the message names the
file `app/src/discounts.ts` and asks for exports from `index.ts`, so Run B did
not have to guess where the engine belongs. That is layout, not behaviour — it
does not touch a single fork — but it is a hint Run A also had, and it is
recorded here rather than left implicit.

Run B's own output is committed under `docs/run-b/` — its specification, engine
and tests, verbatim — so every claim below can be checked from this repository
alone. Nothing there is part of the build; see `docs/run-b/README.md`.

## Run A — with the specification

Given `docs/spec/pricing-discounts.md` and asked to implement it.

- **Output:** `app/src/discounts.ts` (`priceOrder(order, catalog, now)`, a
  twelve-step calculation split into named functions), `app/src/discounts.test.ts`,
  `docs/traceability.md`.
- **Decisions on the ambiguities:** taken from the specification, which closes
  32 of them (D-1 … D-32) with a recorded reason for each. The implementation
  added none of its own; the reverse traceability check in `docs/traceability.md`
  records the search for unrequested behaviour.
- **Tests:** 60 of its own, each named after the acceptance criterion it covers
  (AC-1 … AC-60) — 68 with the 8 seeded `pricing` tests. Both counts are the
  state at the time of this comparison; Task E later added D-33 and AC-61, and
  the figures in `docs/traceability.md` are the current ones. Branch coverage of `discounts.ts`
  is 100%. Edge cases are covered because the specification required them:
  empty order, discount larger than the subtotal, half-kopeck rounding, invalid
  `now`, impossible calendar dates, non-integer coupon values.

## Run B — ad-hoc

New session, same model, only the ticket.

- **Output:** `docs/discount-spec.md` (11 decisions, D1 … D11, each with a
  reason), `app/src/discounts.ts` (`quoteOrder(order, catalog?, now?)` returning
  a breakdown with a per-discount list), `app/src/discounts.test.ts`, exports
  added to `app/src/index.ts`. 37 tests of its own — 45 with the same 8 seeded
  ones — green, typecheck clean, seeded signatures untouched. Copied to
  `docs/run-b/`.
- **Forks it closed deliberately:** sequential stacking, goods-only base,
  category base after the tier, threshold against the untouched subtotal,
  explicit rejection reasons, a floor at zero, clamping of out-of-range catalog
  percentages. On all of these it reasoned in writing and reached the same
  answer as the specification.
- **Forks it closed silently** — no mention in its own spec, no test, no
  comment: case and whitespace normalisation of typed codes, a blank coupon
  field, calendar-impossible expiry dates, an `expiresAt` without a UTC offset,
  an invalid `now`, a non-integer coupon `value`, and a `category` field that is
  `null` rather than absent. The non-integer `value` needs one qualification:
  Run B does guard that field and says so — its D11 clamps a non-finite `value`
  to zero and has a test for it. But `Number.isFinite(1234.5)` is true, so a
  fractional amount walks straight through the guard. What is written and tested
  is `NaN` and `Infinity`; the fork behind them is untouched.

## Decision comparison

Every row was executed on identical input through both engines; the amounts are
the values the two implementations actually returned. All amounts in kopecks;
"S*n*" refers to the scenario table below.

| Fork | A (per spec) | B (ad-hoc) | Match |
|---|---|---|---|
| D-1 stacking | sequential: tier, then coupon on the remainder | sequential, same order and same reason | yes |
| D-2 discount base | items only; shipping added afterwards | same | yes |
| D-3 several coupons | exactly one applies — the largest; ties go to the earlier typed code | one per scope: an order-wide coupon and one per category all apply; first typed claims the scope | **no** (S1: 81 400 vs 76 810) |
| D-4 rounding | floor, via integer division, once per discount | half-up, on a floating-point quotient, then split across lines | **no** (S2, S8) |
| D-5 category base | `idiv(categoryTotal × (100 − tierPercent), 100)` | the category's remaining value after the tier discount was allocated across lines | same on every tested value; the formulas can differ by a kopeck |
| D-6 `minSubtotalKopecks` | against the untouched subtotal | same | yes |
| D-7 negative total | impossible; each discount is capped at its base | same | yes |
| D-8 expired coupon | explicit rejection with a reason, never thrown | same | yes |
| D-9 source of `now` | required parameter; `new Date()` is never called | parameter, but defaults to `new Date()` | partial |
| D-10 code not in the catalog | rejected as `unknown` | rejected as `unknown-code` | yes (same money; the reason string is spelled differently) |
| D-11 duplicate code | collapsed silently, never shown as a failure | rejected as `duplicate-code`, shown to the customer | **no** (S9) |
| D-12 two coupons of equal value | the earlier typed one wins; the other is `superseded` | the earlier typed one claims the scope; the other is `scope-conflict` | yes |
| D-13 order with no items | subtotal 0, both discounts 0, shipping 0, total 0; typed codes still reported | same, down to the `no-effect` reason | yes |
| D-14 what the calculation returns | `PriceBreakdown`: subtotal, tier discount, coupon discount, applied code, rejected codes, shipping, total | a breakdown too, but discounts as a list of `{source, code, base, amount}` | partial — same money, different shape |
| D-15 case and whitespace | normalised before lookup | exact string match | **no** (S4) |
| D-16 zero-value discount | `no-effect` or `too-small`, split by whether the category is present in the basket | one `no-effect` reason for both | partial |
| D-17 how expiry is compared | `Date.parse`, invalid on or after `expiresAt`; a date without a time means midnight UTC | same, including the boundary: a coupon expiring `2026-03-01` is dead at `2026-03-01T00:00:00Z` | yes |
| D-18 broken catalog rows | first row matching the code wins; percent over 100 and an oversized fixed amount are capped, never negative | capping agrees, but `new Map(catalog.map(…))` (`docs/run-b/discounts.ts:188`) lets a **later** duplicate row overwrite the earlier one | **no** (S10: 94 900 vs 54 900) |
| D-19 rejected code echoed back | catalog spelling for known codes, typed string for unknown ones | typed string always | partial |
| D-20 impossible calendar date | explicit round-trip check; rejected as `expired` | `Date.parse` rolls the date forward; the coupon stays live | **no** (S6) |
| D-21 blank coupon field | ignored entirely | rejected as `unknown-code` | **no** (S5) |
| D-22 unit of a fixed `value` | kopecks, per the comment in `types.ts`, not the hryvnia of the ticket | kopecks, same reading | yes |
| D-23 `value` zero or negative | discount 0, rejected `too-small` | discount 0, rejected `no-effect` | yes (same money; see D-16 for the reason strings) |
| D-24 `expiresAt` without an offset | rejected; only `YYYY-MM-DD` or an explicit offset is accepted | parsed as server-local time | **no** |
| D-25 invalid `now` | every coupon rejected as `expired` | `NaN >= x` is false, so every coupon applies | **no** (S7) |
| D-27 non-integer `value` | discount 0 | a fractional discount reaches the total | **no** (S8) |
| D-28 `kind` is neither `"percent"` nor `"fixed"` | discount 0, rejected `too-small` | the branch is a ternary on `kind === "percent"`, so anything else falls through to the fixed arm and `value` is subtracted as kopecks | **no** (S11) |
| D-29 element of `order.coupons` is not a string | ignored entirely, like a blank field | rejected, with `code: null` shown back to the customer | partial — same money |
| D-30 `minSubtotalKopecks` is not a finite integer | the threshold is unreachable: rejected `min-subtotal`, and the field is left out of the rejection | `subtotal >= NaN` is false, and the guard reads the other way, so the coupon applies | **no** (S12) |
| D-31 `item.category` outside the union | counted in the subtotal, invisible to category coupons | same | yes |
| D-32 `category: null` | treated as a category coupon with an empty category — discount 0 | `category ?? "order"` makes it an order-wide coupon | **no** (S3) |

Thirty-one of the specification's thirty-two decisions are above: twelve agreed
outright, six agreed in part, thirteen diverged. The one left out is D-26 — how
many codes a customer may type and how often — which the specification assigns
to the checkout page rather than to the calculation, so neither engine contains
a code path to compare.

## Measured divergences

Identical `Order`, `Coupon[]` and `now` passed to `priceOrder` (A) and
`quoteOrder` (B). Totals include shipping of 4 900 for a UA order.

| # | Input | A | B | What the difference is |
|---|---|---|---|---|
| S1 | gold, 700 грн standard + 300 грн fresh, types `FRESH20` (20% fresh) then `SAVE15` (15% order-wide) | 81 400 — `SAVE15` applied, `FRESH20` superseded | 76 810 — tier, `FRESH20` and `SAVE15` all applied | 45,90 грн per order on the ticket's own example |
| S2 | no tier, one item at 10, coupon 7% | 4 910 — discount 0, rejected `too-small` | 4 909 — discount 1 | rounding direction: B gives more than the announced 7% |
| S3 | 1 000 грн standard, coupon 10% with `category: null` | 104 900 — discount 0, `no-effect` | 94 900 — 100 грн off the whole order | a broken catalog row discounts the entire basket |
| S4 | customer types `save10`, catalog holds `SAVE10` | 94 900 — applied | 104 900 — rejected `unknown-code` | B is case-sensitive |
| S5 | customer leaves the field blank (three spaces) | 104 900 — ignored, no rejection | 104 900 — rejected `unknown-code` | B shows "no such code" under an empty field |
| S6 | coupon with `expiresAt: "2026-02-30"`, now 2026-03-01 | 104 900 — rejected `expired` | 94 900 — applied | `Date.parse` rolls 30 February to 2 March; a one-character typo extends the campaign |
| S7 | `now` is `new Date("not a date")`, coupon expired in 2020 | 104 900 — rejected `expired` | 94 900 — applied | every expired coupon in the catalog becomes live |
| S8 | fixed coupon with `value: 1234.5` | 104 900 — discount 0, rejected `too-small` | 103 665 — discount 1234.5 | a fractional kopeck reaches `totalKopecks`, which is exactly what point 6 of the ticket forbids |
| S9 | same code typed twice | 94 900, no rejection shown | 94 900, `duplicate-code` shown | same money, different message to the customer |
| S10 | catalog holds `DUP` twice — 10% first, 50% second — code typed once | 94 900 — the first row applies | 54 900 — the second row applies | a duplicated row silently upgrades the campaign; 400 грн on a 1 000 грн basket |
| S11 | coupon with `kind: "bogus"`, `value: 10` | 104 900 — discount 0, rejected `too-small` | 104 890 — 10 kopecks off | an unreadable `kind` is billed as a fixed discount instead of being refused |
| S12 | coupon 10% with `minSubtotalKopecks: NaN` | 104 900 — rejected `min-subtotal` | 94 900 — applied | an unreadable threshold is treated as no threshold |

S1 is a pricing policy difference — both answers are defensible, and the
specification is what makes the choice reviewable. S3, S6, S7, S8, S10, S11 and
S12 are defects: they cost the store money or break the integer-kopecks rule,
and none of them is visible in Run B's own specification or test names. Every
row was produced by calling both engines — `app/src/discounts.ts` and
`docs/run-b/discounts.ts` — on the same input.

## Time and effort

| | A (with the specification) | B (ad-hoc) |
|---|---|---|
| Preparation — writing the specification (Task A), across 09-03 and 09-05 | 2 h 41 min over six sessions, 16 prompts | 0 |
| Tool cycle (Task B), 09-06 | 50 min over four sessions, 8 prompts | — |
| Implementation and tests (Task C), 09-06 | 42 min over two sessions, 4 prompts | 4 min 26 s, 1 prompt |
| Iterations — corrections after the first answer, 09-06 | 22 min over two sessions, 5 prompts | 0 |
| Prompts typed by the participant | **33** | **1** |
| Total | **4 h 35 min** | **4 min 26 s** |

Method: each figure is the span from the first to the last record of the Claude
Code session transcripts for this project, and each prompt count is the messages
the participant actually typed in them; a session on 09-05 that worked on
unrelated tooling is excluded. Session boundaries are the phase boundaries, so
the spans include reading, review rounds and idle time — this is the cost of the
phase to the participant, not the model's working time. The Task B and Task C
commit timestamps on this branch fall inside their spans. Task A's does not: the
specification was written on 09-03 and 09-05 and committed only on 09-06, so for
that phase the transcripts are the only record.

An earlier revision of this document put Task A at ~1 h 45 min and the total at
~3 h 30 min, from the git reflog alone. That undercounted: the reflog sees only
the sessions that ended in a commit, and the specification was written across
two earlier days. The corrected figure makes the specification more expensive,
not less, which is the direction that matters here.

## Conclusion

The ad-hoc run was not incompetent — it produced a written specification of its
own, 37 tests of its own, and it matched the specification on six of the eight
forks the ticket itself names. The specification did not win on the questions
the business already knew how to ask.

It won on the questions nobody asks. Seven of Run B's divergences are defects
rather than policy choices: a coupon dated 30 February stays valid for two extra
days, an invalid `now` revives every expired coupon, a fractional `value` puts a
fractional kopeck into the total, a `category` field holding `null` turns a
category coupon into an order-wide one, a threshold that is not a number stops
being a threshold, an unreadable `kind` is billed as a fixed discount, and a
duplicated catalog row lets the second one overwrite the first. On a 1 000 грн
basket the `null` category costs 100 грн and the duplicated row costs 400 грн.
Every one of them is triggered by catalog data rather than by anything the
customer does, and none of them appears in Run B's spec, in its test names, or
in its summary — so a reviewer without a specification in hand has nothing to
compare against and would have to find them by reading 260 lines of otherwise
reasonable code. The specification did not make the agent smarter; it made the
omission visible.

The price was 4 h 35 min and 33 prompts against 4 min 26 s and one — a factor of
about sixty — and the honest reading of that ratio is that most of it did not
pay for itself on a feature this size. The
first eight decisions — the ones the ticket lists — a good ticket could have
carried in two paragraphs, and Run B reached six of them unaided. What the
ticket cannot carry is the second layer: what happens when the catalog row is
wrong. That layer emerged only from writing acceptance criteria with concrete
numbers, and it is where the specification's remaining twenty-odd decisions
live. The break-even point for this project sits at exactly that boundary: below
it, a well-written ticket is enough; above it — anywhere the input is data
somebody else fills in — the ticket runs out and the acceptance criteria are the
only thing that finds the hole.
