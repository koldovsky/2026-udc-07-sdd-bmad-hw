## Why

The pricing engine can compute line totals, subtotal, shipping and a loyalty tier percentage, but nothing ever applies a discount: `tierPercent` reports 5% or 10% and no pricing path multiplies it into an amount, and coupon codes typed at checkout are ignored entirely. A gold customer pays exactly what a customer with no tier pays. The autumn campaign needs loyalty tiers and promo codes to actually reduce what a customer pays, and every stacking/rounding fork has now been decided in `docs/spec/pricing-discounts.md`, so the behaviour can be built and verified rather than guessed.

## What Changes

- Add a discount engine that produces a full price breakdown for an order: pre-discount subtotal, tier discount, coupon discount, shipping and final total.
- Apply the loyalty tier discount (`tierPercent`: silver 5%, gold 10%) to the items amount only — shipping is never discounted.
- Resolve the codes in `order.coupons` against the supplied coupon catalogue, in the order the customer typed them, and apply every coupon that qualifies — sequentially, on top of the tier discount, not summed with it.
- Honour each coupon's constraints: `category` scoping (a percent coupon is computed off that category's remaining amount), `minSubtotalKopecks` (checked against the order-wide remaining items amount after earlier discounts) and `expiresAt`.
- Reject an expired coupon loudly: `priceOrder` throws a dedicated error naming the code instead of silently dropping it.
- Round every discount amount up to whole kopecks as it is computed, at each step, so the customer never loses a fraction of a kopeck.
- Never let discounts take the items amount below zero: a coupon that would overshoot is skipped whole, and the remaining coupons and the tier discount still apply.
- Ignore a typed code that has no match in the catalogue, and deduplicate repeated codes so the same coupon applies at most once.
- No **BREAKING** changes: the existing `pricing.ts` functions and `types.ts` shapes keep their signatures and behaviour, and the new engine sits alongside them.

## Capabilities

### New Capabilities

- `pricing-discounts`: how loyalty tier discounts and promo coupons combine into a final order price — stacking order, discount base, coupon eligibility, rounding direction, the non-negative floor, and the expired-coupon error.

### Modified Capabilities

None. `openspec/specs/` is empty, and the seeded subtotal/shipping/tier behaviour is unchanged by this proposal.

## Impact

- New code in `app/src/` implementing `priceOrder(order, coupons): PriceBreakdown`, plus the `PriceBreakdown` type and the expired-coupon error class, re-exported from `app/src/index.ts`.
- Reads from, but does not modify, `app/src/pricing.ts` (`subtotalKopecks`, `shippingKopecks`, `tierPercent`) and `app/src/types.ts` (`Order`, `LineItem`, `Coupon`).
- New tests named after the acceptance criteria in `docs/spec/pricing-discounts.md` (AC-1 … AC-8); the existing 8 tests in `app/src/pricing.test.ts` stay untouched and green.
- No new runtime dependencies. Amounts stay integer kopecks throughout.
- Traceability from each acceptance criterion to code and test is recorded in `docs/traceability.md`.
