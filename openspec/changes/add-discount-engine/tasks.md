## 1. Engine scaffold

- [x] 1.1 Create `app/src/discounts.ts` exporting the `PriceBreakdown` interface and a `priceOrder(order: Order, catalog: Coupon[], now?: Date): PriceBreakdown` stub; verify `npm run typecheck` passes with the stub returning zeros.
- [x] 1.2 Add internal helpers `percentOf(base, pct)` (half-up, `pct` clamped to `[0,100]`, non-finite/negative → 0), `isExpired(coupon, now)` (`now >= Date.parse(expiresAt)`, `NaN` → expired), `categorySubtotalKopecks(order, category)`; verify with a small inline unit test for `percentOf(1005, 50) === 503`.

## 2. Core pricing

- [x] 2.1 Implement the tier step: `tierDiscountKopecks = percentOf(subtotalKopecks(order), tierPercent(order))`; seed `remaining = max(0, subtotal - tierDiscount)`. Verify AC-1, AC-2, AC-3 tests pass.
- [x] 2.2 Implement the coupon loop over `order.coupons`: dedupe by first occurrence, look up in a `Map`, skip on unknown / expired / `minSubtotalKopecks` (checked against raw subtotal) / category already discounted. Verify AC-12, AC-13, AC-14, AC-15a pass.
- [x] 2.3 Implement discount computation per coupon: base = category line-sum when `category` set else `remaining`; `percent` → `percentOf(base, value)`, `fixed` → `min(value, base)`; then `discount = min(discount, remaining)`; skip when `discount <= 0` (no `appliedCoupons` entry, no category slot). Verify AC-4, AC-5, AC-6, AC-7, AC-16, AC-19 pass.
- [x] 2.4 Assemble the result: `couponDiscountKopecks` = sum of applied discounts, `totalKopecks = remaining + shippingKopecks(order)`, `appliedCoupons` in application order. Verify AC-8, AC-9, AC-17, AC-18 pass.

## 3. Edge cases and wiring

- [x] 3.1 Confirm the empty-order path (`items: []`) needs no special-casing and returns all zeros; verify AC-10 passes and `priceOrder` does not throw.
- [x] 3.2 Re-export `priceOrder` and `PriceBreakdown` from `app/src/index.ts`; verify `npm run typecheck` passes.

## 4. Verification

- [x] 4.1 Write `app/src/discounts.test.ts` with one `describe`/`it` per acceptance criterion, each named `AC-N: <short description>`; verify `cd app && npm test` shows all 8 seeded tests plus every `AC-N` green.
- [x] 4.2 Fill `docs/traceability.md`: a row per `AC-N` → `discounts.ts` symbol → test name, plus the reverse check (behaviour with no AC, AC with no test, test with no AC). Verify no empty cells.
- [x] 4.3 Run `openspec validate add-discount-engine --strict` and `npm run typecheck`; both clean.
