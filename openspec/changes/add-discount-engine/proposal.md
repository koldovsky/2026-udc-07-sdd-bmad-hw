## Why

Checkout has loyalty tiers (`tierPercent`) that are computed but applied
nowhere, and no promo-code mechanism at all. The autumn campaign needs both,
live in two weeks. The originating ticket (`materials/feature-request.md`) is
deliberately ambiguous — stacking order, rounding, multi-coupon resolution and
the discount base are all undefined. `docs/spec/pricing-discounts.md` closes
those forks with decisions D-1..D-21; this change carries them into the
tool-tracked workflow and a task breakdown.

## What Changes

- Add a pure `priceOrder(order, catalog, now?)` function that returns a
  `PriceBreakdown` (subtotal, tier discount, coupon discount, shipping, total,
  applied coupon codes).
- Loyalty tier discount is applied first, off the goods subtotal (D-1, D-2, D-19).
- Promo codes are applied after the tier, each on the running remainder, in the
  order the customer typed them (D-1, D-3, D-20).
- Percent and fixed (kopeck) coupons; optional `category` and
  `minSubtotalKopecks` gates (D-5, D-6, D-15).
- At most one coupon per category; expired / unknown / duplicate codes are
  silently skipped (D-3, D-8, D-9, D-10, D-11).
- Half-up rounding to whole kopecks at every step; total floored at 0 with
  shipping added on top, never discounted (D-4, D-7).
- No change to `subtotalKopecks`, `shippingKopecks`, `tierPercent`,
  `lineTotalKopecks`, or the `types.ts` shapes — seeded contract.
- Re-export `priceOrder` / `PriceBreakdown` from `app/src/index.ts`.

## Capabilities

### New Capabilities

- `discount-engine`: deterministic pricing of an order under a loyalty tier and
  customer-entered promo codes, producing an itemised, integer-kopeck breakdown.

### Modified Capabilities

None. The seeded pricing functions keep their behaviour; this change only adds
a new capability alongside them.

## Impact

- **Code:** new `app/src/discounts.ts`, new `app/src/discounts.test.ts`
  (tests named after acceptance-criteria ids), two added lines in
  `app/src/index.ts`.
- **Docs:** `docs/spec/pricing-discounts.md` (source of decisions),
  `docs/traceability.md`, `docs/sdd-tool.md`.
- **APIs:** one new exported function and one new interface. No existing
  signature changes. No runtime dependencies added.
