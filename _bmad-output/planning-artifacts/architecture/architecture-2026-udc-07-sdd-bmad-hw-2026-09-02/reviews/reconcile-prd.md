---
title: Input reconciliation — PRD vs architecture spine
status: draft
created: 2026-09-02
updated: 2026-09-02
source: _bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/prd.md
compared:
  - _bmad-output/planning-artifacts/architecture/architecture-2026-udc-07-sdd-bmad-hw-2026-09-02/ARCHITECTURE-SPINE.md
---

# Input reconciliation: PRD → spine

Extract-only. PRD, addendum, spec, `app/src`, and the spine were not edited except this file.

**Conflict rule:** if PRD and spec disagree, **the spec wins**. The spine must not reopen D-1…D-28. This review does **not** demand the spine restate kopiyky arithmetic (spec §3 / D-ids own that). A missing restatement of a D-fork is not a gap.

**What “landed” means here:** the PRD clause has a home on the spine — an `AD` Rule/Prevents, a convention row, the capability map, or Deferred — such that two units one level down cannot choose incompatibly. Product slogans that became enforceable rules count as landed. Arithmetic procedures that stay in the spec by design count as correctly **not** restated.

## Source

- **Input:** PRD: Checkout discounts (loyalty + coupons), status `final`
- **Path:** `_bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/prd.md`
- **Spine:** `ARCHITECTURE-SPINE.md` (draft, feature altitude, pipes-and-filters, AD-1…AD-12)
- **Spine `binds`:** FR-1…FR-10 (complete)
- **Memlog:** consulted only to tell distill-drop vs never-decided. Not an authority over the rendered spine.

## Verdict

**ok** — no missing `AD`. Every FR is on the capability map. Cross-cutting NFRs bind to AD-7, AD-6, AD-8, AD-4. Load-bearing non-goals are Prevents or Deferred. Quiet PRD constraints that an earlier distill had dropped (dirty LineItems; privacy / no new PII / no telemetry) now sit on Conventions + Deferred.

No leftover quiet item still needs an AD. Tone that did not become an `AD` is rationale, beneficiary JTBD, or Task E process — correctly omitted from a build-substrate.

**Missing ADs: none.**

**Leftover quiet items: none** that two stories could still choose incompatibly.

## FR-1…FR-10

