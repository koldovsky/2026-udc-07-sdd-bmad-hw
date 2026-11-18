# Proposal

## Why

Checkout must apply the customer's loyalty-tier discount (Silver 5%, Gold 10%)
together with any valid coupons, but the pricing domain in `app/` has no
discount engine yet. The source ticket (`materials/feature-request.md`) is
ambiguous; the agreed specification `docs/spec/pricing-discounts.md` (decisions
D-1..D-17, acceptance criteria AC-1..AC-24) resolves it into one deterministic,
integer-kopeck rule set, and this change brings that rule set into the codebase.

## What Changes

- Add a pure discount engine `priceOrder(order, coupons, now?)` that returns an
  order-level `PriceBreakdown` (subtotal, tier discount, coupon discount,
  shipping, total), all in integer kopecks.
- Tier discount applies first to the item subtotal of all categories; coupons
  apply to the amount after tier; shipping is added afterwards and is never
  discounted (D-1, D-2, D-12).
- Coupons: matched to typed codes (trim + case-insensitive, duplicates count
  once, unknown/untyped ignored), filtered by expiry (`now < expiresAt`) and by
  `minSubtotalKopecks` against the pre-discount whole-order subtotal; one
  winner per scope (whole order or one category); scopes computed
  independently and capped at the after-tier item amount (D-3, D-5..D-11,
  D-16, D-17).
- Every discount amount is floored to whole kopecks (D-4); empty order prices
  to all zeros (D-14).
- Re-export `priceOrder` and `PriceBreakdown` from `app/src/index.ts`.
- No **BREAKING** changes: `app/src/types.ts` and `app/src/pricing.ts` stay
  unchanged.

Out of scope (per spec section 2): coupon start dates, coupon data validation,
user-facing errors/UI, new discount types, per-line allocation, caching,
persistence, non-UAH currencies.

## Capabilities

### New Capabilities
- `order-discounts`: computing an order's price breakdown by applying the
  loyalty-tier discount and the customer's typed, valid coupons to the item
  subtotal, plus undiscounted shipping.

### Modified Capabilities
<!-- None: no existing specs under openspec/specs/. -->

## Impact

- New code: `app/src/discounts.ts` (engine) and `app/src/discounts.test.ts`
  (tests named `AC-N: ...`).
- Modified code: `app/src/index.ts` (re-exports only).
- Reused, unchanged: `subtotalKopecks`, `shippingKopecks`, `tierPercent` from
  `app/src/pricing.ts`; shapes in `app/src/types.ts`.
- Public API: new `priceOrder` function and `PriceBreakdown` type.
- Dependencies: none added.
