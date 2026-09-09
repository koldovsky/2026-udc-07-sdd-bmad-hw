# Proposal

## Why

We need to implement a deterministic discount engine so that customer tiers and coupons apply correctly, stacking predictably without resulting in negative totals or rounding errors.

## What Changes

- Implement Tier discounts (Silver/Gold).
- Implement Coupon discounts (percent/fixed, category-specific, min-subtotal).
- Combine Tier and Coupon sequentially.

## Capabilities

### New Capabilities

- `pricing-discounts`: The discount calculation engine covering tiers, coupons, multiple coupons, category rules, and rounding.

### Modified Capabilities

## Impact

- Extends the pricing logic in checkout.
- Adds discount calculations before shipping.
