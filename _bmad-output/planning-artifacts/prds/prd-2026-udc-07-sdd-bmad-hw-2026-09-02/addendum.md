---
title: Checkout discounts — PRD addendum (for Architect)
status: final
created: 2026-09-02
updated: 2026-09-02
---

# Addendum

Not part of the PRD narrative. Architecture and solution design should treat `docs/spec/pricing-discounts.md` as source of truth for arithmetic. This file holds mechanism, the locked-policy extract, and rejected alternatives so they are not rediscovered in the PRD.

## Mechanism / transport

- TypeScript domain library (Node 22+, ES2022, NodeNext). No HTTP, no UI, no persistence.
- Module: `app/src/discounts.ts`. Named export only. Re-export from `app/src/index.ts`.
- Tests: `app/src/discounts.test.ts`, `it(...)` titles start with `AC-N:`.
- Money: integer kopiyky. Rounding rule is specified (half-up per percent step), not left to `Math.round` on floats.

```ts
priceOrder(order: Order, catalog: Coupon[], asOf: Date): PriceBreakdown
```

`PriceBreakdown` fields (all integers ≥ 0): `subtotalKopecks`, `tierDiscountKopecks`, `couponDiscountKopecks`, `remainingGoodsKopecks`, `shippingKopecks`, `totalKopecks`.

Reuse `subtotalKopecks`, `shippingKopecks`, `tierPercent` from `pricing.ts`. Do not change those signatures or `types.ts`.

Normative algorithm (percent→kopiyky, sequential steps, caps): spec §3. Do not invent a second algorithm here. The D-table below is an id index, not a substitute for spec §3.

## Locked policy (spec D-1…D-28)

| ID | Rule |
|----|------|
| D-1 | Sequential: **tier first** on full goods, then each Coupon on remaining goods. Percents are not added. |
| D-2 | Discount **base = goods**. Shipping never in base, never reduced. |
| D-3 | All **eligible** typed codes in **typed order**. No best-of. Ineligible skipped; rest continue. |
| D-4 | Each percent step → integer kopiyky **half-up** (remainder ≥ 50). Fixed already integer. Integer arithmetic only. |
| D-5 | Category percent from **original** category LineItem totals, then cap by remaining goods. |
| D-6 / D-19 | `minSubtotalKopecks` vs **original** goods subtotal, including for category Coupons. |
| D-7 / D-11 | Remaining goods ≥ 0. `total = remaining goods + shipping`. |
| D-8 / D-12 / D-18 / D-24 | Expired, unknown, unparsable expiry, wrong category → **silent skip**, never throw. Always return PriceBreakdown. |
| D-9 | Mixed percent + fixed: **typed order**, no “all percents first.” |
| D-10 | Two codes on one category: both, sequential, same original category base, each capped by remaining goods. |
| D-13 | Catalog-only codes (not typed) do not apply. |
| D-14 | Duplicate typed code: **first** occurrence only. |
| D-15 | Trim + case-insensitive match; first catalog hit wins on case-duplicates. |
| D-16 / D-17 | Required asOf. No `Date.now()`. `expiresAt` ISO; date-only = that day 00:00:00.000 UTC. Ineligible if `asOf >= parse(expiresAt)`. |
| D-20 | Fixed + category: `min(value, category base, remaining goods)`. |
| D-21 | `Coupon.value` for `fixed` is **kopiyky** (100 грн = 10_000). |
| D-22 | Invalid catalog values unspecified; no extra validator. |
| D-23 | Empty cart: all zeros (shipping already 0). |
| D-25 | Split tier vs coupon totals; no per-code array on the result. |
| D-26 | Quantity 0 → line 0, as today. Unknown tiers are outside the Order contract. |
| D-27 | No coupon-count cap. Shipping is not zeroed by discounts. |
| D-28 | No best-order optimizer. Typed order only. |

## Rejected alternatives (do not revive in architecture)

Additive percents; shipping in the discount base; best-price permutation of typed codes; throw on expired/unknown; floor total including shipping to zero via discounts; second rounding on the grand total; per-code discount array; UI/analytics/redemption store in this increment.

## Options considered (why sequential, not additive)

Ticket said “together,” not “how.” Additive 10%+15%=25% vs sequential on a 1 000 грн Order differs by 15 грн. Sequential-tier-first never exceeds “apply one, then the other on the rest,” matches “loyalty is always on the customer, Coupon is optional at checkout,” and is what AC-5 locks. Architect must not swap this for a margin-maximizing or shopper-maximizing optimizer.

## Task E constraints (this planning run)

- Do not edit the spec, traceability, A/B write-up, SDD-tool note, walkthrough, ticket, or `app/src` discount/pricing implementation.
- New files only under `_bmad-output/planning-artifacts/` until the participant asks for `docs/task-e-bonus.md`.
- Dev role later: describe the next implementation step only — no `bmad-build`.

## Research

Skipped. Landscape/comparables would not change a locked spec. Positioning is “decisions written down before code,” already in the brief.
