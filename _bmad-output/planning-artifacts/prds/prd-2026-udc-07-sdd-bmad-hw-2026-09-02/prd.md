---
title: Checkout discounts (loyalty + coupons)
status: final
created: 2026-09-02
updated: 2026-09-02
---

# PRD: Checkout discounts (loyalty + coupons)

## 0. Document Purpose

For **Winston (Architect)** and the Task E chain. Converts Mary’s brief into capabilities, glossary, scope, and success checks so architecture does not reopen arithmetic forks. Numeric behaviour, rounding, and worked examples live only in `docs/spec/pricing-discounts.md` (D-1…D-28, AC-1…AC-17). Testable consequences **cite** those ids; they do not restate kopiyky. If this PRD and the spec disagree, **the spec wins**. No UX spec exists. Internal reconstruction, not a public-launch PRD. Decisions accepted at finalize are listed in §14.

## 1. Vision

Head of Growth needs Silver and Gold to actually reduce goods, and typed Coupon codes to stack on the same receipt, in time for an autumn campaign. Today `tierPercent` exists and is unused; there is no Coupon path. Ops cope with manual promo exceptions, or there is no stacking story at all. Shoppers cannot “feel both” benefits because neither line is computed. If two environments disagree on kopiyky, **trust in the receipt dies first**.

This increment is a pure pricing function: the caller passes an Order, a catalog, and an explicit asOf; they get a PriceBreakdown with a distinct tier discount, a distinct coupon discount, remaining goods ≥ 0, and shipping as its own row. Invalid typed codes contribute 0 and never throw. Product commitment: **one breakdown, two visible benefits, no negative goods, shipping not on sale.**

There is no moat. The advantage is decisions written down before code. Horizon is this campaign increment — not a promo platform, personalization engine, checkout UI, marketplace, or points program.

## 2. Target User

Primary software user is the `priceOrder` caller. Growth sponsors. The shopper is beneficiary only.

### 2.1 Jobs To Be Done

- **Caller (functional):** Given this Order, this catalog, this asOf — return one PriceBreakdown whose kopiyky match the spec, every time.
- **Caller (contextual):** Price carts that include expired, unknown, duplicate, or ineligible typed codes without aborting checkout.
- **Sponsor (functional):** A qualifying Gold Order with a valid typed code shows both benefits as separate, non-zero lines.
- **Shopper (emotional, via some other UI):** Loyalty was not a dead badge; the promo they typed did something; they are not billed a negative basket.

### 2.2 Non-Users (v1)

- Shoppers interacting with screens (no UI in this increment).
- Marketing ops creating or editing the catalog (CRUD out of scope).
- Analysts measuring redemption or GMV (this module cannot observe them).
- Engineers expecting thrown errors or a per-code rejection list.

### 2.3 Key User Journeys

Downscaled: library with one operator role. No named UX protagonists or screen flows.

- **UJ-1. Caller prices a qualifying Gold Order with one valid typed code.** Entry: Order with `customerTier: "gold"`, one in-date catalog hit, asOf supplied. Path: call `priceOrder`. Climax: PriceBreakdown has non-zero tier discount and non-zero coupon discount; remaining goods + shipping = total. Realized by FR-1, FR-2, FR-8.

- **UJ-2. Caller prices an Order whose typed code is expired or unknown.** Entry: same as a valid cart except the code fails eligibility. Path: call `priceOrder`. Climax: still a PriceBreakdown; that code contributes 0; no throw; other valid typed codes (if any) still apply. Realized by FR-5, FR-6, FR-7.

- **UJ-3. Caller prices an empty Order.** Entry: `items: []`. Climax: all six PriceBreakdown fields are 0, including shipping. Realized by FR-9.

## 3. Glossary

Downstream must use these terms exactly. Arithmetic procedures are in the spec; definitions here are names, not a second algorithm.

