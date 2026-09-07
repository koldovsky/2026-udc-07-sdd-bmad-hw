---
title: Input reconciliation — pricing-discounts spec
status: draft
created: 2026-09-02
updated: 2026-09-02
source: docs/spec/pricing-discounts.md
compared:
  - _bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/prd.md
  - _bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/addendum.md
---

# Input reconciliation: Spec (`pricing-discounts.md`)

Extract-only. Source spec, `prd.md`, and `addendum.md` were not edited except this file.

**Coverage locations counted:** PRD FR bodies / **Consequences (testable)** and addendum **Locked policy (spec D-1…D-28)** table. Glossary, NFRs, non-goals, mechanism, and rejected-alternatives are noted when they carry a clause, but they do not by themselves close a D/AC unless the FR consequences or locked-policy row also holds it.

**Conflict rule:** if PRD/addendum and spec disagree, **the spec wins**. Contradictions would be **critical**. None found.

## Source

- **Input:** Специфікація: знижки на checkout (рівень лояльності + промокоди)
- **Path:** `docs/spec/pricing-discounts.md`
- **Status on source:** `agreed`

## Verdict

All **D-1…D-28** land in the addendum locked-policy table (some grouped). All **AC-1…AC-17** are cited by id in PRD FR consequences. No silent drop of a spec decision. No contradiction.

**Gaps: none.**

## D-1…D-28 coverage

| ID | Spec decision (gist) | Where it landed | Verdict |
|----|----------------------|-----------------|--------|
| D-1 | Sequential: tier first on full goods, then coupons on remaining. Percents not added. | Locked D-1. FR-8 consequences (AC-5). Glossary sequential stacking. | **Covered.** |
| D-2 | Base = goods only. Shipping not in base, not reduced. | Locked D-2. FR-1 (AC-10). FR-8. | **Covered.** |
| D-3 | All eligible typed codes in typed order. Skip ineligible; rest continue. No best-of. | Locked D-3. FR-2. | **Covered.** |
| D-4 | Each percent step half-up to integer kopiyky at apply time. Fixed already integer. No second rounding of total. Integer arithmetic only (no float amounts). | Locked D-4 (half-up, remainder ≥ 50, integer arithmetic). FR-1 (AC-9). FR-3. «No second rounding» is PRD §9 NFR + addendum rejected-alternatives, not the locked D-4 cell — still the same decision, not dropped. | **Covered.** |
| D-5 | Category percent from **original** category line totals, then cap by remaining goods. | Locked D-5. FR-3 (AC-6). Glossary category base. | **Covered.** |
| D-6 | `minSubtotalKopecks` vs **original** goods subtotal (before other discounts). Below min → skip. | Locked D-6/D-19. FR-4 (AC-7, AC-14). | **Covered.** |
| D-7 | Remaining goods ≥ 0. Shipping added after; not zeroed by discounts. | Locked D-7/D-11. FR-8 invariant. FR-9 (AC-4). | **Covered.** |
| D-8 | Expired → silent skip, no throw. | Locked D-8/D-12/D-18/D-24. FR-6 (AC-2). FR-7. | **Covered.** |
| D-9 | Mixed percent + fixed: typed order, no «all percents first». | Locked D-9. FR-2 (AC-11). | **Covered.** |
| D-10 | Two codes on one category: both, sequential, same original category base, each capped by remaining. | Locked D-10. FR-2 (AC-3). | **Covered.** |
| D-11 | `total = remainingGoods + shipping`; remainingGoods = subtotal − tier − coupon, ≥ 0. | Locked D-7/D-11. FR-8 invariant. | **Covered.** |
| D-12 | Typed code not in catalog → silent skip. | Locked D-8 group. FR-5 (AC-13). | **Covered.** |
| D-13 | Catalog-only codes (not typed) do not apply. | Locked D-13. FR-5. FR-2 description. | **Covered.** |
| D-14 | Duplicate typed code: first occurrence only. | Locked D-14. FR-2 (AC-12). | **Covered.** |
| D-15 | Trim + case-insensitive match; first catalog hit on case-duplicates. Empty after trim skipped. | Locked D-15. FR-5 (AC-15; empty trimmed strings ignored; first catalog row wins). | **Covered.** |
| D-16 | Required `asOf`. No `Date.now()` inside the engine. | Locked D-16/D-17. FR-6. Glossary asOf. | **Covered.** |
| D-17 | `expiresAt` ISO; date-only = that day 00:00:00.000 UTC. Ineligible if `asOf >= parse(expiresAt)` (inclusive). Unparseable → silent skip. | Locked D-16/D-17. FR-6 (parse fail + `asOf >= parse`). §4.3 description (ISO, date-only UTC, on-or-after). | **Covered.** |
| D-18 | Category code, no matching line → silent skip. | Locked D-8 group. FR-4 (AC-16). | **Covered.** |
| D-19 | Category coupon min is whole-order original goods subtotal, not category sum. | Locked D-6/D-19. FR-4. | **Covered.** |
| D-20 | Fixed + category: `min(value, category base, remaining goods)`. | Locked D-20. FR-3. | **Covered.** |
| D-21 | `Coupon.value` for `fixed` is kopiyky (100 грн = 10_000). | Locked D-21. FR-3. | **Covered.** |
| D-22 | Catalog garbage unspecified; no extra validator. | Locked D-22. PRD §5 / §13 / §14 assumption. | **Covered.** (Non-goal / open-question, not an FR consequence — locked-policy row is enough.) |
| D-23 | Empty cart: all zeros (shipping already 0). | Locked D-23. FR-9 (AC-8). UJ-3. | **Covered.** |
| D-24 | Always return `PriceBreakdown`. Never throw for codes. No skip-reason list. | Locked D-8 group. FR-7 (AC-2, AC-8, AC-13; no per-code reason list). | **Covered.** |
| D-25 | Split `tierDiscountKopecks` vs `couponDiscountKopecks` (sum of codes). Remaining goods + subtotal + shipping + total. No per-code array. | Locked D-25. FR-8. FR-10 (six fields). | **Covered.** |
| D-26 | `quantity: 0` → line 0, as today. Unknown `customerTier` outside the Order contract. | Locked D-26. Unknown-tier clause also in FR-1 `[ASSUMPTION]`. Quantity-0 is locked-policy only (no FR consequence) — still covered. | **Covered.** |
| D-27 | No coupon-count cap (except D-14). Shipping not zeroed by discounts. | Locked D-27. FR-2 (no cap on distinct typed codes). FR-8 (shipping not discounted). | **Covered.** |
| D-28 | No best-order optimizer. Typed order only. | Locked D-28. FR-2 (no best-of, no reordering). SM-C1. | **Covered.** |

