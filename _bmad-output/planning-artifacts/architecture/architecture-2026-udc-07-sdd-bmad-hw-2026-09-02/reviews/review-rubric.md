# Rubric walker — `ARCHITECTURE-SPINE.md`

- **Lens:** good-spine checklist (`bmad-architecture` reviewer gate)
- **Spine:** `_bmad-output/planning-artifacts/architecture/architecture-2026-udc-07-sdd-bmad-hw-2026-09-02/ARCHITECTURE-SPINE.md`
- **Altitude:** feature (level below = epics / stories)
- **Context:** WS7 Task E planning reconstruction. Engine already implemented and frozen in `app/src/discounts.ts`. `docs/spec/pricing-discounts.md` wins on arithmetic. Brownfield ratify of the existing TypeScript domain library. No parent spine. Do not demand a rewrite or restating the full spec algorithm.
- **Mechanical lint:** `lint_spine.py --workspace` this run folder → `ok: true`, 0 findings (no TBD/TODO/`{tokens}`, AD-1…AD-12 monotonic, all Binds/Prevents/Rule present, Stack rows pinned).
- **Date:** 2026-09-02
- **Judged text:** the spine as of this gate (AD-3 typed signature; AD-7/AD-8/AD-11 immutability; AD-9 scalar remaining + original snapshots; AD-10 join-once). Prior rubric notes against the thinner AD-9 Rule are stale.

## Gate verdict

**pass.** The spine is a lean, brownfield-ratifying feature contract. It binds the divergences two epics/stories of this increment could actually take, sends kopiyky arithmetic to the spec via AD-1, and does not contradict `app/src`. Residual nits are overlap or Finalize hygiene. No rewrite.

---

## Checklist

### 1. Fixes the real divergence points for the level below (epics/stories) and misses none

**Pass.**

What two independently-built epics/stories of this increment could choose incompatibly, and whether the spine fixes it:

| Divergence | Bound by |
| --- | --- |
| HTTP / worker / DB / UI wrapper vs in-process function | AD-2 |
| Second public API, classes, skip-reason DTO, `PriceBreakdown` in `types.ts` | AD-3, AD-8, AD-10 |
| Fork `Order` / `LineItem` / `Coupon` or reimplement subtotal/shipping/tier | AD-4 |
| Import cycle / `pricing.ts` depending on discounts | AD-5 |
| Float money, `Math.round`, second round of total | AD-6 + AD-1 |
| `Date.now()` vs required `asOf`; mutating caller `Date` | AD-7, AD-11 |
| Throw / Result vs always-return | AD-8 |
| Additive percents, coupon-before-tier, best-of, leftover category map, filter framework, extra packages | AD-9 |
| Shipping inside remaining goods; extra breakdown fields; draft DTO mutation | AD-10 |
| Engine-owned catalog/clock; mutating caller objects; clone-and-mutate working cart | AD-11 |
| Promoting `app/src/run-b/` (extra `appliedCoupons` / `rejectedCoupons` / `merchandiseKopecks`, leftover map, default `new Date()`) as production | AD-12 |
| Stacking / bases / rounding / expiry / match / coupon-count cap | AD-1 → spec D-1…D-28 (correct altitude; not restated as a second algorithm) |

Missed architectural forks that would belong here: none that two stories of *this* increment could ship incompatibly. FR-4/FR-5 matching and original-goods gates are spec arithmetic; AD-1 plus AD-8/AD-9 citations are the right bind. Test naming and NodeNext `.js` imports live in conventions.

Empty-after-trim typed strings are not named in the AD-8 skip list; both stories still contribute 0 under AD-8 + FR-5. Not a hole.

**Do not rewrite:** capability map + 12 ADs already cover the feature cut. Do not paste spec §3 into a new AD.

### 2. Every AD’s Rule is enforceable and actually prevents its stated divergence

**Pass.**

| AD | Enforceable? | Prevents the stated divergence? |
| --- | --- | --- |
| AD-1 | Yes (review / traceability: cite D/AC; spec beats PRD/spine/code) | Yes — process invariant; stops architecture from reopening D-1…D-28 |
| AD-2 | Yes (no network/fs/infra in `app/`) | Yes |
| AD-3 | Yes (exports of `discounts.ts` / `index.ts`; signature pins `Order`, `Coupon[]`, `Date`) | Yes |
| AD-4 | Yes (diff + call sites) | Yes |
| AD-5 | Yes (import graph; mermaid matches Rule) | Yes |
| AD-6 | Yes (`percentToKopecks` / no float / no total re-round) | Yes; overlaps spec §3 (R-2) |
| AD-7 | Yes (no `Date.now` / IO / RNG; no `setUTC*` / `setTime`; `asOf` required) | Yes |
| AD-8 | Yes (return type; no throw in coupon path; no reason field; trim+case duplicate identity) | Yes |
| AD-9 | Yes: tier-then-coupons; typed order; unbound vs original-category bases; scalar `remaining` + read-only snapshots; no leftover map / split-line cart / framework / count cap | Yes. “Then both cap by remaining” is slightly looser English than spec `min(raw, categoryBase, remaining)` for fixed+category; D-20 is cited and AD-1 backstops (R-1) |
| AD-10 | Yes (six fields, identities, construct once at join) | Yes |
| AD-11 | Yes (no mutation of Order/items/catalog/`asOf`; no working-copy cart; local numeric accumulators only) | Yes |
| AD-12 | Yes (`index.ts` must not re-export `run-b`) | Yes — matches real extra types in `run-b` |