| ID | PRD gist | Spine home | Verdict |
|----|----------|------------|--------|
| FR-1 | Silver 5% / Gold 10% / none 0 on goods via `tierPercent`; first; never shipping. Unknown `customerTier` outside Order contract. Do not change rates or add tiers. | Capability map → AD-4, AD-9. Pipeline: tier filter on full goods. Rates/tiers implied by frozen `pricing.ts` / `types.ts` (AD-4). Unknown-tier is spec D-26 — AD-1 + AD-4. | **Covered.** Do not add a rate-table AD. |
| FR-2 | 0..n typed codes; every eligible hit once, typed order; no best-of; no reorder; no count cap (D-27); catalog-only codes do not apply. | AD-9 (typed order after trim/case unique; no best-of; no coupon-count cap D-27). AD-11 (typed codes are caller-owned). D-13 stays with spec via AD-1. | **Covered.** Spine must not add a cap AD. |
| FR-3 | `percent` (base then half-up) and `fixed` (already kopiyky). D-21, D-20. | Map → AD-6, AD-1. AD-6 cites spec §3 / D-4; does not invent a second formula. | **Covered.** Arithmetic stays in spec. |
| FR-4 | `minSubtotalKopecks` and category gates on **original** goods; min can pass after tier would have dropped remainder. | Map → AD-1, AD-9, AD-11. AD-9 Rule: min vs original `subtotalKopecks(order)`, including category coupons (D-6, D-19). Coupon stage reads original goods subtotal (min) and original category totals. | **Covered.** Do not add an AD that restates D-6/D-19 as a second algorithm. |
| FR-5 | Conservative match: trim, case-insensitive, empty ignored, first catalog row wins; unknown → silent skip; catalog-only does not apply. | Map → AD-1, AD-8. AD-8 Rule: duplicate identity is `trim` + case-insensitive (D-14, D-15); first catalog row wins on case-duplicates. Empty-after-trim is spec §3 matching — both empty and unknown contribute 0 under AD-8. | **Covered.** Do not add a matching-algorithm AD. |
| FR-6 | Required `asOf`; never `Date.now()`; expiry per D-16 / D-17 including unparsable `expiresAt`. | AD-7 (required `asOf`, no wall clock/IO/random, no mutate `asOf`). Eligibility vs `expiresAt` cites D-16 / D-17. AD-8 lists unparsable as silent skip. | **Covered.** Further parse mechanics stay in spec. |
| FR-7 | Always return `PriceBreakdown`; silent skip only; no per-code reason list. | AD-8 (always return; no throw; no skip-reason field). AD-3 Prevents skip-reason DTOs. | **Covered.** |
| FR-8 | Sequential stacking; split tier vs coupon lines; goods-only; shipping not discounted; identities. | AD-9 (tier first, then typed coupons; shipping sidecar; category-bound vs original category, unbound vs remaining). AD-10 (six fields, identities). | **Covered.** Where PRD glossary says “each Coupon on remaining goods” as the percent base, spec D-5 wins; AD-9 follows the spec (see Conflicts). |
| FR-9 | Remaining goods floored at 0; empty Order all zeros including shipping. | AD-10 (all fields ≥ 0; empty `items` is all zeros). | **Covered.** |
| FR-10 | `priceOrder(Order, catalog, asOf) → PriceBreakdown`; six integer fields; reuse `pricing.ts`; do not change `types.ts`; no other public discount APIs; eight seeded tests stay green. | AD-3 (sole public surface + signature). AD-4 (frozen contract + must call seeded helpers). AD-12 (canonical engine). Conventions: tests + typecheck. | **Covered.** |

## NFRs (§9)

| PRD NFR | Spine home | Verdict |
|---------|------------|--------|
| Determinism: same Order + catalog + asOf → same breakdown; no wall clock, IO, randomness | AD-7 (binds “NFR determinism”) | **Covered.** |
| Money: integer kopiyky; half-up only at percent steps (D-4); no second rounding of total | AD-6 | **Covered.** Cites spec; does not replace §3. |
| Failure mode: always return; typed-code problems are silent skip | AD-8 | **Covered.** |
| Compatibility: seeded `pricing.ts` / `types.ts` unchanged | AD-4; map row “Compatibility with seeded tests” | **Covered.** |

## Constraints & guardrails (§10)

| PRD clause | Spine home | Verdict |
|------------|------------|--------|
| Safety: remaining goods ≥ 0; shipping not a discount sink; no float | AD-10, AD-9, AD-6 | **Covered.** |
| Cost: no extra infrastructure; in-process function | AD-2 | **Covered.** |
| Privacy: no PII beyond what Order already carries; no new telemetry | Conventions: logging/auth/config **none**; **no new PII fields; no telemetry**. Deferred names telemetry/logging/auth. AD-2 no network/filesystem. AD-10 exactly six integer fields. | **Covered** (named, not merely implied). |
| Risk: two environments rounding differently → spec algorithm + AC tests, **not a new policy** | AD-1 (spec is arithmetic authority). Conventions: AC-1…AC-17 named tests. AD-6 does not invent a second rounding rule. | **Covered.** Spine correctly refused a new rounding AD. |

## Non-goals (§5) and MVP out-of-scope (§6.2)