Grouped locked-policy rows (D-6/D-19, D-7/D-11, D-8/D-12/D-18/D-24, D-16/D-17) keep every constituent rule; they are not silent merges that drop a fork.

## AC-1…AC-17 coverage

Default AC fixture (spec §4) is not restated as an FR; each AC’s **numeric / behavioral claim** is what must appear.

| ID | Spec claim (gist) | PRD FR / consequences | Verdict |
|----|-------------------|----------------------|--------|
| AC-1 | Gold, 100_000 goods, UA, no codes → tier 10_000, coupon 0, shipping 4_900, total 94_900. | FR-1 | **Covered.** |
| AC-2 | Same cart + `SAVE15` with `asOf === expiresAt` → coupon 0, tier 10_000, total 94_900, no throw. | FR-6; FR-7 | **Covered.** |
| AC-3 | Two `fresh` percents from original 50_000: 5_000+10_000; coupon 15_000; not best-of 10_000; not 30% of basket. | FR-2 | **Covered.** (Wrong-total counterexamples not restated; AC-3 id + original category base is enough.) |
| AC-4 | *(edge)* `none`, 10_000 goods, fixed 50_000 → coupon 10_000, remaining 0, shipping 4_900, total 4_900; no negative fields. | FR-9 | **Covered.** |
| AC-5 | Gold + 15% → tier 10_000 then coupon 13_500, total 81_400; not 25% off; not 15% of original. | FR-8 | **Covered.** |
| AC-6 | 10% `fresh` on 20_000 category → coupon 2_000, not 10% of 100_000; total 102_900. | FR-3 | **Covered.** |
| AC-7 | Gold 40_000 + 10% min 38_000: min on original 40_000 (passes) though post-tier 36_000 < min; coupon 3_600 of remainder. | FR-4 | **Covered.** (Kopiyky 3_600 / 37_300 not restated; AC-7 id + min-on-original is enough.) |
| AC-8 | *(edge)* `items: []`, Gold, valid 50% → all six fields 0, including shipping; no throw. | FR-9; FR-7 | **Covered.** |
| AC-9 | *(edge)* Gold, 125 digital → half-up tier 13 (not 12), shipping 0, total 112. | FR-1 | **Covered.** |
| AC-10 | Gold, 100_000, PL: tier 10_000 not 11_990; shipping 19_900; total 109_900. | FR-1 | **Covered.** |
| AC-11 | `SAVE10` then `OFF50` → coupon 15_000; reverse would be 14_500; engine does not reorder. | FR-2 | **Covered.** (14_500 counterexample not restated; swap-changes-kopiyky is.) |
| AC-12 | `["OFF100","OFF100"]` → coupon 10_000 not 20_000. | FR-2 | **Covered.** |
| AC-13 | `NOSUCH` then `SAVE10` → skip unknown, SAVE10 applies, no throw. | FR-5; FR-7 | **Covered.** |
| AC-14 | Min 40_000 on 30_000 goods → coupon 0, total 34_900. | FR-4 | **Covered.** |
| AC-15 | `" save10 "` matches catalog `SAVE10`. | FR-5 | **Covered.** |
| AC-16 | `FRESH10` on standard-only cart → coupon 0, total 104_900. | FR-4 | **Covered.** |
| AC-17 | Silver, 100_000 UA, no codes → tier 5_000, total 99_900. | FR-1 | **Covered.** |

