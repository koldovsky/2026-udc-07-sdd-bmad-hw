---
title: Input reconciliation — product brief
status: draft
created: 2026-09-02
updated: 2026-09-02
source: _bmad-output/planning-artifacts/briefs/brief-2026-udc-07-sdd-bmad-hw-2026-09-02/brief.md
compared:
  - _bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/prd.md
  - _bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/addendum.md
---

# Input reconciliation: Product Brief

Extract-only. Source brief and PRD/addendum were not edited. Coverage is against `prd.md` + PRD `addendum.md` only (not the brief’s own addendum).

## Source

- **Input:** Product Brief — Checkout discounts (loyalty + coupons)
- **Path:** `_bmad-output/planning-artifacts/briefs/brief-2026-udc-07-sdd-bmad-hw-2026-09-02/brief.md`
- **Status on source:** `ready` (2026-09-02)

## Extract

### Problem

Growth cannot launch the autumn campaign. Loyalty is a dead field: the customer has a tier; checkout never subtracts it. There is no coupon path.

Two implementations of the same ticket would not match. “Together” might mean 10%+15%=25% or sequential application off the remainder — 15 грн difference on a 1 000 грн order. Category coupons, minimums, expiry, and half-kopiyka rounding each fork again. At campaign volume that is money, not style.

How they cope today: unused `tierPercent`; manual promo exceptions, or no stacking story. Shoppers do not feel both benefits because neither line exists on a breakdown.

Cost of the status quo: the campaign slips, or it ships with silent kopiyka disagreement between environments. Trust in the receipt dies first.

**Coverage:** Present in PRD §1 (dead `tierPercent`, no coupon path, cannot “feel both”), §8 (two weeks, 15 грн on 1 000 грн, campaign volume is money), §10 risk (two environments rounding differently). Addendum “Options considered” restates the additive-vs-sequential 15 грн fork. **Dropped:** “money, not style”; current-state “manual promo exceptions, or no stacking story”; “trust in the receipt dies first” (see Gaps).

### Solution

A domain library function `priceOrder(order, catalog, asOf) → PriceBreakdown` on the existing seeded contract (`Order`, `LineItem`, `Coupon`; integer kopiyky; `subtotalKopecks` / `shippingKopecks` / `tierPercent` unchanged).

On a receipt the shopper (via some other UI, out of scope) should see, in this order:

1. Goods subtotal
2. Loyalty discount (Silver / Gold / none)
3. Coupon discount (sum of valid codes, in typed order)
4. Shipping (unchanged by discounts)
5. Total = remaining goods + shipping

Invalid, expired, unknown, duplicate, or ineligible codes contribute 0 and do not throw. Expiry uses the caller’s `asOf`, never `Date.now()` inside the engine.

Normative arithmetic and every numeric example live in the spec. Product commitment: **one breakdown, two visible benefits, no negative goods, shipping not on sale.**

**Coverage:** PRD §1, FR-1…FR-10, §9 (determinism / asOf), addendum mechanism (`priceOrder` + six fields). Receipt composition is carried as PriceBreakdown fields and FR-8 split lines, not as a numbered shopper-facing receipt. The punchy product-commitment sentence is split across FRs; substance is kept.

### Who

The software user is the caller of `priceOrder`. Growth sponsors. The shopper benefits. No UX personas.

| Role | Need | Success looks like |
|------|------|--------------------|
| Sponsor — Head of Growth | Autumn campaign: tiers live, coupons combinable with tiers | Both lines non-zero on a qualifying Gold + valid-code receipt |
| Primary user — checkout / pricing caller | Deterministic `PriceBreakdown` from current `Order` + catalog + `asOf` | Same inputs → same kopiyky; no exceptions for bad codes |
| Beneficiary — shopper | Feels loyalty *and* promo without a negative basket | Separate lines; goods never below 0; delivery fee still due |

**Coverage:** PRD §2 (assumption matches), §2.1 JTBD (caller functional + contextual, sponsor functional, shopper emotional: dead badge / promo did something / not a negative basket), §2.2 non-users, UJ-1…UJ-3. Delivery-fee-still-due is FR-8 / D-2, not a named shopper success line.

### Success

