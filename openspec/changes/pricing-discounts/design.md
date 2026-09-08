## Context

See `proposal.md` (Why) for motivation and `specs/discounts/spec.md` for the
full requirement list. This document covers only implementation-shape
decisions not already fixed by those requirements. The source spec that all
of this traces back to is `docs/spec/pricing-discounts.md`.

Constraints from the existing codebase (`app/AGENTS.md`):
- `lineTotalKopecks`, `subtotalKopecks`, `shippingKopecks`, `tierPercent`
  and the shapes in `types.ts` are protected - reused, never modified.
- No runtime dependencies; named exports only; money stays integer kopecks.

## Goals / Non-Goals

**Goals:**
- A single pure function, `priceOrder(order, coupons, now?)`, with no
  hidden state and no I/O, that a test can call directly per acceptance
  criterion.
- Every branch in the function should be traceable to one requirement in
  `specs/discounts/spec.md` (and from there to a `D-#`/`AC-#` in
  `docs/spec/pricing-discounts.md`) - nothing implemented that the spec
  didn't ask for.

**Non-Goals:**
- Persisting or logging which coupons were applied beyond the single
  `PriceBreakdown` return value.
- Any validation/error surface for the caller (invalid coupons are silently
  inert, per spec) - that belongs to a future UI/API layer, not this
  function.

## Decisions

- **Single pass over `order.coupons`, catalog lookup by `code`.** Build a
  `Map<code, Coupon>` from the `coupons` catalog once, then walk
  `order.coupons` in order, deduplicating by code (first occurrence wins)
  and dropping codes with no catalog match, an expired `expiresAt` (versus
  `now`), or an unmet `minSubtotalKopecks` (checked against the original
  subtotal). Alternative considered: filter the catalog first, then match -
  rejected because it does not naturally give "first occurrence" dedupe
  behavior on `order.coupons`.
- **Bucket valid coupons into two groups before combining:** order-wide
  (no `category`) and per-category (grouped by `category`). Each group's
  percent-kind coupons sum, capped at 100%, and combine with fixed-kind
  coupons in the same group. This mirrors the additive rule (spec:
  "combine additively") applying uniformly at two scopes (whole order,
  single category) instead of needing separate logic for each.
- **One `floor` per bucket, not per coupon or per line item.** Each
  bucket's kopeck amount is computed once as
  `floor(base * cappedPercent / 100) + fixedSum`, then the category
  buckets and the order-wide bucket are summed and the total capped at
  `subtotalKopecks`. This keeps rounding behavior exactly as specified
  (once per "combined percentage") without needing per-coupon rounding
  state.
- **`now` as an optional parameter, defaulting to `new Date()`.** Keeps the
  function pure and deterministic for tests while still being convenient
  to call in real checkout code without passing a clock explicitly.
- **No internal "discount reason" split.** The implementation does not
  track which fraction of the combined discount came from the tier versus
  a given coupon; it only tracks the total and the list of applied coupon
  codes, per spec's `PriceBreakdown` shape.

## Risks / Trade-offs

- **[Risk] A future request asks for a tier/coupon breakdown in the UI** →
  [Mitigation] The spec explicitly scopes this out with a rationale
  (D-15); if it's needed later, it is a new spec decision and a new
  requirement, not a silent addition to this implementation.
- **[Risk] Grouping coupons into buckets could make one very long function
  harder to unit-test at a fine grain** → [Mitigation] Keep bucket
  computation as small internal helpers (e.g. one function per bucket)
  that Task C's tests can still exercise indirectly through `priceOrder`,
  since every acceptance criterion is expressed as an end-to-end scenario
  on `priceOrder` anyway.

## Migration Plan

None - this adds a new file (`app/src/discounts.ts`) and does not change
any existing exported behavior. No rollback beyond not importing the new
module.
