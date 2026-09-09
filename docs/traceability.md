# Traceability: spec → code → tests (Task C)

**Specification:** `docs/spec/pricing-discounts.md` (19 decisions D-1…D-19,
19 acceptance criteria AC-1…AC-19)
**Implementation:** `app/src/discounts.ts`
**Tests:** `app/src/discounts.test.ts` (19 tests, all AC-named)
**Also in sync:** `openspec/changes/add-order-discounts/specs/order-discounts/spec.md`
(21 scenarios — the 19 criteria plus two `AND` continuations)

`cd app && npm test` → 27 passed (19 here + the 8 seeded tests in
`pricing.test.ts`). `npm run typecheck` clean.

## Table

One row per `AC-N`. All test names are quoted exactly as they appear in vitest
output.

| AC | What it checks | Implemented in (file:symbol) | Test (name) | Status |
|---|---|---|---|---|
| AC-1 | Gold tier applies; shipping not discounted | `discounts.ts:priceOrder` → `tierDiscount` | `AC-1: gold tier on a plain order, shipping untouched` | ✅ |
| AC-2 | Tier + coupon stack sequentially, not additively | `discounts.ts:priceOrder` → `remaining = subtotal - tierDiscount` | `AC-2: tier and coupon stack sequentially, not additively` | ✅ |
| AC-3 | Second coupon on one category refused | `discounts.ts:priceOrder` → `usedScopes` / `"duplicate-scope"` | `AC-3: two coupons on the same category — the second is refused` | ✅ |
| AC-4 | Fixed coupon clamps; total floors at shipping | `discounts.ts:priceOrder` → `Math.min(raw, remaining)`, `Math.max(0, …)` | `AC-4: a fixed coupon larger than the order clamps, and the total floors at shipping` | ✅ |
| AC-5 | Half kopeck on a tier discount rounds up | `discounts.ts:roundHalfUp` | `AC-5: half a kopeck on a tier discount rounds up` | ✅ |
| AC-6 | Half kopeck on a coupon discount rounds up | `discounts.ts:roundHalfUp` | `AC-6: half a kopeck on a coupon discount rounds up` | ✅ |
| AC-7 | `now == expiresAt` refuses, does not throw | `discounts.ts:priceOrder` → `now.getTime() >= Date.parse(...)` | `AC-7: a coupon at the exact instant it expires is refused, without throwing` | ✅ |
| AC-8 | Code absent from the catalog | `discounts.ts:priceOrder` → `catalog.find` / `"unknown"` | `AC-8: a code the catalog does not contain is refused as unknown` | ✅ |
| AC-9 | Minimum judged on gross subtotal, inclusive | `discounts.ts:priceOrder` → `subtotal < coupon.minSubtotalKopecks` | `AC-9: a subtotal exactly at the minimum satisfies it, judged before discounts` | ✅ |
| AC-10 | Below the minimum → refused | `discounts.ts:priceOrder` → `"below-min-subtotal"` | `AC-10: a subtotal just below the minimum refuses the coupon` | ✅ |
| AC-11 | Category coupon uses its post-tier category base | `discounts.ts:priceOrder` → `categoryBase`, `categorySubtotals` | `AC-11: a category coupon uses its own category's post-tier base` | ✅ |
| AC-12 | Empty order prices to 0; code refused | `discounts.ts:priceOrder` → `base <= 0` / `"no-eligible-items"` | `AC-12: an order with no items prices to zero and refuses the code` | ✅ |
| AC-13 | Category absent from the order | `discounts.ts:priceOrder` → `categoryBase.get(...) ?? 0` | `AC-13: a category coupon with no items in that category is refused` | ✅ |
| AC-14 | Same code twice applies once | `discounts.ts:priceOrder` → `seenCodes` / `"duplicate-code"` | `AC-14: the same code entered twice applies once` | ✅ |
| AC-15 | Category + order-wide coupon stack in typed order | `discounts.ts:priceOrder` → `for (const code of order.coupons)` | `AC-15: a category coupon and an order-wide coupon stack in typed order` | ✅ |
| AC-16 | Breakdown reconciles; every code accounted for | `discounts.ts:priceOrder` return object | `AC-16: the breakdown reconciles on every fixture in this suite` + `expectInvariants` called from all 19 tests | ✅ |
| AC-17 | Tier on digital items; no shipping to discount | `discounts.ts:priceOrder` + `pricing.ts:shippingKopecks` (reused) | `AC-17: the tier applies to digital items, where there is no shipping to discount` | ✅ |
| AC-18 | Matching is exact and case-sensitive | `discounts.ts:priceOrder` → `candidate.code === code` | `AC-18: code matching is exact and case-sensitive` | ✅ added in Task C |
| AC-19 | No mutation of inputs; deterministic | `discounts.ts:priceOrder` (pure; local `Map`/`Set` only) | `AC-19: pricing does not modify its inputs and repeats identically` | ✅ added in Task C |

## Reverse check

Walking backwards, from the code to the specification.

### Is there behaviour in the code that no AC asked for?

