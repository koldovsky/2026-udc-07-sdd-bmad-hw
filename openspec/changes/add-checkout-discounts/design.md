## Context

See `proposal.md` (Why). Existing library already computes line totals, goods subtotal, shipping, and headline `tierPercent`; none of those functions apply a discount. Types `Order`, `LineItem`, and `Coupon` are a seeded contract. Behaviour numbers and stacking rules live in `docs/spec/pricing-discounts.md` — this design only says how that contract lands in the TypeScript module.

Constraints: integer kopecks; NodeNext (`.js` on relative imports); no new runtime dependencies; do not change `pricing.ts` signatures or `types.ts` shapes.

## Goals / Non-Goals

**Goals:**

- One pure function that implements the normative algorithm in `docs/spec/pricing-discounts.md` §3.
- Reuse `subtotalKopecks`, `shippingKopecks`, `tierPercent`, and `lineTotalKopecks` instead of reimplementing them.
- Tests named `AC-N:` so vitest output maps to the homework spec.

**Non-Goals:**

- Result types / thrown errors for bad codes (silent skip is specified).
- Per-coupon line items in the breakdown.
- Coupon CRUD, redemption persistence, or checkout UI.

## Decisions

1. **Module split, not a patch of `pricing.ts`.** New `app/src/discounts.ts` keeps the seeded pricing functions untouched. Alternative: fold `priceOrder` into `pricing.ts` — rejected because the homework guardrail is “do not change those signatures or behaviour,” and a new file makes the delta obvious in review.

2. **Caller supplies `catalog` and `asOf`.** `Order.coupons` is only typed codes; `Coupon[]` is the catalog. `asOf: Date` is required so expiry tests do not depend on `Date.now()`. Alternative: look up coupons globally or use the system clock — rejected; both make the function impure or hide D-12/D-16.

3. **Integer half-up helper stays private.** `percentToKopecks` is an implementation detail of the algorithm, not a public export. Alternative: export it for tests — rejected as unrequested surface (reverse-traceability risk). AC-9 goes through `priceOrder`.

4. **Matching: trim + case-insensitive, first catalog hit.** Matches D-14/D-15 without a separate normalisation API.

5. **No extra breakdown fields.** Six fields as in the Task A contract. Alternative: list skipped codes — not in any AC.

## Risks / Trade-offs

- **[Risk] OpenSpec delta restates Task A with different wording** → Treat `docs/spec/pricing-discounts.md` as source of truth for numbers; OpenSpec spec is a projection for the tool cycle. If they disagree, fix the OpenSpec file to match Task A.
- **[Risk] Float sneaks in via `amount * percent / 100`** → Follow the integer `trunc` / remainder formula in Task A §3.
- **[Risk] Empty cart shipping** → Must call existing `shippingKopecks` (`every` on `[]` is already 0); do not special-case 4_900.

## Migration Plan

Library-only change. Add files, re-export, run `cd app && npm test`. Rollback is revert of those files. No data migration.

## Open Questions

None — stacking, rounding, expiry, and the public signature are closed in Task A.