| PRD non-goal | Spine home | Verdict |
|--------------|------------|--------|
| Checkout UI, receipt copy, analytics, redemption persistence, “code already used” | Deferred (UI, skip-reason copy, analytics, telemetry, logging, auth, redemption store) | **Covered.** |
| Catalog CRUD, usage caps, personal codes, best-price permutation | Deferred CRUD/caps/personal; AD-9 Prevents best-of / reorder | **Covered.** |
| Discounting shipping; free-shipping-from-amount; throw on bad codes; per-code arrays / skip-reason lists | AD-9 sidecar; AD-10 `shipping equals shippingKopecks(order)` (blocks free-shipping-from-amount in this module); AD-8; AD-10 no per-code array | **Covered.** Free-shipping is not named in Deferred; identities already forbid it. |
| Changing `pricing.ts` signatures or `types.ts` shapes | AD-4 | **Covered.** |
| Validating **dirty LineItems** (negative price/quantity) **or** catalog garbage (D-22); catalog treated as valid | Deferred + Errors: both catalog garbage / D-22 **and** dirty LineItems (negative price/quantity); no extra validator | **Covered.** |
| Campaign KPIs (redemption, GMV); module cannot observe them | Deferred analytics/telemetry; AD-2 no extra infra | **Covered.** |
| Marketplace, points, promo platform, personalization | AD-2 (no extra infra / no UI / no DB-backed promo service); Deferred next increment | **Covered** by scope, not named one-by-one. Not a missing AD. |
| Re-implementation of the engine; `app/src` frozen; PRD is planning reconstruction not a build ticket | AD-12 (canonical engine = `discounts.ts`; `run-b/` is Task D only). Purpose remains build-substrate (ratify, don’t fork). Task E “don’t edit `app/src`” is **this planning run**, not a product AD. | **Covered** as architecture. Do not encode homework process as AD-13. |

§6.2 next honest step (UI + persistence so silent skips become visible) is copied into Deferred almost verbatim. **Covered.**

## Success metrics (§7)

| Metric | Spine home | Verdict |
|--------|------------|--------|
| SM-1: vitest per AC-1…AC-17, titles carry the id | Conventions Tests: `discounts.test.ts`; each `it(...)` starts with `AC-N:` | **Covered.** |
| SM-2: six fields integers ≥ 0; remaining/total identities; shipping matches helper | AD-10 | **Covered.** |
| SM-3: seeded eight `pricing.ts` tests stay green | Conventions Tests | **Covered.** |
| SM-C1: do not optimize total discount (best-of / reorder) | AD-9 Prevents best-of, reorder, additive percents, coupon-count cap | **Covered** as Prevents, not named SM-C1. |
| SM-C2: do not treat throws as quality | AD-8 | **Covered** as Prevents, not named SM-C2. |

Campaign KPIs are explicitly not success. Spine does not introduce them. **Covered.**

## Tone, vision, users (quiet)

This is the hunt for a quiet requirement (tone, constraint) the `AD` structure dropped.

| PRD voice | Did it need an AD? | Where it went |
|-----------|-------------------|---------------|
| “One breakdown, two visible benefits, no negative goods, shipping not on sale” | Yes — product commitment that would fork a result type | AD-3, AD-10, AD-9. Landed as rules, not a slogan. |
| “If two environments disagree on kopiyky, trust in the receipt dies first” | Yes — determinism + one arithmetic authority | AD-1, AD-6, AD-7, AC-named tests. |
| Horizon = this campaign increment; not a promo platform | Yes — scope | AD-2 + Deferred next increment. |
| Primary software user = `priceOrder` caller; shopper is beneficiary; no UX personas / screen flows | Yes — boundary | AD-2 (no UI); journeys downscaled to library. |
| Shopper emotional JTBD (“loyalty was not a dead badge”) | No — beneficiary of split lines, not a module invariant | Realized by FR-8 / AD-10. Correctly not an AD. |
| “Advantage is decisions written down before code” / Why Now 15 грн stacking | No — rationale | Memlog / AD-1 Prevents reopening stacking. Spine correctly omits rationale. |
| UJ-1 / UJ-2 / UJ-3 | Capabilities, not extra ADs | Realized by FR-1…FR-9 on the map. |
| §14: catalog valid; D-22 unspecified; success = ACs + invariants | Open/non-goal | Deferred D-22; test conventions. |
| Privacy / no new PII / no telemetry | Yes — quiet NFR | Conventions logging/auth/config row. Landed. |
| Dirty LineItems: do not add a validator | Yes — quiet non-goal beside D-22 | Deferred + Errors. Landed. |
| Task E freeze / “planning reconstruction, not a build ticket” | No — process for this run | Memlog constraint. AD-12 ratifies the canonical engine without encoding “do not implement.” |