No AD has an empty or unenforceable Rule. AD-1 is governance rather than a type-checker, which is appropriate.

### 3. Nothing under Deferred could let two units diverge (if it could, it should be an AD)

**Pass.**

| Deferred item | Two epics of this feature could diverge? |
| --- | --- |
| Checkout-host deploy, environments, CI beyond `npm test`, cloud provider | No — AD-2 already forbids a deployable process. Correctly not an AD. |
| Catalog CRUD, persistence, usage caps, personal codes | No — out of increment; sneaking it in would violate AD-2/AD-11 |
| UI, skip-reason copy, analytics, telemetry, logging, auth | No — conventions already say none in this module |
| Catalog-garbage (D-22) / no validator for dirty LineItems | Convention + Deferred both say no extra validator. A throwing validator would also violate AD-8. Spec leaves garbage unspecified on purpose. Not a hole. |
| Bumping TS/vitest majors | Stack already pins homework ranges |
| Evolution of `run-b/` | AD-12 already forbids treating it as the engine |
| Next increment UI + persistence | Explicitly not this spine |

Nothing in Deferred is a silent live fork for the level below.

### 4. Named tech is verified-current or explicitly ratified brownfield pins

**Pass.**

Stack is the committed `app/package.json` + `app/AGENTS.md` + `app/tsconfig.json` ranges (TypeScript ^5.6.0, vitest ^2.1.0, `@types/node` ^22.10.0, Node 22+, ES2022, NodeNext, `type: module`, no runtime deps). The spine says do not bump in this increment.

Web check 2026-09-02 (memlog + this walker): TypeScript latest 7.0.2; vitest 4.x exists. Pins are **explicitly ratified brownfield**, not a false “current” claim. That is the allowed exception.

### 5. Ratifies rather than contradicts the brownfield codebase

**Pass.**

Checked against frozen `app/`:

- `types.ts` — `Order` / `LineItem` / `Coupon` only; money in integer kopiyky. AD-4.
- `pricing.ts` — `lineTotalKopecks`, `subtotalKopecks`, `shippingKopecks`, `tierPercent` unchanged. AD-4. Empty `items` → shipping 0 via `every` on `[]`. AD-10 matches.
- `discounts.ts` — `priceOrder(order: Order, catalog: Coupon[], asOf: Date): PriceBreakdown`; six-field type; private `percentToKopecks`; calls all four pricing helpers; category snapshots via `lineTotalKopecks`; scalar `remaining`; no leftover map; shipping via `shippingKopecks(order)`; join constructs the DTO once. AD-3, AD-6, AD-9, AD-10, AD-11.
- `index.ts` — re-exports seeded types/pricing plus `priceOrder` / `PriceBreakdown` only. Does not export `run-b`.
- `app/src/run-b/` — leftover category map, `appliedCoupons` / `rejectedCoupons` / `merchandiseKopecks`, `now = new Date()` default, trunc (not half-up). AD-12 correctly isolates it.
- Tests: `discounts.test.ts` titles start `AC-1:` … `AC-17:`; `pricing.test.ts` remains. Conventions match.

No AD invents a new module layout, a new money type, or a host process. Stale `app/AGENTS.md` line (“engine is not here yet”) is homework leftover; the spine correctly ratifies the *code*, not that sentence.

### 6. Covers the driving spec/PRD capabilities FR-1..FR-10

**Pass.**

Frontmatter `binds: [FR-1…FR-10]`. Capability map has a row per FR plus NFR determinism/integer money and seeded-test compatibility.

| FR | Lives / governed | Gap? |
| --- | --- | --- |
| FR-1 tier on goods | `discounts.ts` + `tierPercent`; AD-4, AD-9 | No |
| FR-2 eligible typed codes, typed order | AD-8, AD-9, AD-11 | No |
| FR-3 percent and fixed | AD-6, AD-1 | No |
| FR-4 min/category on original goods | AD-1, AD-9, AD-11 | No — AD-9 now names original category snapshots and original `minSubtotal` (D-6/D-19) |
| FR-5 conservative match | AD-1, AD-8 | No |
| FR-6 expiry via `asOf` | AD-7 | No |
| FR-7 always return; silent skip | AD-8 | No |
| FR-8 sequential; split receipt lines; goods-only | AD-9, AD-10 | No. “Split lines” in the map is PRD receipt-fields language, not a leftover working cart (AD-9 forbids the latter). |
| FR-9 floor remaining; empty zeros | AD-10 | No |
| FR-10 `priceOrder` contract | AD-3, AD-4, AD-12 | No |