## Adjacent spec material (not D/AC, for completeness)

| Spec clause | Where it landed | Note |
|-------------|-----------------|------|
| Goal: both benefits visible; remaining goods ≥ 0; shipping separate | Vision; FR-8; FR-9 | Covered as capabilities. |
| Out of scope: UI, CRUD, usage caps, dirty lines, throw, best-of, shipping discount, free-shipping-from-amount | PRD §5 / §6.2 | Covered. |
| Normative integer half-up algorithm (`product / 100`, `r >= 50`) | Addendum: «Normative algorithm … spec §3. Do not invent a second algorithm.» | Mechanism deferred to spec by design — not a dropped fork. |
| Contract: `priceOrder(Order, catalog, asOf) → PriceBreakdown`; six fields; reuse `pricing.ts`; do not change `types.ts`; re-export `index.ts`; tests `discounts.test.ts` named `AC-N:` | FR-10; addendum Mechanism | Covered. |
| Verify: 8 `pricing.ts` tests stay green; one test per AC | SM-1, SM-3 | Covered. Spec §6 also forbids extra tests without `AC-N:` prefix except seeded `pricing.test.ts` — PRD does not restate that forbid. Not a D/AC. Not counted as a gap. |
| `[ASSUMPTION]` engine already shipped and frozen (PRD §5 / §14) | PRD-only Task E frame | Does **not** contradict D/AC arithmetic. PRD §0: spec wins if they disagree. |

## Contradictions

**None.** Checked specifically:

- Sequential vs additive (D-1 / AC-5): PRD matches spec.
- Goods-only base vs goods+shipping (D-2 / AC-10): PRD matches.
- Inclusive expiry `asOf >= parse(expiresAt)` (D-17 / AC-2): PRD FR-6 matches.
- Fixed unit kopiyky not hryvnia (D-21): PRD matches.
- Category percent original base + remaining cap (D-5 / D-10 / AC-3 / AC-6): PRD matches.
- Always-return / silent skip (D-8 / D-24): PRD matches.
- Half-up 12.5 → 13 (D-4 / AC-9): PRD matches.
- Floor remaining goods, shipping still due (D-7 / AC-4): PRD matches.

PRD §0 already states the spec-wins rule.

## Qualitative / FR-structure notes (not gaps)

The spec is a machine contract, not a tone document. Nothing in D-1…D-28 or AC-1…AC-17 is «feel» that FRs would silently drop. Split lines, silent skip, and floor-at-zero are the spec’s product voice; they are in FR-7…FR-9.

## Gaps

**None.** Every D-1…D-28 is in the addendum locked-policy table and/or PRD FR consequences. Every AC-1…AC-17 is cited in PRD FR consequences. No spec decision was silently dropped or contradicted.
