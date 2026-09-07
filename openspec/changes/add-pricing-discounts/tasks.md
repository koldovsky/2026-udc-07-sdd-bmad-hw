## 1. Public discount API

- [x] 1.1 Create `app/src/discounts.ts` with the agreed `PriceBreakdown`, coupon-result types, and pure `priceOrder` signature; verify `npm run typecheck` passes.
- [x] 1.2 Export the discount API from `app/src/index.ts` without changing protected types or pricing helpers; verify existing imports and `npm run typecheck` pass.

## 2. Discount calculation

- [x] 2.1 Implement merchandise subtotal, loyalty-first sequencing, shipping composition, and operation-level half-up percentage rounding; verify AC-1, AC-2, and AC-8 tests pass.
- [x] 2.2 Implement remaining category balances, proportional order-wide allocation, ordered overlapping coupons, fixed-category application, and per-balance caps; verify AC-3, AC-6, and AC-7 tests pass.
- [x] 2.3 Implement code normalization, supplied-coupon matching, duplicate detection, minimum and category eligibility, expiry evaluation, and structured rejection results; verify AC-4, AC-5, and AC-9 through AC-11 tests pass.
- [x] 2.4 Implement the empty-order result while keeping calculation input-pure; verify AC-12 passes and no existing pricing test regresses.

## 3. Acceptance tests and verification

- [x] 3.1 Add focused `discounts` tests named `AC-1` through `AC-16`, with explicit dates and the exact values in `specs/pricing-discounts/spec.md`; verify `npm test` reports all AC-named tests passing.
- [x] 3.2 Run the complete validation suite with `cd app && npm test && npm run typecheck`; verify the existing eight pricing tests and all new discount tests pass.
