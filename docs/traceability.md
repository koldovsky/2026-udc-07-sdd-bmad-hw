# Traceability from spec to code and tests (Task C)

**Specification** [docs/spec/pricing-discounts.md](spec/pricing-discounts.md)
**Implementation** [app/src/discounts.ts](../app/src/discounts.ts)
**Tests** [app/src/discounts.test.ts](../app/src/discounts.test.ts)

## Mapping

| AC | What it verifies | Implementation (file and symbol) | Exact test name | Status |
|---|---|---|---|---|
| AC-1 | Gold loyalty rate and total | `app/src/discounts.ts:priceOrder`, `app/src/discounts.ts:roundedPercent` | `AC-1: Gold loyalty without coupons` | Passed |
| AC-2 | Exclusive expiry cutoff | `app/src/discounts.ts:bestCouponDiscount` | `AC-2: Exclusive expiration at minus one, zero, and plus one millisecond` | Passed |
| AC-3 | Best category coupon in either order | `app/src/discounts.ts:bestCouponDiscount`, `app/src/discounts.ts:couponAmount` | `AC-3: Best of two coupons targeting the same category in both entry orders` | Passed |
| AC-4 | Fixed cap and zero remaining loyalty base | `app/src/discounts.ts:couponAmount`, `app/src/discounts.ts:priceOrder` | `AC-4: Fixed discount capped at subtotal before Gold loyalty` | Passed |
| AC-5 | Coupon before Silver loyalty | `app/src/discounts.ts:couponAmount`, `app/src/discounts.ts:priceOrder` | `AC-5: Silver loyalty applied after the coupon` | Passed |
| AC-6 | Half-up rounding on the aggregate loyalty base, including D-4 exact intermediates for large values | `app/src/discounts.ts:priceOrder`, `app/src/discounts.ts:roundedPercent` | `AC-6: Aggregate loyalty rounding at half a kopeck`; `AC-6 / D-4: Gold loyalty rounds exactly for a large base` | Passed |
| AC-7 | Five zero amounts on an empty basket | `app/src/discounts.ts:priceOrder`, `app/src/discounts.ts:couponAmount` | `AC-7: Empty basket returns five zero amounts` | Passed |
| AC-8 | Minimum based on original whole-order subtotal | `app/src/discounts.ts:bestCouponDiscount` | `AC-8: Whole-order minimum at equality and one kopeck below` | Passed |
| AC-9 | Category cap applied before comparison | `app/src/discounts.ts:couponAmount`, `app/src/discounts.ts:bestCouponDiscount` | `AC-9: Compare candidates after capping the category discount` | Passed |
| AC-10 | Zero fixed discount for an absent category | `app/src/discounts.ts:couponAmount` | `AC-10: Fixed category coupon with no eligible merchandise` | Passed |
| AC-11 | Exact lookup, ignored unknown codes, and duplicate entries | `app/src/discounts.ts:bestCouponDiscount` | `AC-11: Exact code matching, unknown codes, and duplicates` | Passed |
| AC-12 | Aggregate coupon rounding and digital shipping | `app/src/discounts.ts:couponAmount`, `app/src/discounts.ts:roundedPercent`, `app/src/discounts.ts:priceOrder` | `AC-12: Aggregate coupon rounding on digital lines with free shipping` | Passed |
| AC-13 | International shipping added after discounts | `app/src/discounts.ts:priceOrder`, `app/src/discounts.ts:couponAmount` | `AC-13: International shipping excluded from discounts` | Passed |
| AC-14 | Equal discounts and breakdown without code identity | `app/src/discounts.ts:bestCouponDiscount`, `app/src/discounts.ts:priceOrder` | `AC-14: Equal coupon amounts in both entry orders with identical public breakdowns` | Passed |

## Reverse check

- **Behavior without an AC** — The contract requires input preservation and use of the supplied time without reading the system clock. AC-2 exercises the supplied time at the expiry boundary, but no AC directly asserts either purity guarantee. D-4 requires exact arithmetic across the safe-integer input range; the additional `AC-6 / D-4` regression test directly checks large-value loyalty rounding, beyond the small amounts in AC-6 and AC-12. D-7 specifies that a fixed face value applies once regardless of line count or quantity, which no AC isolates on a qualifying multi-line or multi-unit basket. These rules are present in the specification.
- **ACs without a test** — None. AC-14 verifies identical public results in both entry orders. The strict `>` comparison in `bestCouponDiscount` was checked by inspection because the result does not expose the winner.
- **Tests without an AC** — None in `discounts.test.ts`. The eight seeded tests in `pricing.test.ts` cover the existing line total, subtotal, shipping, and tier helper contracts independently of the discount ACs.

## Outcome

The reverse check found gaps in direct AC coverage for purity, large-value arithmetic, and fixed face value across units or lines. The PR review follow-up added a regression test for large-value arithmetic under AC-6 and D-4. No added behavior fell outside the specification, and the review required no specification edits. All 15 discount tests and eight seeded tests passed.
