# Proposal

## Why

Checkout needs a reproducible quote that combines earned loyalty savings with the best eligible coupon from the entered codes.

## What Changes

- Add a deterministic order-pricing function with an itemized breakdown in kopecks.
- Apply one coupon before loyalty and add the existing shipping fee after both discounts.
- Use [the checkout discounts specification](../../../docs/spec/pricing-discounts.md) as the source of truth for decisions D-1 through D-10, AC-1 through AC-14, and the public contract.
- Keep coupon creation, code normalization, usage tracking, taxes, refunds, per-line discount allocation, and checkout UI out of scope.

## Capabilities

### New Capabilities

- `checkout-discounts` covers coupon eligibility and selection, loyalty, rounding, and the price breakdown.

### Modified Capabilities

## Impact

The change adds `app/src/discounts.ts` alongside the seeded pricing helpers and types. Task C adds colocated Vitest coverage and the traceability record.
