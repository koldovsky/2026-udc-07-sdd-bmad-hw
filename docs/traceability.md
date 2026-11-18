# Traceability: spec → code → tests (Task C)

> Filled from `docs/templates/traceability.md`. Every acceptance criterion
> should show up in the implementation and in a test, and the reverse check
> should catch behaviour that the spec never asked for.

**Specification:** `docs/spec/pricing-discounts.md`
**Implementation:** `app/src/discounts.ts`
**Tests:** `app/src/discounts.test.ts`

## Table

One row per `AC-N` in the specification. No empty cells.

| AC | What it checks | Where implemented (file:symbol) | Test (name) | Status |
|---|---|---|---|---|
| AC-1 | Gold 10% tier on a 100 000 standard item; shipping added after | `discounts.ts:priceOrder` | `AC-1: gold tier on a standard item with no coupons` | ✅ |
| AC-2 | 15% coupon is taken from the after-tier amount, not added to the tier | `discounts.ts:couponBaseKopecks` | `AC-2: gold tier then a 15% whole-order coupon` | ✅ |
| AC-3 | Silver tier and a fixed coupon leave PL shipping undiscounted | `discounts.ts:priceOrder` | `AC-3: silver tier and fixed coupon leave shipping undiscounted` | ✅ |
| AC-4 | The larger whole-order coupon wins that scope | `discounts.ts:prefers` | `AC-4: larger whole-order coupon wins the scope` | ✅ |
| AC-5 | The larger fresh coupon wins on the after-tier fresh base | `discounts.ts:couponBaseKopecks` | `AC-5: larger fresh coupon wins the category scope` | ✅ |
| AC-6 | Two equal whole-order discounts apply once, not twice | `discounts.ts:prefers` | `AC-6: equal discounts resolve to one coupon` | ✅ |
| AC-7 | Whole-order and fresh coupons sum the same in either typing order | `discounts.ts:priceOrder` | `AC-7: whole-order and fresh coupons stack in either typing order` | ✅ |
| AC-8 | Half a kopeck of tier discount floors down | `discounts.ts:floorPercent` | `AC-8: half a kopeck of tier discount rounds down` | ✅ |
| AC-9 | Tier and coupon each floor on their own base | `discounts.ts:floorPercent` | `AC-9: tier and coupon each floor separately` | ✅ |
| AC-10 | A coupon applies when the subtotal equals `minSubtotalKopecks` | `discounts.ts:priceOrder` | `AC-10: coupon applies when subtotal equals the threshold` | ✅ |
| AC-11 | The threshold is the pre-discount subtotal, not the after-tier amount | `discounts.ts:priceOrder` | `AC-11: threshold uses the pre-discount subtotal` | ✅ |
| AC-12 | A coupon does not apply one kopeck below the threshold | `discounts.ts:priceOrder` | `AC-12: coupon does not apply one kopeck below the threshold` | ✅ |
| AC-13 | A fixed coupon is capped at its base, and shipping is still charged | `discounts.ts:couponAmountKopecks` | `AC-13: fixed coupon is capped at its base and shipping is still charged` | ✅ |
| AC-14 | Coupons from different scopes are summed, then capped at the after-tier amount | `discounts.ts:priceOrder` | `AC-14: cross-scope coupon sum is capped at the after-tier amount` | ✅ |
| AC-15 | A category coupon gives 0 when that category has no lines | `discounts.ts:couponBaseKopecks` | `AC-15: category coupon gives zero when the category is absent` | ✅ |
| AC-16 | An already-expired coupon is ignored and `priceOrder` does not throw | `discounts.ts:priceOrder` | `AC-16: expired coupon is ignored and does not throw` | ✅ |
| AC-17 | A coupon whose `expiresAt` equals `now` is expired | `discounts.ts:priceOrder` | `AC-17: coupon expiring exactly at now is ignored` | ✅ |
| AC-18 | The same coupon is valid one millisecond before `now` | `discounts.ts:priceOrder` | `AC-18: coupon is valid one millisecond before expiry` | ✅ |
| AC-19 | A typed code matches after trim and case-folding; an unknown code is ignored | `discounts.ts:foldCode` | `AC-19: typed code matches after trim and case-folding` | ✅ |
| AC-20 | The same code typed twice counts once | `discounts.ts:priceOrder` | `AC-20: a code typed twice counts once` | ✅ |
| AC-21 | An empty Gold order with a typed coupon prices to all zeros | `discounts.ts:priceOrder` | `AC-21: empty order prices to zero` | ✅ |
| AC-22 | Gold tier applies to a digital item and shipping is waived | `discounts.ts:priceOrder` | `AC-22: gold tier applies to a digital item and shipping is waived` | ✅ |
| AC-23 | A catalog coupon that was never typed is ignored | `discounts.ts:priceOrder` | `AC-23: a catalog coupon that was never typed is ignored` | ✅ |
| AC-24 | A category coupon's threshold uses the whole-order subtotal | `discounts.ts:priceOrder` | `AC-24: category coupon threshold uses the whole-order subtotal` | ✅ |
| AC-25 | Catalog `Coupon.code` is trimmed and case-folded the same way as a typed code | `discounts.ts:foldCode` | `AC-25: catalog code is normalised with trim and case-folding` | ✅ |
| AC-26 | With `now` omitted, a coupon expiring in 2099 still applies | `discounts.ts:priceOrder` | `AC-26: omitted now applies a coupon expiring in 2099` | ✅ |
| AC-27 | With `now` omitted, a coupon that expired in 2000 is ignored | `discounts.ts:priceOrder` | `AC-27: omitted now ignores a coupon that expired in 2000` | ✅ |
| AC-28 | Gold tier then 10% coupon, and `order` and `coupons` are unchanged afterwards | `discounts.ts:priceOrder` | `AC-28: order and coupons deep-equal their pre-call copies` | ✅ |

## Reverse check

- **Behaviour in the code with no AC?** Before this step, three behaviours had no criterion: catalog `Coupon.code` is passed through `foldCode` (trim + case-fold), `now` defaults to `new Date()` inside `priceOrder`, and `priceOrder` does not mutate `order` or `coupons`. Those are now AC-25, AC-26, AC-27 and AC-28, and D-10 plus the section 5 contract were updated to say so. Still without an AC by design: the D-3 tie-break (earlier `expiresAt`, then earlier typed position, in `prefers`). Tied coupons produce the same `PriceBreakdown`, which D-3 already says needs no AC. Kept, and still without an AC, because they sit inside D-13's undefined behaviour: a duplicate catalog code keeps the first `Coupon` (`catalog.has` before `set`), and an unparseable `expiresAt` makes `new Date(...).getTime()` NaN so `now < expiresAt` is false and the coupon is ignored. D-13 says that input is invalid and that validation is out of scope, so the engine does not grow a rule for it; both are just how a single map entry and a single instant comparison fall out.
- **AC without a test?** none
- **Test without an AC?** none

## What came out

The reverse check found three mismatches: catalog-code normalisation, the default clock, and input purity were all real behaviour with no acceptance criterion. The spec had to change after the code was written, so Task A had left those edges implied instead of the implementation inventing a pricing rule. The catalog-trim gap was first raised by OpenSpec's `design.md`, but no AC was written until this check. The D-3 tie-break and the two D-13 fill-ins were looked at and left without new criteria, because the spec already calls the tie-break unobservable and calls the invalid inputs undefined.
