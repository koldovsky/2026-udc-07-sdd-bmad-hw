# Traceability: pricing discounts

**Specification:** `docs/spec/pricing-discounts.md`  
**Implementation:** `app/src/discounts.ts`  
**Tests:** `app/src/discounts.test.ts`

## AC → code → tests

| AC | Behavior | Implementation | Test |
|---|---|---|---|
| AC-1 | Loyalty discounts merchandise, not shipping | `discounts.ts:priceOrder`, `roundPercentDiscount` | `AC-1: loyalty excludes shipping` |
| AC-2 | Loyalty then coupon percentage sequence | `discounts.ts:priceOrder`, `roundPercentDiscount` | `AC-2: loyalty and coupon stack sequentially` |
| AC-3 | Overlapping category coupons in input order | `discounts.ts:priceOrder`, `allocateDiscount` | `AC-3: overlapping coupons follow input order` |
| AC-4 | Trimmed, case-insensitive code applied once | `discounts.ts:normalizeCode`, `priceOrder` | `AC-4: a normalized code applies once` |
| AC-5 | Minimum evaluated from original subtotal | `discounts.ts:priceOrder` | `AC-5: minimum uses the original subtotal` |
| AC-6 | Category percentage uses its remaining balance | `discounts.ts:priceOrder`, `allocateDiscount` | `AC-6: a category coupon uses its remaining category balance` |
| AC-7 | Fixed category coupon cap and no spill | `discounts.ts:priceOrder`, `allocateDiscount` | `AC-7: a fixed category coupon is capped and does not spill` |
| AC-8 | Percentage half-up rounding once per operation | `discounts.ts:roundPercentDiscount` | `AC-8: exact halves round up once per percentage operation` |
| AC-9 | Coupon invalid at expiry instant | `discounts.ts:priceOrder` | `AC-9: the expiry instant is excluded` |
| AC-10 | Rejected code does not stop a later valid coupon | `discounts.ts:priceOrder`, `rejected` | `AC-10: rejected coupons do not stop valid coupons` |
| AC-11 | Missing category produces a structured rejection | `discounts.ts:hasOriginalCategory`, `rejected` | `AC-11: a missing category is a structured rejection` |
| AC-12 | Empty order has a zero-value result | `discounts.ts:priceOrder` | `AC-12: empty orders stay at zero` |
| AC-13 | Conflicting normalized definitions are invalid | `discounts.ts:normalizeCode`, `priceOrder`, `rejected` | `AC-13: conflicting coupon definitions are invalid` |
| AC-14 | Malformed expiry is invalid | `discounts.ts:priceOrder`, `rejected` | `AC-14: a malformed expiry is invalid` |
| AC-15 | Eligible coupon that rounds to zero is applied | `discounts.ts:roundPercentDiscount`, `priceOrder` | `AC-15: a zero-saving coupon is applied` |
| AC-16 | Below-minimum coupon is rejected | `discounts.ts:priceOrder`, `rejected` | `AC-16: below-minimum coupons are rejected` |

## Reverse traceability check

- **Does any new code behavior lack an AC?** No. AC-13 through AC-16 now cover the
  previously untested decision-table behaviors. Internal helpers only implement the
  observable behavior mapped by AC-1 through AC-16.
- **Does any AC lack a test?** No. AC-1 through AC-16 each have one named test.
- **Does any new test lack an AC?** No. Every test in `discounts.test.ts` is named
  after exactly one AC. The eight pre-existing tests in `pricing.test.ts` cover
  protected seeded behavior outside this discount feature.

## Result

All 16 ACs map to real implementation symbols and AC-named tests. The reverse check
found no new code behavior without an AC, no AC without a test, and no new test
without an AC. The four additional criteria make existing explicit decisions
independently testable; no product behavior was added or removed.
