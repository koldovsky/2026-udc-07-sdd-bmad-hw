---
title: Input reconciliation — brief addendum
source: _bmad-output/planning-artifacts/briefs/brief-2026-udc-07-sdd-bmad-hw-2026-09-02/addendum.md
compared_against:
  - _bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/prd.md
  - _bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/addendum.md
status: complete
created: 2026-09-02
---

# Reconcile: brief addendum

Source is the locked-policy addendum attached to Mary’s product brief. It is not the executive brief itself. Purpose of this extract: confirm D-1…D-28 and Task E constraints survived into the PRD addendum (and note PRD-body coverage where it duplicates them). Paraphrase that keeps meaning is not a gap.

## Source purpose (survived)

| Source claim | Where it landed |
|--------------|-----------------|
| Not part of the executive brief; compresses what Product must not rediscover or reopen | PRD addendum intro: mechanism + locked-policy extract + rejected alternatives so they are not rediscovered in the PRD |
| Downstream PRD / architecture cite `docs/spec/pricing-discounts.md` as source of truth | PRD §0 (spec wins on disagreement); PRD addendum intro (architecture treats spec as SoT for arithmetic) |

## Locked policy D-1…D-28

Every ID from the brief table is present in the PRD addendum table **Locked policy (spec D-1…D-28)**, with the same bundling (D-6/D-19, D-7/D-11, D-8/D-12/D-18/D-24, D-16/D-17). Additional FR/glossary hits are listed so the parent can see they were not dropped from the narrative either.

| ID | Brief rule (compressed) | PRD addendum | Also in PRD body | Gap? |
|----|-------------------------|--------------|------------------|------|
| D-1 | Sequential: tier first on full goods, then each coupon on remaining goods. Percents not added (not 10+15=25). | Same; table omits the “10+15=25” parenthetical | Glossary “sequential stacking” keeps “not 10+15=25”; FR-8 + AC-5 consequence | No — parenthetical kept in glossary |
| D-2 | Discount base = goods (`subtotalKopecks`). Shipping never in base, never reduced. | Same; table drops the helper name | Glossary goods subtotal / shipping; FR-8; §5; §9 Money | No — helper named in Mechanism + §11 |
| D-3 | All **valid** codes in **typed order**. No best-of. Invalid skipped; rest continue. | **eligible** / **ineligible** wording | FR-2, FR-7; glossary silent skip | No — synonym, same rule |
| D-4 | Each percent step → integer kopiyky half-up (remainder ≥ 50). Fixed already integer. Integer arithmetic only. | Same | Glossary half-up; FR-3; §9 Money | No |
| D-5 | Category percent from **original** category line totals, then cap by remaining goods. | “LineItem totals” | FR-3; glossary original goods / category base | No |
| D-6 / D-19 | `minSubtotalKopecks` vs **original** order goods subtotal, including for category coupons. | “original goods subtotal” | FR-4 (incl. AC-7, AC-14, D-19 consequence) | No |
| D-7 / D-11 | Remaining goods ≥ 0. `total = remainingGoods + shipping`. | Same (prose field names) | FR-8 invariant; FR-9; SM-2 | No |
| D-8 / D-12 / D-18 / D-24 | Expired, unknown, unparsable expiry, wrong category → silent skip, never throw. Always return PriceBreakdown. | Same | FR-6, FR-7; UJ-2; §5 | No |
| D-9 | Mixed percent + fixed: typed order, no “all percents first.” | Same | FR-2 AC-11 | No |
| D-10 | Two codes on one category: both, sequential, same original category base, each capped by remaining. | “remaining goods” | FR-2 AC-3 | No |
| D-13 | Catalog-only codes (not typed) do not apply. | Same | FR-5; glossary catalog | No |
| D-14 | Duplicate typed code: **first** occurrence only. | Same | FR-2 AC-12 | No |
| D-15 | Trim + case-insensitive match; first catalog hit wins on case-duplicates. | Same | FR-5 AC-15 | No |
| D-16 / D-17 | Required `asOf`. No `Date.now()`. `expiresAt` ISO; date-only = that day 00:00:00.000 UTC. Invalid if `asOf >= parse(expiresAt)`. | “Ineligible if…” | FR-6; glossary asOf | No — Invalid→Ineligible |
| D-20 | Fixed + category: `min(value, categorySubtotal, remainingGoods)`. | `min(value, category base, remaining goods)` | FR-3 | No — identifiers → glossary terms |
| D-21 | `Coupon.value` for `fixed` is kopiyky (100 грн = 10_000). | Same | FR-3 | No |
| D-22 | Invalid catalog values unspecified; no extra validator. | Same | §5 + §13; assumption index | No |
| D-23 | Empty cart: all zeros (shipping already 0). | Same | FR-9 / AC-8; UJ-3 | No |
| D-25 | Split tier vs coupon totals; no per-code array on the result. | Same | FR-7, FR-8, FR-10; §5 | No |
| D-26 | Quantity 0 → line 0, as today. Unknown tiers outside the `Order` contract. | Same | FR-1 assumption; §5 dirty LineItems | No |
| D-27 | No coupon-count cap. Shipping is not zeroed by discounts. | Same | FR-2 “no cap”; FR-8 shipping not discounted; §5 | No |
| D-28 | No best-order optimizer. Typed order only. | Same | FR-2; SM-C1; §5 | No |

