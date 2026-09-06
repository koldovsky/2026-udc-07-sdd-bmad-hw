# A/B validation: specification vs ad-hoc (Task D)

**Feature:** discounts from `materials/feature-request.md`
**Host / model:** Claude Code / Opus 5, both runs
**Date:** 2026-09-06

## How the experiment was isolated

Run B was executed in a separate working copy at `~/Projects/ws07-run-b`, built
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

Run B received one message — the implementation request — and no answers to any
question. Nothing from `docs/spec/pricing-discounts.md` was quoted to it.

## Run A — with the specification

Given `docs/spec/pricing-discounts.md` and asked to implement it.

- **Output:** `app/src/discounts.ts` (`priceOrder(order, catalog, now)`, a
  twelve-step calculation split into named functions), `app/src/discounts.test.ts`,
  `docs/traceability.md`.
- **Decisions on the ambiguities:** taken from the specification, which closes
  32 of them (D-1 … D-32) with a recorded reason for each. The implementation
  added none of its own; the reverse traceability check in `docs/traceability.md`
  records the search for unrequested behaviour.
- **Tests:** 60, each named after the acceptance criterion it covers (AC-1 …
  AC-60), plus the 8 seeded `pricing` tests. Branch coverage of `discounts.ts`
  is 100%. Edge cases are covered because the specification required them:
  empty order, discount larger than the subtotal, half-kopeck rounding, invalid
  `now`, impossible calendar dates, non-integer coupon values.

## Run B — ad-hoc

New session, same model, only the ticket.

- **Output:** `docs/discount-spec.md` (11 decisions, D1 … D11, each with a
  reason), `app/src/discounts.ts` (`quoteOrder(order, catalog?, now?)` returning
  a breakdown with a per-discount list), `app/src/discounts.test.ts`, exports
  added to `app/src/index.ts`. 45 tests green, typecheck clean, seeded
  signatures untouched.
- **Forks it closed deliberately:** sequential stacking, goods-only base,
  category base after the tier, threshold against the untouched subtotal,
  explicit rejection reasons, a floor at zero, clamping of out-of-range catalog
  percentages. On all of these it reasoned in writing and reached the same
  answer as the specification.
- **Forks it closed silently** — no mention in its own spec, no test, no
  comment: case and whitespace normalisation of typed codes, a blank coupon
  field, calendar-impossible expiry dates, an `expiresAt` without a UTC offset,
  an invalid `now`, a non-integer coupon value, and a `category` field that is
  `null` rather than absent.

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
| D-11 duplicate code | collapsed silently, never shown as a failure | rejected as `duplicate-code`, shown to the customer | **no** (S9) |
| D-15 case and whitespace | normalised before lookup | exact string match | **no** (S4) |
| D-16 zero-value discount | `no-effect` or `too-small`, split by whether the category is present in the basket | one `no-effect` reason for both | partial |
| D-19 rejected code echoed back | catalog spelling for known codes, typed string for unknown ones | typed string always | partial |
| D-20 impossible calendar date | explicit round-trip check; rejected as `expired` | `Date.parse` rolls the date forward; the coupon stays live | **no** (S6) |
| D-21 blank coupon field | ignored entirely | rejected as `unknown-code` | **no** (S5) |
| D-24 `expiresAt` without an offset | rejected; only `YYYY-MM-DD` or an explicit offset is accepted | parsed as server-local time | **no** |
| D-25 invalid `now` | every coupon rejected as `expired` | `NaN >= x` is false, so every coupon applies | **no** (S7) |
| D-27 non-integer `value` | discount 0 | a fractional discount reaches the total | **no** (S8) |
| D-32 `category: null` | treated as a category coupon with an empty category — discount 0 | `category ?? "order"` makes it an order-wide coupon | **no** (S3) |

Of the nineteen forks compared: five agreed outright, four agreed in part, ten
diverged.

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

S1 is a pricing policy difference — both answers are defensible, and the
specification is what makes the choice reviewable. S3, S6, S7 and S8 are
defects: they cost the store money or break the integer-kopecks rule, and none
of them is visible in Run B's own specification or test names.

## Time and effort

| | A (with the specification) | B (ad-hoc) |
|---|---|---|
| Preparation — writing the specification (Task A) | ~1 h 45 min, ended 13:37 | 0 |
| Tool cycle (Task B) | 41 min (13:37 → 14:18) | — |
| Implementation and tests (Task C) | 43 min (14:18 → 15:01) | 4 min 01 s |
| Follow-up corrections | 23 min (15:01 → 15:24) | 0 |
| Messages sent by the participant | tens, across the session | 1 |
| Total | ~3 h 30 min | 4 min |

Timings for A come from the git reflog of this branch and the mtime of the
OpenSpec artifacts; the Task A figure is the least precise of them.

## Conclusion

The ad-hoc run was not incompetent — it produced a written specification of its
own, 45 tests, and it matched the specification on six of the eight forks the
ticket itself names. The specification did not win on the questions the business
already knew how to ask.

It won on the questions nobody asks. Four of Run B's divergences are defects
rather than policy choices: a coupon dated 30 February stays valid for two extra
days, an invalid `now` revives every expired coupon, a fractional `value` puts a
fractional kopeck into the total, and a `category` field holding `null` turns a
category coupon into an order-wide one. On a 1 000 грн basket the last one costs
100 грн. None of these appears in Run B's spec, in its test names, or in its
summary — so a reviewer without a specification in hand has nothing to compare
against and would have to find them by reading 260 lines of otherwise reasonable
code. The specification did not make the agent smarter; it made the omission
visible.

The price was roughly 3 h 30 min against 4 min, and the honest reading of that
ratio is that most of it did not pay for itself on a feature this size. The
first eight decisions — the ones the ticket lists — a good ticket could have
carried in two paragraphs, and Run B reached six of them unaided. What the
ticket cannot carry is the second layer: what happens when the catalog row is
wrong. That layer emerged only from writing acceptance criteria with concrete
numbers, and it is where the specification's remaining twenty-odd decisions
live. The break-even point for this project sits at exactly that boundary: below
it, a well-written ticket is enough; above it — anywhere the input is data
somebody else fills in — the ticket runs out and the acceptance criteria are the
only thing that finds the hole.
