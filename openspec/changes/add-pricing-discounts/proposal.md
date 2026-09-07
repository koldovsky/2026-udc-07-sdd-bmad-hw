## Why

The order domain exposes loyalty tiers and coupon data but has no discount engine.
Checkout needs a deterministic price breakdown that applies the agreed loyalty and
coupon rules while preserving the existing pricing contract.

## What Changes

- Add a `pricing-discounts` capability that calculates merchandise discounts and a
  final order total from `Order`, supplied `Coupon[]`, and an explicit current time.
- Apply loyalty before eligible coupons; preserve customer coupon order, category
  restrictions, minimum-subtotal eligibility, rounding, and the non-negative floor
  defined in `docs/spec/pricing-discounts.md`.
- Return a price breakdown with coupon application or rejection results.
- Add tests named after the sixteen accepted criteria and export the new public API.

## Capabilities

### New Capabilities

- `pricing-discounts`: Calculate loyalty and coupon discounts for an order and
  return a deterministic price breakdown.

### Modified Capabilities

- None.

## Impact

- New module: `app/src/discounts.ts`.
- Updated public exports: `app/src/index.ts`.
- New focused tests alongside the pricing domain.
- No runtime dependencies and no changes to `app/src/types.ts` or
  `app/src/pricing.ts`.