- **Order** — The seeded checkout cart (`id`, LineItems, `country`, `customerTier`, typed codes). Shapes in `app/src/types.ts` are frozen.
- **LineItem** — One goods row: sku, name, unit price in kopiyky, quantity, category (`standard` | `fresh` | `digital`).
- **Coupon** — One catalog row: `code`, `kind` (`percent` | `fixed`), `value`, `expiresAt`, optional category, optional `minSubtotalKopecks`.
- **catalog** — The `Coupon[]` passed into the function. Codes present only here, not among typed codes, do not apply.
- **typed codes** — Strings in `Order.coupons`, in the order the shopper typed them. This is the only application order.
- **asOf** — Required `Date` the caller supplies for expiry. The engine must not read `Date.now()`.
- **kopiyky** — Integer money unit. 1 грн = 100 kopiyky. No floating-point arithmetic on amounts.
- **goods subtotal** — `subtotalKopecks(Order)`: sum of LineItem totals. Shipping is not included.
- **original goods subtotal** — That goods subtotal **before** any tier discount or coupon discount. Used for `minSubtotalKopecks` and as the category percent base.
- **category base** — Sum of LineItem totals whose category matches the Coupon’s category; if the Coupon has no category, treat as remaining goods.
- **tier discount** — Kopiyky removed by Silver (5%) or Gold (10%) via existing `tierPercent`. `none` → 0. Field: `tierDiscountKopecks`.
- **coupon discount** — Sum of kopiyky removed by all applied Coupons. Not a per-code array. Field: `couponDiscountKopecks`.
- **remaining goods** — goods subtotal − tier discount − coupon discount, floored at 0. Field: `remainingGoodsKopecks`.
- **shipping** — `shippingKopecks(Order)`. Never in the discount base; never reduced by tier discount or coupon discount. Field: `shippingKopecks`.
- **PriceBreakdown** — Return object. Identifiers (spec §5): `subtotalKopecks`, `tierDiscountKopecks`, `couponDiscountKopecks`, `remainingGoodsKopecks`, `shippingKopecks`, `totalKopecks`. All integers ≥ 0.
- **sequential stacking** — Tier discount first on full goods subtotal, then each eligible Coupon on remaining goods. Percents are not added. Procedure: spec D-1.
- **silent skip** — An ineligible typed code contributes 0 and does not throw. Remaining typed codes continue.
- **half-up** — The percent→kopiyky step in spec §3 / D-4. Do not restate the formula here. Fixed Coupons are already integer.

## 4. Features

### 4.1 Tier discount on goods

**Description:** Silver and Gold already exist as `tierPercent` and must actually reduce goods. Applied first, on the full goods subtotal, never on shipping. Realizes UJ-1. Unknown `customerTier` values stay outside the Order contract.

**Functional Requirements:**

#### FR-1: Apply the customer’s tier to goods

The caller can obtain a tier discount for `silver` (5%) or `gold` (10%) on the goods subtotal, with `none` producing 0. Realizes UJ-1.

**Consequences (testable):**
- Spec AC-1 (Gold, UA, no typed codes).
- Spec AC-17 (Silver, same cart).
- Spec AC-10 (Gold, PL: tier is on goods, not goods+shipping).
- Spec AC-9 (Gold, digital LineItem: half-up at the percent step).

**Out of Scope:** Changing `tierPercent` rates or adding tiers.

### 4.2 Coupons from typed codes

**Description:** The shopper may type zero or more codes. Each valid catalog hit applies in typed-code order: percent or fixed, optional category, optional minimum on original goods subtotal. Catalog-only Coupons that were not typed do not apply. Realizes UJ-1.

**Functional Requirements:**

#### FR-2: Apply every eligible typed code, in typed order

The caller can pass 0..n typed codes; every eligible catalog hit applies once, in typing order. No best-of set. No engine reordering. Realizes UJ-1.

**Consequences (testable):**
- Spec AC-3 (two category Coupons on `fresh`, original category base).
- Spec AC-11 (mixed percent then fixed follows typed order; must not be reordered).
- Spec AC-12 (duplicate typed code: first occurrence only).
- No cap on how many distinct typed codes may apply (spec D-27).

#### FR-3: Percent and fixed Coupons

The caller can use `percent` (against the relevant base, then half-up) and `fixed` (`value` already kopiyky).

**Consequences (testable):**
- Spec D-21: `fixed` `value` is kopiyky, not hryvnia.
- Spec D-20 / AC-6: category Coupons cap against category base and remaining goods.

#### FR-4: Minimum and category gates use original goods

