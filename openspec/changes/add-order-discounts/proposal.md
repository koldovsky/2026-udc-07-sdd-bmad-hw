## Why

Loyalty tiers already exist in the code (`tierPercent` in `app/src/pricing.ts`)
but are never applied to a total, and promo codes do not exist at all — so
`Order.coupons` is collected at checkout and then ignored. The autumn campaign
needs both working together, and it needs a total that can be explained line by
line and reproduced to the kopeck.

## What Changes

- Add a discount engine (`app/src/discounts.ts`) exposing `priceOrder`, which
  returns a full price breakdown instead of a single number.
- Apply the loyalty tier percentage to the item subtotal — the first time
  `tierPercent` affects what anyone pays.
- Resolve the codes in `Order.coupons` against a coupon catalog and apply valid
  ones **sequentially** after the tier discount, in the order the customer typed
  them, at most one per scope (order-wide, or per category).
- Report every code that did **not** apply, each with a machine-readable reason
  (`unknown`, `expired`, `below-min-subtotal`, `duplicate-code`,
  `duplicate-scope`, `no-eligible-items`) instead of failing silently or
  throwing.
- Fix the rounding rule (half away from zero, per discount, integer arithmetic
  only) and the discount floor (item amount never below 0; shipping always
  charged) as specified behaviour rather than implementation accident.
- No **BREAKING** changes: nothing existing is modified. `pricing.ts` and
  `types.ts` are reused untouched.

## Capabilities

### New Capabilities

- `order-discounts`: how loyalty tiers and promo codes reduce an order total —
  stacking order, discount base, per-category scoping, coupon validity and
  rejection reasons, rounding, and the lower bound on the total.

### Modified Capabilities

None. `subtotalKopecks`, `shippingKopecks` and `tierPercent` keep their current
behaviour; this change consumes them. They have no spec under `openspec/specs/`
to amend (OpenSpec was introduced to this repo by this change).

## Impact

- **New code:** `app/src/discounts.ts`, `app/src/discounts.test.ts`; re-export
  from `app/src/index.ts`.
- **Reused, unchanged:** `app/src/pricing.ts` (`subtotalKopecks`,
  `shippingKopecks`, `tierPercent`), `app/src/types.ts` (`Order`, `LineItem`,
  `Coupon`) — both are a protected contract.
- **New caller obligation:** `priceOrder` takes the coupon catalog and the
  evaluation instant (`now`) as parameters, because `Order.coupons` holds only
  code strings and expiry must be deterministic. Callers must supply both.
- **Dependencies:** none added. Still a zero-dependency domain library.
- **Decision record:** `docs/spec/pricing-discounts.md` (D-1…D-19, AC-1…AC-17)
  is the authoritative source for every choice restated here.
