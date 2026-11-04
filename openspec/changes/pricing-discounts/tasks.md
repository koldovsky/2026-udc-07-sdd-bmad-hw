# Tasks

Use the [source specification](../../../docs/spec/pricing-discounts.md) for inputs, expected amounts, and the public contract. Use the [design](design.md) for the implementation approach.

## 1. Quote implementation and acceptance tests

- [ ] 1.1 Implement the contract in `app/src/discounts.ts`, reusing the seeded helpers and exact rounding described in the design. Verify with tasks 1.2–1.15 and `npm run typecheck` from `app/`.
- [ ] 1.2 Add a Vitest test named `AC-1: Gold loyalty without coupons` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.3 Add a Vitest test named `AC-2: Exclusive expiration at minus one, zero, and plus one millisecond` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.4 Add a Vitest test named `AC-3: Best of two coupons targeting the same category in both entry orders` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.5 Add a Vitest test named `AC-4: Fixed discount capped at subtotal before Gold loyalty` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.6 Add a Vitest test named `AC-5: Silver loyalty applied after the coupon` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.7 Add a Vitest test named `AC-6: Aggregate loyalty rounding at half a kopeck` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.8 Add a Vitest test named `AC-7: Empty basket returns five zero amounts` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.9 Add a Vitest test named `AC-8: Whole-order minimum at equality and one kopeck below` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.10 Add a Vitest test named `AC-9: Compare candidates after capping the category discount` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.11 Add a Vitest test named `AC-10: Fixed category coupon with no eligible merchandise` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.12 Add a Vitest test named `AC-11: Exact code matching, unknown codes, and duplicates` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.13 Add a Vitest test named `AC-12: Aggregate coupon rounding on digital lines with free shipping` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.14 Add a Vitest test named `AC-13: International shipping excluded from discounts` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.
- [ ] 1.15 Add a Vitest test named `AC-14: Equal coupon amounts in both entry orders with identical public breakdowns` in `app/src/discounts.test.ts` and assert the source scenario's exact expected results.

## 2. Integration and traceability

- [ ] 2.1 Run `npm test` from `app/` and verify that the eight seeded tests and tests named for AC-1 through AC-14 pass.
- [ ] 2.2 Complete `docs/traceability.md` with one row per AC linking to real implementation and test locations, and verify the reverse check accounts for each added behavior.