The caller can rely on `minSubtotalKopecks` comparing to original goods subtotal (including after a tier discount would have pushed remaining goods below the min), and on category matching LineItems. Realizes UJ-1.

**Consequences (testable):**
- Spec AC-7 (min checked on original goods, Coupon then applied to post-tier remainder).
- Spec AC-14 (min not met → silent skip).
- Spec AC-16 (category Coupon, no matching LineItem → silent skip).
- Spec D-19 (category Coupon min is whole-Order original goods subtotal).

#### FR-5: Match typed codes to the catalog conservatively

The caller can type codes with incidental whitespace or case differences and still hit the catalog; empty trimmed strings are ignored; first catalog row wins on case-duplicates.

**Consequences (testable):**
- Spec AC-15 (trim + case-insensitive match).
- Spec AC-13 (unknown typed code: silent skip; later valid typed codes still apply).
- Spec D-13 (catalog Coupon not among typed codes does not apply).

### 4.3 Eligibility, expiry, and silent skip

**Description:** Expired, unknown, unparsable, duplicate-after-first, min-failing, and wrong-category typed codes do not apply and do not abort the function. Expiry is asOf vs `expiresAt` per spec D-16 / D-17. Realizes UJ-2.

**Functional Requirements:**

#### FR-6: Expiry is asOf, never wall clock

The caller must pass asOf. Eligibility vs `expiresAt` is spec D-16 / D-17 (including unparsable `expiresAt`). Realizes UJ-2.

**Consequences (testable):**
- Spec AC-2 (asOf equal to `expiresAt`: coupon discount 0, PriceBreakdown returned, no throw).

#### FR-7: Always return PriceBreakdown; never throw for typed codes

The caller always receives a PriceBreakdown. Silent skip is the only rejection mode for typed-code problems. Realizes UJ-2.

**Consequences (testable):**
- Spec AC-2, AC-8, AC-13 do not throw.
- PriceBreakdown has no per-code reason list (spec D-24 / D-25).

**Out of Scope:** UI copy for “code expired”; “already used”; usage caps.

### 4.4 Receipt arithmetic and floor

**Description:** Sequential stacking; goods-only base; remaining goods never negative; shipping unchanged; total = remaining goods + shipping. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-8: Sequential stacking, goods-only, split lines

The caller can read tier discount and coupon discount as separate PriceBreakdown fields. Apply tier discount first, then Coupons on remaining goods. Shipping is not discounted. Realizes UJ-1.

**Consequences (testable):**
- Spec AC-5 (sequential, not additive percents).
- Invariant on every return (spec §3 / D-7 / D-11): remaining goods = goods subtotal − tier discount − coupon discount ≥ 0; total = remaining goods + shipping; shipping equals `shippingKopecks(Order)`.

#### FR-9: Floor remaining goods at zero; empty Order is all zeros

The caller never receives negative money fields. An empty Order is zeros, including shipping. Realizes UJ-3.

**Consequences (testable):**
- Spec AC-4 (fixed Coupon larger than goods: remaining goods 0, shipping still due).
- Spec AC-8 (empty Order, Gold, valid percent typed code: all fields 0).

### 4.5 Public function contract

**Description:** One named export. Seeded types and `pricing.ts` helpers are reused, not rewritten. Technical signature detail lives in the addendum; this FR is the product commitment. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-10: `priceOrder(Order, catalog, asOf) → PriceBreakdown`

The caller can price any Order against a catalog at asOf and receive the six integer fields. No other public discount APIs.

**Consequences (testable):**
- Signature and field names match spec §5.
- Implementation reuses `subtotalKopecks`, `shippingKopecks`, `tierPercent`; does not change those signatures or `types.ts` shapes.
- Existing eight `pricing.ts` tests remain green.

## 5. Non-Goals (Explicit)

- Checkout UI, receipt copy, analytics, redemption persistence, “code already used.”
- Coupon catalog CRUD, usage caps, personal codes, a “smart” best-price permutation of typed codes.
- Discounting shipping; free-shipping-from-amount; throwing on bad typed codes; per-code discount arrays or skip-reason lists on PriceBreakdown.
- Changing `app/src/pricing.ts` signatures or `app/src/types.ts` shapes.
- Validating dirty LineItems (negative price/quantity) or catalog garbage (`percent` outside 0–100, empty codes). Catalog treated as valid; spec D-22 stays unspecified.
- Campaign KPIs (redemption rate, GMV lift). This module cannot observe them.
- Marketplace, points program, promo platform, or personalization engine.
- Re-implementation of the engine. `app/src` is already shipped and frozen for Task E; this PRD is planning reconstruction, not a build ticket.