PRD NFRs (determinism, integer money, failure mode, compatibility, no extra infra, no new telemetry/PII) are ADs or conventions/Deferred. PRD §13 open questions: none that block architecture; D-22 is Deferred by design.

### 7. Every dimension this feature altitude owns is decided, deferred, or an open question (esp. operational envelope)

**Pass.** Silent whole dimensions: none.

| Dimension | Status |
| --- | --- |
| Paradigm / pipeline | Decided (pipes-and-filters + mermaid) |
| Module boundaries / deps | AD-5 + tree |
| Public API | AD-3, AD-10 |
| Seeded data shapes | AD-4 |
| State / mutation | AD-11 + conventions |
| Errors | AD-8 |
| Tests | conventions |
| Stack | brownfield pins |
| Security / auth | None in this module |
| Observability | Deferred / none |
| Persistence | Deferred |
| **Deployment & environments** | Deferred (in-process library; no deployable process) |
| **Infra / provider** | Deferred (no cloud) |
| **Operations** | Deferred (CI beyond `npm test` not this altitude) |

No empty “Open questions” section is not a miss when there are none. Structural seed states checkout-host topology is not this altitude.

### 8. Decisions not rationale; shape in diagrams; no template comments; no placeholders

**Pass.**

- ADs are Binds / Prevents / Rule; rationale is not dumped into the spine (it lives in `.memlog.md`).
- Shape: pipeline mermaid (including original category/subtotal snapshots into coupon filters), dependency mermaid, source tree. Valid mermaid, not empty.
- No `<!-- template -->` comments. Inherited Invariants section correctly omitted (no parent).
- Lint: no TBD/TODO/`{tokens}`.
- Deferred items carry a wait-reason, not essays.

### 9. Lean: if two units one level down could not choose incompatibly, it should not be an AD

**Pass.** Slight overlap, not fat enough to fail or to demand cuts.

AD-6 and D-id citations inside AD-7/AD-8/AD-9 restated spec identities that AD-1 already owns. They still prevent *implementation* forks (float, `Math.round`, leftover maps, extra fields, throw, mutating `asOf`) that a story author can take while “following the spec in spirit.” Given reconstruction + frozen engine, keep them. Do not thin AD-9 back to a single “remaining goods” base.

Twelve ADs for a four-file library is the high end of lean, not over the line. No AD is a restatement of something two stories could not disagree on (e.g. “use TypeScript” is Stack, not an AD).

### 10. Inherited parent spine — no new AD weakens or contradicts an inherited one

**N/A.** Feature altitude, no parent spine. No Inherited Invariants block (correct).

---

## Findings

### Critical

None.

### High

None.

### Medium

None.

### Low

#### R-1 — AD-9 “cap by remaining” is slightly looser than D-20 for fixed+category

- **Checklist:** Rule precision (item 2).
- **Issue:** The Rule says category-bound coupons compute against original category goods, then **both** (uncategorized and category-bound) cap by remaining. Spec D-20 / engine: `applied = min(raw, categoryBase, remaining)`. For 0–100% this is equivalent. For a large **fixed** category code, “cap by remaining” alone would not cap by category subtotal. D-20 is already cited in the same Rule; AD-1 says spec wins; brownfield `discounts.ts` already uses the three-way `min`.
- **Action:** **ignore** — do not autofix a second algorithm into AD-9. Cite-and-backstop is enough.

#### R-2 — AD-6 (and D-id clauses in AD-7/AD-8) overlap AD-1

- **Issue:** Memlog said “do not restate kopiyky procedures.” AD-6 inlines `product` / `trunc` / remainder ≥ 50. AD-7/AD-8 name D-17 / D-14/D-15. They match the spec (not a competing algorithm) and *do* prevent `Math.round`, wall-clock, and case-sensitive duplicates.
- **Action:** **ignore** — reconstruction; keep the enforceable money/clock/match guards. Do not cut AD-6.

#### R-3 — `status: draft` in frontmatter

- **Issue:** Not a good-spine miss. Expected until Finalize sets `final`.
- **Action:** **defer** — set `status: final` at Finalize, not in this review.

---

## What this review is not asking for

- A rewrite, a thinner spine, or pasting spec §3 into ADs.
- New ADs for D-22 catalog garbage, current-on-the-web TypeScript 7 / vitest 4, or host topology.
- Re-raising closed holes: leftover category maps, working-copy carts, mutating `asOf`, draft `PriceBreakdown` (now in AD-9 / AD-11 / AD-7 / AD-10).
- Epic list, C4, HTML deck.
- Changes to `app/src`, `docs/spec`, `docs/traceability`, `openspec`, or `materials/feature-request.md`.

---

## Summary for the gate

**pass.** No critical/high/medium. Low: R-1 (AD-9 cap wording vs D-20; ignore), R-2 (AD-6 overlap; ignore), R-3 (draft status; defer to Finalize).
