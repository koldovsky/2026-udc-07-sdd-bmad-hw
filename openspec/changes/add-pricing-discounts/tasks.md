## 1. Setup and Core Implementation

- [ ] 1.1 Create `app/src/discounts.ts` module with `discountPrice()` function signature matching the contract in spec and stub implementations. Verify file exists and TypeScript compiles without errors.

- [ ] 1.2 Implement tier loyalty discount calculation: apply `tierPercent(order)` to subtotal. Verify test AC-1 passes (Gold customer, 10% discount).

- [ ] 1.3 Implement coupon-by-coupon sequential application: loop through coupons, applying each to the remaining subtotal after previous discounts. Verify tests AC-2 and AC-3 pass.

## 2. Coupon Types and Conditions

- [ ] 2.1 Handle percent-based coupons: calculate percentage of the base amount (category-specific or global). Verify coupon with `kind: "percent"` works correctly.

- [ ] 2.2 Handle fixed-amount coupons: deduct fixed amount in kopecks from the base. Verify coupon with `kind: "fixed"` works correctly.

- [ ] 2.3 Implement category-specific coupon filtering: when coupon has `category` field, calculate discount only from items in that category. Verify test AC-7 passes (coupon on fresh, but no fresh items = 0 discount).

- [ ] 2.4 Implement expiration date check: ignore coupons where `expiresAt` ≤ today. Verify test AC-2 passes (expired coupon ignored). Add parameter `today?: string` to function for testability.

- [ ] 2.5 Implement minimum order amount check: only apply coupon if subtotal (before applying this coupon) meets `minSubtotalKopecks`. Verify test AC-5 passes.

## 3. Rounding and Edge Cases

- [ ] 3.1 Implement single-point rounding at final subtotal: perform all discount calculations with floating-point precision, then round the final subtotal result to nearest kopeck (0.5→1). Verify test AC-8 passes (0.5 kopecks rounds up to 1).

- [ ] 3.2 Implement lower bound: ensure total never goes below 0 kopecks (clamp to 0). Verify test AC-4 passes (coupon > subtotal = 0 payment).

- [ ] 3.3 Handle empty order (zero items): calculate subtotal correctly as 0, apply no discounts, return proper breakdown. Verify test AC-10 passes.

## 4. Price Breakdown and API

- [ ] 4.1 Return complete `PriceBreakdown` object with: `subtotalKopecks`, `tierDiscountKopecks`, `couponDiscountKopecks`, `shippingKopecks`, `totalKopecks`. Verify structure matches contract in spec.

- [ ] 4.2 Verify total calculation: `totalKopecks = subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks + shippingKopecks`, and total ≥ 0. Verify test AC-1 passes (total = 90,000 + 4,900 = 94,900).

## 5. Integration and Testing

- [ ] 5.1 Write comprehensive test suite covering all acceptance criteria AC-1 through AC-10. Each test named by its AC ID (e.g., `test: AC-1: Gold customer without coupons`). Verify `cd app && npm test` runs without errors.

- [ ] 5.2 Test suite includes boundary cases: empty order (AC-10), zero discount scenarios, coupons exceeding subtotal (AC-4), rounding edge cases (AC-8), expired coupons (AC-2), missing categories (AC-7). Verify all tests pass.

- [ ] 5.3 Verify existing tests still pass: `cd app && npm test` shows 8 green tests (existing behavior) + new tests (new behavior). No test regressions.

- [ ] 5.4 Create `docs/traceability.md` mapping: each AC → code location → test name. Verify every AC has exactly one test; no AC is untested; no test is orphaned. Verify reverse check finds no unused code paths.

## 6. Documentation and Finalization

- [ ] 6.1 Add JSDoc comments to `discountPrice()` function explaining parameters, return type, and key behaviors (sequential application, rounding rule, edge cases). Verify TypeScript doc generation works.

- [ ] 6.2 Verify no TypeScript errors: `cd app && npx tsc --noEmit`. Verify code follows project conventions (naming, structure, style).

- [ ] 6.3 Final smoke test: manually call `discountPrice()` with test cases (Gold customer, multiple coupons, expired coupon, empty order) and verify breakdown structure and totals are correct.