**Four found by this pass** — two closed by amending the spec, two named and left
with reasons — **plus a fifth (#5) added later, found by Task D's A/B rather than
by this walk.**

1. **Exact, case-sensitive code matching.** `catalog.find(c => c.code === code)`
   makes `save10` ≠ `SAVE10` — a user-visible outcome. It was a deliberate
   decision (D-10) and it was in the requirement text, but **no acceptance
   criterion pinned it down**, so nothing would have failed had the
   implementation quietly lower-cased both sides. → **Closed:** added **AC-18**
   to `docs/spec/pricing-discounts.md` §4, a matching scenario to the OpenSpec
   delta, and the test `AC-18: code matching is exact and case-sensitive`. The
   code was not changed — the behaviour was right, the coverage was missing.
2. **Purity and determinism.** D-17 says `priceOrder` mutates nothing and reads
   no clock, and the OpenSpec requirement text says so too, but again no
   criterion tested it. A future refactor that sorted `order.coupons` in place
   would have passed every one of the original 17 tests. → **Closed:** added
   **AC-19** plus the test `AC-19: pricing does not modify its inputs and repeats
   identically`, which snapshots both inputs with `structuredClone` and prices
   twice.
3. **Refusal precedence.** When a code fails two checks at once — say it is both
   expired *and* below the minimum — the reported reason is whichever the ladder
   hits first (`duplicate-code` → `unknown` → `expired` →
   `below-min-subtotal` → `duplicate-scope` → `no-eligible-items`). That order
   **is** specified, in §3's algorithm step 5, so it is not unspecified
   behaviour — but no AC exercises a conflict, so the precedence is untested.
   → **Left open deliberately.** It affects only which of two true reasons the UI
   shows, never an amount. If it ever matters to support, the fix is one more
   criterion, not a code change. Named here so it is a known gap rather than a
   silent one.
4. **A malformed `expiresAt` is treated as valid.** `Date.parse("nonsense")` is
   `NaN`, and `now >= NaN` is `false`, so a coupon with an unparseable expiry
   applies. → **Left open deliberately**, and it is consistent with the spec:
   catalog validation is explicitly out of scope (§2), because the catalog is
   trusted input. Worth stating out loud, because "out of scope" and "we know
   exactly how it behaves anyway" are different claims, and this is the second.
5. **A negative fixed `value` raises the price.** Added here after **Task D**
   measured it, not by this reverse pass — `Math.min(value, base)` on
   `value: -5_000` yields a discount of −5 000, so a 100 000 order with 4 900
   shipping totals **109 900 instead of 104 900**: a coupon that makes the basket
   more expensive. AC-16 passes throughout, because the components still
   reconcile exactly. → **Left as-is by decision**, consistent with §2 putting
   catalog validation out of scope. Two things must be said plainly, though: the
   sentence in §2 claiming "the clamps in D-7/D-12 keep the total sane regardless"
   is **false** as written, and both ad-hoc implementations in
   `docs/ab-validation.md` clamped this at zero without being asked to. The fix,
   if it is ever wanted, is one `Math.max(0, …)` plus an acceptance criterion.

> That the fifth finding came from Task D rather than from this reverse check is
> itself the honest verdict on the reverse check: walking spec → code → test
> catches decisions that lost their test, but not decisions whose *consequences*
> were never imagined. Running a second, independent implementation against the
> same ticket caught two of those (this one, and the order-wide-then-category
> interaction in `docs/ab-validation.md`) that no amount of re-reading my own
> table would have surfaced.

### Is there an AC with no test?

**None.** All 19 criteria have a test named after them; verified by grepping
`AC-n` for n = 1…19 across the spec, the test file, this document and the
OpenSpec delta rather than by reading down the list.

### Is there a test that maps to no AC?

**None in `discounts.test.ts`** — all 19 tests carry an AC id, and the shared
`expectInvariants` helper plus the `item()`/`order()`/`coupon()` fixture builders
are machinery called by those tests, not tests in their own right.

**But the 8 tests in `pricing.test.ts` map to no AC**, and that is correct rather
than a defect: they cover the seeded contract (`lineTotalKopecks`,
`subtotalKopecks`, `shippingKopecks`, `tierPercent`) which existed and was
already specified before this feature. This specification deliberately consumes
that behaviour instead of restating it — AC-17's shipping figure, for instance,
relies on the waiver those tests protect. They stayed green and untouched
throughout.

## What came out of this

The reverse pass found **four** discrepancies, none of which the forward pass
would have caught: the table AC → code → test was already complete and green
before I walked it backwards. Two were real coverage holes on decisions the spec
had made and the code had honoured — case-sensitive matching and purity — which
is the more interesting failure mode than the one the exercise advertises: not
"the code did something unasked", but "the code did the right thing and nothing
would have noticed if it stopped".

The spec did have to change after the code existed, twice, which says the spec
was incomplete rather than that reality was more complicated: both gaps were
decisions I had written down in §3 and then failed to promote into a criterion.
That is a specific, repeatable authoring mistake — a decision table and an AC
list drift apart because nothing links them — and the cheap fix is to check every
`D-n` for a matching `AC-n` before declaring the spec ready, not just to count
that there are eight or more criteria.

The two gaps left open are recorded above with the reasoning, and both are
one-criterion fixes if they ever matter. Nothing was deleted from the
implementation: no unrequested behaviour survived into the code, which I attribute
less to discipline than to the spec having stated the algorithm step by step, so
there was little room to improvise.
