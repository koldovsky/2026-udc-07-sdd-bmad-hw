## Why

`materials/feature-request.md` asks for loyalty-tier and coupon discounts at
checkout, but leaves the pricing forks open: whether the two discounts stack or
apply in sequence, what a discount is taken from, which coupon wins when several
are typed, where rounding lands, and what happens when a discount exceeds the
order. Two engineers reading that ticket would ship two different amounts of
money.

Those forks were priced in `docs/spec/pricing-discounts.md` (32 decisions with
rationale, 60 acceptance criteria, 5 invariants). This change carries that
decided behaviour into the OpenSpec cycle so the requirements are
machine-checkable and the implementation has a task list derived from them
rather than from the ticket.

`docs/spec/pricing-discounts.md` remains the source of truth for **why** each
fork was decided the way it was. The delta spec here restates **what** the
system does, in a format `openspec validate --strict` can check.

## What Changes

- **New** `app/src/discounts.ts` exporting `priceOrder(order, catalog, now)` — a
  pure function returning a seven-field `PriceBreakdown`, plus the supporting
  types `RejectionReason`, `RejectedCoupon` and `PriceBreakdown`.
- **New** re-exports from `app/src/index.ts` (types via `export type`, the
  function via `export`).
- **New** tests in `app/src/discounts.test.ts`, each named after the acceptance
  criterion it covers (`AC-1` … `AC-60`), so the link to the specification is
  visible in the test output.
- The coupon catalog is passed in as `Coupon[]`. This change does not create,
  store, validate or administer a catalog.
- `now` is a parameter. The engine never reads the clock.
- **No** change to `app/src/pricing.ts` or `app/src/types.ts` — both are the
  seeded contract. `subtotalKopecks`, `shippingKopecks`, `tierPercent` and
  `lineTotalKopecks` are consumed as they are.
- **No** customer-facing strings. The engine returns rejection reason codes; the
  checkout page owns the text and is a separate delivery.

Not a breaking change: nothing that exists today changes behaviour.

## Capabilities

### New Capabilities

- `order-discounts`: how a loyalty tier and a coupon reduce an order total —
  the order the two discounts apply in, what each is taken from, which coupon
  wins, how rounding lands, and what the customer is told about every code that
  did not apply.

### Modified Capabilities

None. `order-discounts` is the first capability in this repository; the existing
subtotal, shipping and tier-percentage behaviour is seeded code that this change
consumes without altering.

## Impact

- **Code:** `app/src/discounts.ts` (new), `app/src/index.ts` (re-exports),
  `app/src/discounts.test.ts` (new). `app/src/pricing.ts` and
  `app/src/types.ts` untouched.
- **Public API:** `priceOrder` and three exported types are added to the package
  surface. Nothing is removed or renamed.
- **Dependencies:** none. The domain library stays dependency-free, and the
  engine uses no floating-point arithmetic — every amount is whole kopecks.
- **Callers:** the checkout page takes on obligations this change does not
  deliver: recalculating the price on every cart or coupon change and again at
  order confirmation with a fresh `now`, passing an empty catalog rather than a
  partial one, limiting coupon input to 10 fields, rate-limiting failed coupon
  attempts, and logging the winning catalog entry for campaign reconciliation.
  These are specified in section 8 of `docs/spec/pricing-discounts.md`.
- **Out of scope, tracked:** the checkout-page delivery (reason-code texts,
  hryvnia formatting) has no acceptance criteria yet, and three open questions
  (rate-limit threshold, UTC interpretation of a date-only `expiresAt`, catalog
  ownership) belong to business owners. None of them block this change.
