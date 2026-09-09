# Design

## Context

The checkout system currently calculates subtotal and shipping but lacks a discount engine. We need to implement it in TypeScript without floating-point errors (amounts are in kopecks) according to `spec.md`.

## Goals / Non-Goals

**Goals:**
- Provide a `priceOrder` function calculating discount breakdown.
- Ensure discounts never result in negative subtotals.
- Apply tier and coupons sequentially.

**Non-Goals:**
- Modifying `subtotalKopecks` or `shippingKopecks` signatures.

## Decisions

**1. Rounding and Currency handling:**
Decision: All intermediate discounts will be rounded to the nearest integer using `Math.round`. 
Alternatives: `Math.floor` or `Math.ceil`. 
Rationale: `Math.round` provides standard mathematical rounding without consistently shifting the advantage to one party.

**2. State tracking during calculation:**
Decision: Calculate sequentially by tracking a `remainingSubtotal` variable.
Alternatives: Calculate all discounts against the original subtotal.
Rationale: Sequential calculation matches the spec and avoids combinations that exceed 100%.

**3. Category-specific calculation:**
Decision: Find the original subtotal for the category by reducing over `order.items` filtering by `category`, then apply the coupon percentage to that original amount, capping it at `remainingSubtotal`.
Rationale: As defined in the spec.

## Risks / Trade-offs

- **Risk:** Floating point precision during percentage division.
  - **Mitigation:** Use `Math.round((amount * percentage) / 100)` which is integer-safe for typical e-commerce amounts in kopecks (up to `Number.MAX_SAFE_INTEGER`, roughly 90 trillion kopecks).
