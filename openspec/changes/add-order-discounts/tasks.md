# Tasks

All code goes in `app/src/discounts.ts`; all tests go in
`app/src/discounts.test.ts`, each named `AC-N: ...` and using the shared
fixture from `specs/order-discounts/spec.md` (`now` passed explicitly, except AC-26 and AC-27, which omit it).
Run commands from `app/`.

## 1. Contract and tier discount

- [ ] 1.1 Create `app/src/discounts.ts` with the `PriceBreakdown` interface and `priceOrder(order, coupons, now = new Date())` exactly as in spec section 5, reusing `subtotalKopecks`, `shippingKopecks`, `tierPercent` from `./pricing.js`; verify `npm run typecheck` passes and test AC-28 (order and coupons unchanged after the call) passes
- [ ] 1.2 Re-export `priceOrder` and `type PriceBreakdown` from `app/src/index.ts`; verify `npm run typecheck` passes and the 8 existing `pricing.test.ts` tests stay green
- [ ] 1.3 Implement the module-private integer `floorPercent` and the tier discount on the full item subtotal, plus `total = subtotal - tier - coupon + shipping` (D-1, D-2, D-4, D-12); verify tests AC-1, AC-8, AC-22 pass
- [ ] 1.4 Add test AC-21 (empty order with a typed valid coupon prices to all zeros, D-14) and verify it passes

## 2. Coupon resolution and eligibility

- [ ] 2.1 Resolve typed codes to catalog coupons with trim + case-insensitive matching on both the typed string and catalog `Coupon.code`, ignore unknown codes, count repeated codes once at first position, ignore untyped catalog coupons (D-10, D-17); verify tests AC-19, AC-20, AC-23, AC-25 pass
- [ ] 2.2 Filter by expiry `now < expiresAt` comparing instants, silently and without throwing, using the current time when `now` is omitted (D-8, D-9); verify tests AC-16, AC-17, AC-18, AC-26, AC-27 pass
- [ ] 2.3 Filter by `minSubtotalKopecks` against the pre-discount whole-order subtotal, also for category coupons (D-6); verify tests AC-10, AC-11, AC-12, AC-24 pass

## 3. Coupon discounts, scopes and cap

- [ ] 3.1 Compute each coupon's base (whole-order: after-tier subtotal; category: `catSubtotal - floor(catSubtotal * tierPercent / 100)`, 0 if absent) and its discount (percent floored, fixed `min(value, base)`) (D-1, D-4, D-5, D-11); verify tests AC-2, AC-3, AC-9, AC-15 pass
- [ ] 3.2 Pick one winner per scope by larger discount, then earlier `expiresAt`, then earlier typed position (D-3); verify tests AC-4, AC-5, AC-6 pass
- [ ] 3.3 Sum winners of different scopes computed independently and cap the sum at `subtotal - tierDiscount` (D-7, D-16); verify tests AC-7 (both typing orders), AC-13, AC-14 pass

## 4. Integration check

- [ ] 4.1 Run `npm test` and `npm run typecheck`; verify both are green, the 8 pre-existing tests still pass, and every id AC-1 … AC-28 appears in the test output at least once
- [ ] 4.2 Verify `app/src/pricing.ts` and `app/src/types.ts` are unchanged (`git diff --stat -- app/src/pricing.ts app/src/types.ts` is empty) and `discounts.ts` exports nothing beyond `priceOrder` and `PriceBreakdown`