- Every acceptance criterion in the spec (AC-1…AC-17) has a named test. The existing eight `pricing.ts` tests stay green.
- Invariant on every return: six fields integers ≥ 0; `remainingGoods = subtotal − tier − coupons`; `total = remainingGoods + shipping`; `shipping` equals `shippingKopecks(order)`.
- Gold 1 000 грн UA, no codes: tier 100 грн, shipping 49 грн, total 949 грн (AC-1). An expired code does not change that and does not throw (AC-2).
- No campaign KPIs (redemption rate, GMV lift): they are not in the ticket, and this module cannot observe them.

**Coverage:** PRD §7 SM-1…SM-3 and the no-KPI assumption; AC-1 / AC-2 also appear as FR-1 / FR-6 consequences. Counter-metrics SM-C1 / SM-C2 are PRD additions, not brief content.

### In / Out

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

**Coverage:** PRD §5 Non-Goals and §6 MVP map 1:1. Catalog-valid / D-22 assumption is explicit. Frozen engine / no re-implementation is a PRD assumption, consistent with the brief’s “already implemented and frozen.”

### Vision

Horizon is this campaign increment, not a 2–3 year promo platform. If it succeeds, the next honest step is **UI and persistence** (surface silent skips, store redemptions) — still out of this brief. We will not invent a marketplace or points program to fill a vision section.

What makes this different (brief § What Makes This Different): there is no moat. The advantage is **decisions written down before code**: sequential stacking (tier first), goods-only base, half-up per percent step, all valid codes in typed order, silent skip, floor at 0. Alternatives (best-of set, additive percents, discount including shipping, a “smart” optimizer) were rejected because they would make two engineers diverge. This is not a promo platform or personalization engine.

**Coverage:** PRD §1 horizon + not a promo platform / personalization engine / checkout UI; §6.2 next honest step = UI and persistence. Addendum rejected alternatives and Research note (“Positioning is ‘decisions written down before code’”). **Dropped:** “there is no moat”; explicit refusal to invent a marketplace or points program (see Gaps).

### Adjacent brief claims (not in the six extract slots, for completeness)

- Forks already closed in `docs/spec/pricing-discounts.md` (D-1…D-28, AC-1…AC-17); brief does not reopen them; if PRD and spec conflict, **the spec wins**. → PRD §0.
- Engine already implemented and frozen. → PRD §5 / §14 assumption.
- Pure pricing function, not a checkout UI. → PRD §0, §1, §2.2.

## Qualitative ideas the FR structure dropped

These are tone, voice, and feel — not missing FRs. Substance of stacking, split lines, and silent skip is in the PRD; the shopper-facing language is not.

1. **Trust in the receipt dies first.** Status-quo cost is framed as shopper trust collapsing before GMV. Success metrics are AC tests and invariants; no trust/receipt-feel criterion.
2. **Feel both benefits / loyalty is a dead field.** Brief: shoppers do not feel both because neither line exists on a breakdown. PRD Vision and shopper JTBD keep “feel both” and “dead badge,” but FRs only require two integer fields on `PriceBreakdown`, not a felt receipt.
3. **There is no moat; the advantage is decisions written down before code.** Positioning is reproducibility of policy so two engineers do not diverge — not a feature. Addendum Research cites the phrase; the PRD narrative does not carry “no moat.”
4. **Money, not style.** The 15 грн example is in §8; the brief’s insistence that this is money rather than taste is gone.
5. **Product commitment as one sentence:** “one breakdown, two visible benefits, no negative goods, shipping not on sale.” Split across FR-7…FR-9; the slogan is not kept.

## Gaps

Items in the brief that are absent from `prd.md` and PRD `addendum.md` (not merely rephrased).

1. **Trust in the receipt dies first.** Cost of status quo in the brief. PRD has campaign timing, 15 грн, and a rounding-risk line. It does not say receipt trust is the first casualty.
2. **How they cope today: manual promo exceptions, or no stacking story.** PRD keeps unused `tierPercent` and “no coupon path.” It does not record the operational workaround (manual exceptions / no stacking story).
3. **There is no moat.** Brief’s explicit anti-positioning. Addendum keeps “decisions written down before code” as a research skip note, not as a product claim. “No moat” itself is not in the PRD or addendum.
4. **We will not invent a marketplace or points program to fill a vision section.** PRD refuses a 2–3 year promo platform / personalization engine / checkout UI. It does not name marketplace or points program as the thing not to invent.

No further brief-to-PRD gaps in problem, solution, who, success, in/out, or vision beyond these four. Spec-wins, frozen engine, in/out lists, ACs, and the three roles are captured.