## 6. MVP Scope

### 6.1 In Scope

- Tier discount via existing `tierPercent` on goods.
- 0..n eligible typed codes from catalog, sequential, typed order.
- Percent and fixed; optional category; optional min on original goods subtotal.
- Integer kopiyky; half-up per percent step (spec D-4).
- Split tier discount vs coupon discount; explicit asOf; silent skip; floor at 0.

### 6.2 Out of Scope for MVP

Everything in §5. Next honest step after this increment (not this PRD): UI and persistence so silent skips become visible and redemptions are stored.

## 7. Success Metrics

Success is spec acceptance and invariants, not campaign KPIs.

**Primary**

- **SM-1:** Every spec AC-1…AC-17 has a vitest named with that AC id, and it passes. Validates FR-1…FR-9.
- **SM-2:** On every returned PriceBreakdown, all six fields are integers ≥ 0, remaining goods and total identities hold, shipping matches `shippingKopecks(Order)`. Validates FR-8, FR-9, FR-10.
- **SM-3:** The seeded eight `pricing.ts` tests stay green. Validates FR-10.

**Counter-metrics (do not optimize)**

- **SM-C1:** Total discount amount. Counterbalances SM-1 — a best-of or reorder optimizer would raise discount and violate sequential stacking.
- **SM-C2:** Exception rate on `priceOrder`. Counterbalances SM-2 — throwing on expired typed codes is not quality.

## 8. Why Now

Growth’s autumn campaign is two weeks out. Loyalty is a dead field; Coupons do not exist. Unwritten stacking (additive vs sequential) is ~15 грн on a 1 000 грн Order — at campaign volume that is **money, not style**. The spec already closed the forks; this PRD exists so architecture does not rediscover them.

## 9. Cross-Cutting NFRs

- **Determinism:** Same Order + catalog + asOf → same PriceBreakdown. No wall clock, no IO, no randomness.
- **Money:** Integer kopiyky only; half-up only at percent steps (spec D-4); no second rounding on total.
- **Failure mode:** Function always returns; typed-code problems are silent skip.
- **Compatibility:** Seeded `pricing.ts` / `types.ts` contract unchanged.

## 10. Constraints and Guardrails

- **Safety (money):** remaining goods ≥ 0; shipping not used as a discount sink; no float amounts.
- **Cost:** No extra infrastructure. In-process function.
- **Privacy:** No PII beyond what Order already carries; no new telemetry.

**Risk (short):** Two environments rounding differently. Mitigation is the spec algorithm plus AC tests, not a new policy.

## 11. Integration and Dependencies

- **Must reuse:** `subtotalKopecks`, `shippingKopecks`, `tierPercent` from `app/src/pricing.ts`.
- **Must not modify:** those signatures; `Order` / `LineItem` / `Coupon` in `app/src/types.ts`.
- **Inputs the engine does not own:** catalog contents; asOf; how typed codes got onto the Order.
- **Downstream:** some other UI renders PriceBreakdown. Out of this increment.

## 12. API Contracts / Public Surface

Product-level: one function, one return type, six integer fields (FR-10). Breaking-change policy: do not change seeded types in this increment. Exact TypeScript surface and invariants: addendum / spec §5.

## 13. Open Questions

None that block architecture. Catalog-garbage behaviour (spec D-22) stays unspecified by design.

## 14. Decisions accepted at finalize

User accepted Fast-path inferences without correction (2026-09-02):

- Vision is this campaign increment only; no 2–3 year promo platform.
- Primary software user is the `priceOrder` caller; Growth sponsors; shopper is beneficiary; no UX personas.
- User journeys downscaled to library calls; no screen flows.
- Unknown `customerTier` values remain outside the Order contract.
- Catalog treated as valid; D-22 unspecified.
- Engine already implemented and frozen; this PRD is planning reconstruction, not a build ticket.
- Success = spec ACs + invariants; no redemption/GMV metrics.
