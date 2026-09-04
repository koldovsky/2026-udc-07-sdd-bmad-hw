---
title: Checkout discounts (loyalty + coupons)
status: ready
created: 2026-09-02
updated: 2026-09-02
---

# Product Brief: Checkout discounts (loyalty + coupons)

## Executive Summary

Head of Growth wants loyalty and coupons live on checkout for an autumn campaign in two weeks. Silver (5%) and Gold (10%) already exist as `tierPercent` and are never applied. Coupons — percent or fixed, optional category and minimum subtotal, possibly several at once — do not exist. The ticket requires both benefits on one receipt, expired codes not to apply, and kopiyky that do not drift.

This product is a **pure pricing function**, not a checkout UI. Callers pass an `Order`, a coupon `catalog`, and an explicit `asOf` time; they get a `PriceBreakdown` with separate loyalty and coupon lines, goods remaining ≥ 0, and shipping as its own row.

Forks (stacking, discount base, rounding, invalid codes, floor at zero) are **already closed** in `docs/spec/pricing-discounts.md` (D-1…D-28, AC-1…AC-17). This brief does not reopen them. It is a planning reconstruction for the PM: why, who, and in/out, so a PRD can cite the spec. The engine is already implemented and frozen. If PRD and spec conflict, **the spec wins**. Next: John / `bmad-prd`. Locked policy extract: `addendum.md` in this folder.

## The Problem

**Growth cannot launch the campaign.** Loyalty is a dead field: the customer has a tier; checkout never subtracts it. There is no coupon path.

**Two implementations of the same ticket would not match.** “Together” might mean 10%+15%=25% or sequential application off the remainder — 15 грн difference on a 1 000 грн order. Category coupons, minimums, expiry, and half-kopiyka rounding each fork again. At campaign volume that is money, not style.

**How they cope today.** Unused `tierPercent`. Manual promo exceptions, or no stacking story. Shoppers do not feel both benefits because neither line exists on a breakdown.

**Cost of the status quo.** The campaign slips, or it ships with silent kopiyka disagreement between environments. Trust in the receipt dies first.

## The Solution

A domain library function `priceOrder(order, catalog, asOf) → PriceBreakdown` on the existing seeded contract (`Order`, `LineItem`, `Coupon`; integer kopiyky; `subtotalKopecks` / `shippingKopecks` / `tierPercent` unchanged).

On a receipt the shopper (via some other UI, out of scope) should see:

1. Goods subtotal
2. Loyalty discount (Silver / Gold / none)
3. Coupon discount (sum of valid codes, in **typed** order)
4. Shipping (unchanged by discounts)
5. Total = remaining goods + shipping

Invalid, expired, unknown, duplicate, or ineligible codes contribute 0 and **do not throw**. Expiry uses the caller’s `asOf`, never `Date.now()` inside the engine.

Normative arithmetic and every numeric example live in the spec. Product commitment: **one breakdown, two visible benefits, no negative goods, shipping not on sale.**

## What Makes This Different

There is no moat. The advantage is **decisions written down before code**: sequential stacking (tier first), goods-only base, half-up per percent step, all valid codes in typed order, silent skip, floor at 0. Alternatives (best-of set, additive percents, discount including shipping, a “smart” optimizer) were rejected in the spec because they would make two engineers diverge. This is not a promo platform or personalization engine.

## Who This Serves

The software user is the caller of `priceOrder`. Growth sponsors. The shopper benefits. No UX personas.

| Role | Need | Success looks like |
|------|------|--------------------|
| **Sponsor — Head of Growth** | Autumn campaign: tiers live, coupons combinable with tiers | Both lines non-zero on a qualifying Gold + valid-code receipt |
| **Primary user — checkout / pricing caller** | Deterministic `PriceBreakdown` from current `Order` + catalog + `asOf` | Same inputs → same kopiyky; no exceptions for bad codes |
| **Beneficiary — shopper** | Feels loyalty *and* promo without a negative basket | Separate lines; goods never below 0; delivery fee still due |

## Success Criteria

- Every acceptance criterion in the spec (AC-1…AC-17) has a named test. The existing eight `pricing.ts` tests stay green.
- Invariant on every return: six fields integers ≥ 0; `remainingGoods = subtotal − tier − coupons`; `total = remainingGoods + shipping`; `shipping` equals `shippingKopecks(order)`.
- Gold 1 000 грн UA, no codes: tier 100 грн, shipping 49 грн, total 949 грн (AC-1). An expired code does not change that and does not throw (AC-2).
- No campaign KPIs (redemption rate, GMV lift): they are not in the ticket, and this module cannot observe them.

## Scope

**In for this increment**

- Apply Silver/Gold to goods via existing `tierPercent`.
- Apply 0..n **valid** typed codes from the catalog, sequential, typed order.
- Percent and fixed; optional category and `minSubtotalKopecks` (checked on **original** goods subtotal).
- Integer kopiyky; half-up at each percent step.
- Split `tierDiscountKopecks` vs `couponDiscountKopecks`.
- Explicit `asOf` for expiry.

**Out (do not pull into a PRD as this increment)**

- Checkout UI, copy, analytics, “code already used,” coupon CRUD, usage caps, personal codes.
- Changing `pricing.ts` signatures or `types.ts` shapes.
- Discounting shipping; free-shipping-from-amount.
- Thrown errors for bad codes; per-code reason list on the breakdown.
- Reordering codes for best price; promo-platform or personalization features.
- Dirty-line validation (negative price/qty).
- Catalog garbage (`percent` outside 0–100, empty codes) — treat the catalog as valid.

## Vision

Horizon is this campaign increment, not a 2–3 year promo platform. If it succeeds, the next honest step is **UI and persistence** (surface silent skips, store redemptions) — still out of this brief. We will not invent a marketplace or points program to fill a vision section.
