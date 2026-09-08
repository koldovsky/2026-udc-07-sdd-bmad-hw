## Why

Loyalty tiers (`tierPercent`) exist in code but are never applied, and there is
no coupon support at all. The business wants both live for an autumn
campaign, but the ticket that requested this (`materials/feature-request.md`)
leaves the actual arithmetic undefined (stacking order, rounding, multiple
coupons, negative totals, ...). Those forks are already closed in
`docs/spec/pricing-discounts.md`; this change carries that spec into an
implementable capability.

## What Changes

- Add a discount engine (`priceOrder`) that combines the customer's loyalty
  tier and any valid coupons they typed into one priced order.
- Loyalty tier and coupon percentages combine **additively**, applied once to
  the merchandise subtotal (never to shipping).
- All valid coupons apply (not just the best one); order of entry does not
  affect the result. Category-restricted coupons discount only that
  category's subtotal.
- Invalid coupons (expired, unknown code, below `minSubtotalKopecks`, or a
  duplicate of an already-applied code) are silently skipped - no error is
  raised by the pricing function.
- The merchandise discount is capped so the discounted subtotal never goes
  below 0; shipping is always charged in full.

## Capabilities

### New Capabilities
- `discounts`: loyalty-tier and coupon discount calculation for an order,
  producing a full price breakdown (subtotal, discount, applied coupon
  codes, shipping, total).

### Modified Capabilities
(none - `pricing.ts`'s existing functions (`subtotalKopecks`,
`shippingKopecks`, `tierPercent`, `lineTotalKopecks`) are protected and
reused as-is, not changed.)

## Impact

- New file `app/src/discounts.ts` (and its test file), exporting
  `PriceBreakdown` and `priceOrder`.
- `app/src/types.ts` and `app/src/pricing.ts` are read-only dependencies -
  no signature changes.
- No new runtime dependencies; no API/DB/infra impact (this is a pure
  TypeScript library function).