§0 “spec wins; do not restate kopiyky; no UX spec; internal reconstruction” → AD-1, Deferred UI, AD-12. **Covered.**

No quiet PRD tone or constraint is still missing from the spine in a way that would let two stories diverge.

## Integration, API, open questions (§11–§13)

- Must reuse `subtotalKopecks`, `shippingKopecks`, `tierPercent`; must not modify those signatures or seeded shapes → **AD-4** (also requires `lineTotalKopecks`; brownfield extra, not a PRD drop).
- Engine does not own catalog, `asOf`, or how typed codes got onto the Order → **AD-11**.
- Downstream UI renders `PriceBreakdown` → **Deferred**.
- One function, one return type, six fields; no seeded breaking change → **AD-3, AD-4, AD-10**.
- Open questions: none that block architecture; D-22 unspecified → **Deferred**.

## PRD vs spec (spec wins)

These are **not spine gaps**. The spine followed the spec, which is the PRD’s own conflict rule.

1. **Category percent base.** PRD glossary “original goods subtotal … used … as the category percent base” can be read as whole-cart original goods. Spec D-5 / AC-3: original **category** `lineTotalKopecks` snapshots, then cap by remaining. PRD FR-4 consequences already cite AC-3. **AD-9 Rule matches the spec**, not the sloppy glossary clause.
2. **“Each eligible Coupon on remaining goods.”** PRD sequential-stacking glossary restates D-1’s default. Spec D-5 / D-10 specialize category-bound codes. **AD-9 states both** (uncategorized vs remaining; category-bound vs original category). Do not revert AD-9 to the PRD’s shorter sentence.

## Correctly not restated (do not add)

Parent must **not** treat these as spine gaps:

- Percent→kopiyky procedure, remainder ≥ 50, worked AC kopiyky.
- D-5 / D-6 / D-19 original bases as a *second* algorithm (AD-9 already names the bases; AD-1 Prevents reopening them).
- D-15 trim/case match *procedure* beyond the identity key already in AD-8 / AD-9.
- D-16 / D-17 parse mechanics beyond the eligibility instant already in AD-7.
- D-20 / D-21 fixed-unit and category caps as extra ADs.
- D-27 “no coupon-count cap” as its own AD (already in AD-9 Prevents/Rule).
- Additive-vs-sequential worked example (Why Now 15 грн). Spec AC-5 / D-1; AD-9 already forbids additive percents.
- Empty-after-trim skip as its own Rule (unknown and empty both contribute 0 under AD-8).
- Homework process: do not edit `app/src`, do not run `bmad-build`.

## Prior findings (closed against this spine)

An earlier PRD reconcile against a pre-tighten draft recorded three leftovers. Against the current spine:

1. **Dirty LineItems unnamed beside D-22** — **closed.** Deferred and Errors now name dirty LineItems (negative price/quantity) next to D-22.
2. **Privacy NFR implied, not named** — **closed.** Conventions: no new PII fields, no telemetry.
3. **FR-1 “don’t change `tierPercent` rates or add tiers” unnamed** — still implied by AD-4. **Ignore** (not a missing AD).

Do not re-open those as Finalize work.

## Findings

**None.** No missing AD. No quiet PRD constraint still dropped. No contradiction in the PRD→spine direction.

Spine extras that are not PRD drops (compatible, spec/brownfield): `lineTotalKopecks` must be called (AD-4); `PriceBreakdown` lives in `discounts.ts` not `types.ts` (AD-3); `app/src/run-b/` isolated (AD-12).

## Contradictions

**None** in the PRD→spine direction.

Checked: sequential vs additive; goods-only vs shipping-in-base; always-return vs throw; split lines vs per-code array; required `asOf` vs wall clock; in-process vs HTTP/UI; spec-wins vs a second algorithm; original min vs remaining-as-min; category original base vs remaining-as-percent-base. Spine matches the PRD’s product commitments and, where the PRD glossary is shorter than D-5, follows the spec.

## Gaps

**No missing AD. No leftover quiet item that still needs a home.**
