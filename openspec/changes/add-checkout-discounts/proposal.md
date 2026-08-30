## Why

Loyalty tiers (`tierPercent`) exist in the pricing library but are never applied to a total. Growth needs checkout discounts for the autumn campaign: apply Silver/Gold on goods, stack valid promo codes with the tier, and keep amounts in whole kopecks. Authoritative behaviour is already decided in `docs/spec/pricing-discounts.md`.

## What Changes

- Add a discount engine that prices an order into a `PriceBreakdown` (subtotal, tier discount, coupon discount, remaining goods, shipping, total).
- Apply Silver 5% / Gold 10% to goods only, then apply typed promo codes sequentially (percent or fixed, optional category and min subtotal).
- Ignore expired, unknown, duplicate, and ineligible codes without throwing.
- Export `priceOrder` and `PriceBreakdown` from `app/src/discounts.ts` and re-export from `app/src/index.ts`.
- Add vitest cases named `AC-1` … `AC-14` in `app/src/discounts.test.ts`.
- Do **not** change `app/src/types.ts` shapes or `app/src/pricing.ts` signatures.

## Capabilities

### New Capabilities

- `checkout-discounts`: Compute checkout price with loyalty tier and catalog-backed promo codes per `docs/spec/pricing-discounts.md`.

### Modified Capabilities

- (none — `openspec/specs/` has no existing capabilities)

## Impact

- New: `app/src/discounts.ts`, `app/src/discounts.test.ts`.
- Touch: `app/src/index.ts` (re-exports only).
- Unchanged: `app/src/types.ts`, `app/src/pricing.ts`, `materials/feature-request.md`.
- No new runtime dependencies. Verify with `cd app && npm test`.