**Coverage:** 28/28 IDs present in the PRD addendum locked-policy table. None dropped, none reopened as Open Questions.

### Wording diffs that are not gaps

- D-3 / D-16: brief “valid/invalid” → PRD “eligible/ineligible” (aligned with silent-skip glossary).
- D-1 table: dropped the numeric anti-example; retained in PRD glossary.
- D-2 table: dropped `` `subtotalKopecks` ``; retained in Mechanism / §11.
- D-20: `categorySubtotal` / `remainingGoods` → “category base” / “remaining goods”.

## Contract reminder (survived)

Source signature and six fields, plus reuse of `pricing.ts` / do-not-change `types.ts`, appear in PRD addendum **Mechanism / transport** (exact signature block) and in PRD FR-10 / §11 / §12. Not a gap.

## Rejected alternatives (survived)

Brief list: additive percents; shipping in the discount base; best-price permutation; throw on expired/unknown; floor total including shipping to zero via discounts; second rounding on the grand total; per-code discount array; UI/analytics in this increment.

PRD addendum **Rejected alternatives** keeps every item and slightly expands two (“of typed codes”; “UI/analytics/redemption store”). Also echoed in PRD §5. Not a gap; no revival in Open Questions.

## Task E constraints (this planning run)

Source three bullets, compared verbatim to PRD addendum **Task E constraints**:

1. Do not edit the spec, traceability, A/B write-up, SDD-tool note, walkthrough, ticket, or `app/src` discount/pricing implementation. — **identical**
2. New files only under `_bmad-output/planning-artifacts/` until the participant asks for `docs/task-e-bonus.md`. — **identical**
3. Dev role later: describe the next implementation step only — no `bmad-build`. — **identical**

PRD §5 also carries `[ASSUMPTION: this PRD does not authorize re-implementation; the engine in app/src is already shipped and frozen for Task E.]` — consistent, not a drop.

## Qualitative / tone (FR-structure drop check)

The brief addendum is policy compression, not voice/feel. No tone, brand, or UX-feel claims to preserve. The “do not rediscover / do not reopen” stance is preserved in both PRD §0 and the addendum intro. The extra PRD addendum sections (Mechanism, Options considered, Research skipped) are additive from other inputs, not drops from this source.

## Gaps

**None.** D-1…D-28 all present in the PRD addendum locked-policy table; Task E constraints copied in full; contract, rejected alternatives, and spec-as-SoT instruction survived.
