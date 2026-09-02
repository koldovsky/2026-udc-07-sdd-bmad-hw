## Why

Loyalty tiers exist in the codebase (`tierPercent` in `app/src/pricing.ts`) but are never
applied to an order total, and there is no coupon mechanism at all. The autumn campaign
needs both, stacked, in two weeks.

The originating ticket (`materials/feature-request.md`) is deliberately underspecified: it
says tier and coupon must work "together" without saying whether percentages add or compose,
what the discount base is, what happens with multiple coupons, or how kopecks round. Those
forks were resolved in `docs/spec/pricing-discounts.md` (decision table D-1..D-20). This
change carries those decisions into an OpenSpec capability so they are validated, diffable,
and archivable rather than living only in prose.

## What Changes

- Introduce a `pricing/discounts` capability: the rules that turn an `Order` plus a coupon
  catalogue into a final payable amount.
- Add `app/src/discounts.ts` exporting `priceOrder(order, catalog, now?)` returning a
  `PriceBreakdown`, plus `roundKopecks(value)`.
- Discounts compose **sequentially** (tier first, then coupons in typed order) rather than
  additively — D-1.
- Discount base is goods only; shipping is never discounted and is added last — D-2.
- At most one coupon per scope (a category, or the whole order) — D-3.
- Every rejected coupon is reported with a machine-readable reason instead of throwing or
  failing silently — D-8, D-10..D-13.
- Add `app/src/discounts.test.ts` with one test per acceptance criterion, test names prefixed
  with the `AC-N` id.

Explicitly NOT changing: `app/src/types.ts`, `app/src/pricing.ts`, or the 8 existing tests in
`app/src/pricing.test.ts`.

## Capabilities

### New Capabilities

- `pricing/discounts`: how loyalty-tier and coupon discounts are computed, ordered, rounded,
  capped and reported for a checkout order.

### Modified Capabilities

None. `pricing/shipping` and `pricing/subtotal` behaviour is unchanged — this change consumes
those functions, it does not alter their requirements.

## Impact

| Area | Impact |
|---|---|
| `app/src/discounts.ts` | New file — the whole engine. |
| `app/src/discounts.test.ts` | New file — one test per `AC-N`. |
| `app/src/types.ts` | Read-only. `Coupon.expiresAt`, `category`, `minSubtotalKopecks` consumed as-is. |
| `app/src/pricing.ts` | Read-only. `subtotalKopecks`, `shippingKopecks`, `tierPercent` called, not modified. |
| `app/src/index.ts` | Re-export `priceOrder` so the engine has a public entry point. |
| Dependencies | None added. `vitest` and `typescript` already present as devDependencies. |
| Data / migrations | None. The coupon catalogue is passed in by the caller; persistence is out of scope. |
| Money representation | Integers (kopecks) end to end. No float fields enter the public shape. |
| Downstream | `docs/traceability.md` (Task C) maps AC → code → test off the ids used here. |


