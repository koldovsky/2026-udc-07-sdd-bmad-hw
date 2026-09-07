---
title: Dev handoff — checkout discounts (planning reconstruction)
role: Amelia (Dev)
status: description-only
created: 2026-09-02
engine: frozen
---

# Dev handoff

Role: Amelia. Intent: reconstruct the next implementation step. No `bmad-build`. No code. No tests. `app/src` untouched.

Sources: PRD FR-1…FR-10, addendum signature, spine AD-*, spec D-1…D-28 / AC-1…AC-17. **Spec wins** on arithmetic conflict (`docs/spec/pricing-discounts.md` §3).

## 1. Already done and frozen

Production engine shipped in Task C. Task E does not reopen it.

| Surface | Location | Frozen as |
| --- | --- | --- |
| `priceOrder(order, catalog, asOf) → PriceBreakdown` | `app/src/discounts.ts` | named export; six integer fields ≥ 0 |
| `PriceBreakdown` | `app/src/discounts.ts` (not `types.ts`) | re-exported from `app/src/index.ts` |
| Seeded contract | `app/src/types.ts`, `app/src/pricing.ts` | shapes and helper signatures unchanged |
| Barrel | `app/src/index.ts` | re-exports `priceOrder` + `PriceBreakdown` from `./discounts.js` |
| AC tests | `app/src/discounts.test.ts` | `it("AC-N: …")` for **AC-1 … AC-17** |
| Seeded pricing tests | `app/src/pricing.test.ts` | eight tests stay green |
| A/B fork | `app/src/run-b/` | Task D artifact only — not production |

Coverage already locked: AC-1 Gold; AC-17 Silver; AC-2 expiry silent skip; AC-3 two category coupons; AC-4 floor at 0; AC-5 sequential not additive; AC-6 category base; AC-7 min on original goods; AC-8 empty cart zeros; AC-9 half-up; AC-10 shipping out of tier base; AC-11 typed order mixed kinds; AC-12 first duplicate only; AC-13 unknown skip; AC-14 min fail skip; AC-15 trim/case; AC-16 wrong-category skip.

Do not edit those files. Do not add a second public discount API.

## 2. What Dev would do next (if the engine did not exist)

Hypothetical TDD sequence only. Reconstructs `discounts.ts` against the spec. **Not scheduled. Not executed.**

Modules that would be created (none of these writes happen now):

- `app/src/discounts.ts` — `PriceBreakdown` + `priceOrder` + private helpers (`percentToKopecks`, catalog match, eligibility). Pipeline stays in one module (AD-9).
- `app/src/discounts.test.ts` — one `it("AC-N: …")` per AC, red → green → refactor.
- `app/src/index.ts` — named re-export only. No `run-b/` on the barrel (AD-12).

Reuse, never rewrite: `subtotalKopecks`, `shippingKopecks`, `tierPercent`, `lineTotalKopecks` from `pricing.ts`.

Story order (pipes-and-filters, test-first):

| Story | Slice | Module work | ACs that turn green | FRs |
| --- | --- | --- | --- | --- |
| S1 | Public contract + empty cart | `PriceBreakdown`, `priceOrder` stub, barrel re-export | AC-8 | FR-9, FR-10 |
| S2 | Tier filter on full goods | call `tierPercent`; half-up private helper; shipping sidecar unused as base | AC-1, AC-17, AC-9, AC-10 | FR-1, FR-8 |
| S3 | One eligible coupon after tier | percent/fixed on remaining; category vs original `lineTotalKopecks` snapshot; cap by remaining | AC-5, AC-6, AC-4 | FR-2, FR-3, FR-8, FR-9 |
| S4 | Eligibility / silent skip | required `asOf` (no `Date.now()`); min vs original subtotal; trim/case match; never throw | AC-2, AC-7, AC-13, AC-14, AC-15, AC-16 | FR-4, FR-5, FR-6, FR-7 |
| S5 | n coupons, typed order | unique after trim/case; first catalog hit; no reorder, no best-of, no count cap | AC-3, AC-11, AC-12 | FR-2, FR-8 |

Gate after S5: every AC-1…AC-17 named and passing; remaining goods and total identities on every return; eight `pricing.ts` tests still green. No extra public helpers. No skip-reason field.

## 3. Why this step is not executed here

`app/src/discounts.ts` already implements `priceOrder`. AC-1…AC-17 already pass. PRD §5 / §14 and spine AD-12: engine is the canonical production path and **frozen**.

Task E Path 1 is **planning reconstruction by role** (Analyst → PM → Architect → Dev). Dev’s deliverable is this handoff, not a second implementation.

Invoking `bmad-build` / `bmad-dev-story` would rewrite frozen homework artifacts. Menu **BD declined**.

## 4. ADs that must hold so a later build would not drift from the spec

Enough to keep a reconstruction honest. Cite, do not re-derive kopiyky.

- **AD-1 — Spec is arithmetic authority.** `docs/spec/pricing-discounts.md` wins over PRD, spine, ticket, and code. Cite D-ids / AC-ids. Do not invent a second algorithm.
- **AD-3 — Single public discount surface.** Only `priceOrder(order: Order, catalog: Coupon[], asOf: Date): PriceBreakdown` and `PriceBreakdown` from `discounts.ts`. Helpers stay private. No skip-reason DTO.
- **AD-4 — Frozen seeded contract.** Do not change `types.ts` or `pricing.ts`. Call the existing helpers; do not fork subtotal / shipping / tier math. Half-up stays private in `discounts.ts`.
- **AD-9 — Pipeline composition.** Tier first on full goods, then each eligible coupon in typed order. Category percents from original category snapshots, then cap by remaining. `minSubtotalKopecks` vs original subtotal. Scalar `remaining` — no leftover map, no best-of, no coupon-count cap, shipping never in the pipe.
- **AD-12 — Canonical engine.** Production is `app/src/discounts.ts`. `app/src/run-b/` is Task D only; do not re-export it from `index.ts`.

---

Handoff complete. Next participant artifact (`docs/task-e-bonus.md`) is **not** written until asked.
