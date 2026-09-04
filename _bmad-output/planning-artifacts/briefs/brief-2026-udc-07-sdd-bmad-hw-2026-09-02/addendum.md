---
title: Checkout discounts — addendum (locked policy for PM / Architect)
status: ready
created: 2026-09-02
updated: 2026-09-02
---

# Addendum

Not part of the executive brief. Downstream PRD and architecture should cite `docs/spec/pricing-discounts.md` as source of truth. This file only compresses what Product must not rediscover or reopen.

## Locked policy (from spec D-1…D-28)

| ID | Rule |
|----|------|
| D-1 | Sequential: **tier first** on full goods, then each coupon on remaining goods. Percents are not added (not 10+15=25). |
| D-2 | Discount **base = goods** (`subtotalKopecks`). Shipping never in base, never reduced. |
| D-3 | All **valid** codes in **typed order**. No best-of. Invalid skipped; rest continue. |
| D-4 | Each percent step → integer kopiyky **half-up** (remainder ≥ 50). Fixed already integer. Integer arithmetic only. |
| D-5 | Category percent from **original** category line totals, then cap by remaining goods. |
| D-6 / D-19 | `minSubtotalKopecks` vs **original** order goods subtotal, including for category coupons. |
| D-7 / D-11 | Remaining goods ≥ 0. `total = remainingGoods + shipping`. |
| D-8 / D-12 / D-18 / D-24 | Expired, unknown, unparsable expiry, wrong category → **silent skip**, never throw. Always return `PriceBreakdown`. |
| D-9 | Mixed percent + fixed: **typed order**, no “all percents first.” |
| D-10 | Two codes on one category: both, sequential, same original category base, each capped by remaining. |
| D-13 | Catalog-only codes (not typed) do not apply. |
| D-14 | Duplicate typed code: **first** occurrence only. |
| D-15 | Trim + case-insensitive match; first catalog hit wins on case-duplicates. |
| D-16 / D-17 | Required `asOf`. No `Date.now()`. `expiresAt` ISO; date-only = that day 00:00:00.000 UTC. Invalid if `asOf >= parse(expiresAt)`. |
| D-20 | Fixed + category: `min(value, categorySubtotal, remainingGoods)`. |
| D-21 | `Coupon.value` for `fixed` is **kopiyky** (100 грн = 10_000). |
| D-22 | Invalid catalog values unspecified; no extra validator. |
| D-23 | Empty cart: all zeros (shipping already 0). |
| D-25 | Split tier vs coupon totals; no per-code array on the result. |
| D-26 | Quantity 0 → line 0, as today. Unknown tiers are outside the `Order` contract. |
| D-27 | No coupon-count cap. Shipping is not zeroed by discounts. |
| D-28 | No best-order optimizer. Typed order only. |

## Contract reminder

```ts
priceOrder(order: Order, catalog: Coupon[], asOf: Date): PriceBreakdown
```

Fields: `subtotalKopecks`, `tierDiscountKopecks`, `couponDiscountKopecks`, `remainingGoodsKopecks`, `shippingKopecks`, `totalKopecks`.

Reuse `subtotalKopecks`, `shippingKopecks`, `tierPercent` from `pricing.ts`. Do not change those signatures or `types.ts`.

## Rejected alternatives (do not revive in PRD)

Additive percents; shipping in the discount base; best-price permutation; throw on expired/unknown; floor total including shipping to zero via discounts; second rounding on the grand total; per-code discount array; UI/analytics in this increment.

## Task E constraints (this planning run)

- Do not edit the spec, traceability, A/B write-up, SDD-tool note, walkthrough, ticket, or `app/src` discount/pricing implementation.
- New files only under `_bmad-output/planning-artifacts/` until the participant asks for `docs/task-e-bonus.md`.
- Dev role later: describe the next implementation step only — no `bmad-build`.
