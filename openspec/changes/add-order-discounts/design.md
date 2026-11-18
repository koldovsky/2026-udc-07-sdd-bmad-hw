# Design

## Context

See `proposal.md` (Why) and `specs/order-discounts/spec.md` (requirements and
AC-1..AC-24). The authoritative decisions are D-1..D-17 in
`docs/spec/pricing-discounts.md`; this design only chooses how to realise them.

Current state: `app/src/pricing.ts` already provides `lineTotalKopecks`,
`subtotalKopecks`, `shippingKopecks` and `tierPercent`; `app/src/types.ts`
defines `Order`, `LineItem`, `Coupon`. Both are protected and stay unchanged.
TypeScript ES2022/NodeNext, vitest with colocated `*.test.ts`, named exports
only, no `any`, `.js` suffix on relative imports, no runtime dependencies.

## Goals / Non-Goals

**Goals:**
- One pure module `app/src/discounts.ts` exporting `priceOrder` and
  `PriceBreakdown` exactly as in spec section 5, re-exported from
  `app/src/index.ts`.
- Integer-only money arithmetic with an exact floor, so results are identical
  across runtimes.
- A test file `app/src/discounts.test.ts` with one or more tests per AC, each
  named `AC-N: ...`.

**Non-Goals:**
- Input validation of coupon data (D-13) and coupon start dates (D-15): input
  is assumed valid; invalid input has undefined behaviour and gets no special
  handling.
- Per-line allocation, error reporting, caching, persistence (spec section 2).
- Any helper exported beyond `priceOrder` and `PriceBreakdown`.

## Decisions

### Pipeline inside `priceOrder`
1. `subtotal = subtotalKopecks(order)`, `shipping = shippingKopecks(order)`,
   `pct = tierPercent(order)` (reuse, not reimplement).
2. `tierDiscount = floorPercent(subtotal, pct)`; `afterTier = subtotal - tierDiscount` (D-1, D-12).
3. Resolve typed codes to catalog coupons (D-10, D-17), keeping the first
   typed position of each.
4. Filter eligible: `now < expiresAt` (D-8, D-9) and
   `subtotal >= (minSubtotalKopecks ?? 0)` (D-6).
5. For each eligible coupon compute its base: whole-order → `afterTier`;
   category → `catSubtotal - floorPercent(catSubtotal, pct)` (D-5), 0 if the
   category has no lines (D-11). Discount: percent →
   `floorPercent(base, value)`; fixed → `min(value, base)` (D-4, D-11).
6. Group by scope key (`"order"` or the category name); pick one winner per
   scope by (larger discount, earlier `expiresAt` instant, earlier typed
   position) (D-3).
7. `couponDiscount = min(sum of winners, afterTier)` (D-7, D-16).
8. `total = subtotal - tierDiscount - couponDiscount + shipping`.

Empty orders fall out naturally (subtotal 0, shipping 0 from
`shippingKopecks`), so D-14 needs no special case.
*Alternative considered:* applying coupons sequentially to a running amount —
rejected, it contradicts D-16 and makes results depend on typing order.

### Exact integer floor of a percentage
`floorPercent(amount, percent)` computes `n = amount * percent` and returns
`(n - (n % 100)) / 100`. All operands are non-negative integers, so this is an
exact integer floor with no reliance on floating-point division rounding.
*Alternative considered:* `Math.floor(amount * percent / 100)` — gives the same
results for realistic amounts but depends on float division; the integer form
states the D-4 rule directly. The helper stays module-private.

### Code matching
Normalise with `code.trim().toLowerCase()` on both the typed string and the
catalog `Coupon.code`, build a map from normalised catalog code to coupon, then
walk `order.coupons` in order, skipping unknown codes and codes already seen.
Catalog coupons that never match a typed code are never considered (D-17).

### Expiry comparison
Compare instants as numbers: `now.getTime() < Date.parse(coupon.expiresAt)`.
`now` defaults to `new Date()` when omitted. Formats other than ISO-8601 with
`Z`/offset are out of scope (D-13), so no extra parsing logic is added.

### Purity
The function only reads `order` and `coupons`; intermediate arrays/maps are
local. Nothing is sorted in place on inputs.

## Risks / Trade-offs

- [Per-category tier flooring (D-5) can differ by up to 1 kopeck per category
  from the order-level `tierDiscountKopecks`] → Accepted by the spec; the
  reported tier discount always stays `floor(subtotal * pct / 100)`. Tests use
  AC numbers verbatim, so any drift would surface in AC-5 / AC-7.
- [Tie-break by expiry and typed position is not observable in
  `PriceBreakdown`] → Implemented anyway for determinism (D-3); AC-6 asserts
  that only one of the tied coupons applies.
- [Invalid `expiresAt` makes `Date.parse` return `NaN`, so the coupon is
  treated as expired] → This is invalid input with undefined behaviour (D-13);
  no handling is added, to avoid unrequested behaviour.
- [Integer overflow beyond `Number.MAX_SAFE_INTEGER`] → Not reachable with
  realistic order amounts; no BigInt is introduced.
