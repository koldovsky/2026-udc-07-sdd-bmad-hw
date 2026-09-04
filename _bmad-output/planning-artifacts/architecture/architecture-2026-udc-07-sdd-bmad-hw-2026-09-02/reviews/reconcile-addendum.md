# Reconcile — PRD addendum vs architecture spine

- **Input:** `_bmad-output/planning-artifacts/prds/prd-2026-udc-07-sdd-bmad-hw-2026-09-02/addendum.md` (status: final)
- **Against:** `ARCHITECTURE-SPINE.md` (same architecture run folder; status: draft)
- **Job:** mechanism / transport, locked policy index D-1…D-28, rejected alternatives, Task E constraints
- **Rules:** rejected alternatives must stay rejected; do not treat AD-1 as a license to reopen them; D-table is an id index, not a second algorithm (spec §3 owns arithmetic)
- **Not done:** addendum, spine, spec, ticket, and `app/src` were not edited

Prior extract in this path was stale against the post-finalize distill (AD-8/AD-9 now bind D-15 and D-27; AD-7 binds D-17). This file is the current extract.

---

## Verdict

**ok** — no contradiction, no missing load-bearing invariant, no revived alternative.

Mechanism, the D-index (wholesale via AD-1, and each row restated or cited in an AD Rule/Prevents, convention, or Deferred), all eight rejections, and the sequential-not-optimizer lock are present. Task E process constraints are observed by this run and logged in the memlog; they are correctly not ADs.

Not a `conflict`: nothing in the spine asserts the opposite of the addendum. Not a `gap`: two units that obey the written AD Rules cannot choose incompatibly on any addendum-locked fork.

---

## 1. Mechanism / transport

| Addendum | Spine | Status |
| --- | --- | --- |
| TypeScript domain library; Node 22+, ES2022, NodeNext; no HTTP, UI, persistence | AD-2; Stack; Deferred checkout-host / CRUD / UI | **landed** |
| Module `app/src/discounts.ts`; named export only; re-export `app/src/index.ts` | AD-3; Structural Seed; naming convention | **landed** |
| `priceOrder(order, catalog, asOf): PriceBreakdown` | AD-3 (exact signature); AD-7 (`asOf` required) | **landed** |
| `PriceBreakdown` six integer fields ≥ 0, named as addendum | AD-10 (exactly those six) | **landed** |
| Tests `discounts.test.ts`; `it(...)` titles start with `AC-N:` | Consistency Conventions Tests | **landed** (spine also pins AC-1..AC-17 from spec — compatible) |
| Integer kopiyky; half-up per percent step; not `Math.round` on floats | AD-6 | **landed** |
| Reuse `subtotalKopecks`, `shippingKopecks`, `tierPercent`; do not change those signatures or `types.ts` | AD-4 | **landed** (spine also requires calling `lineTotalKopecks` — stricter, not contradictory) |
| Spec §3 is the algorithm; D-table is an id index, not a second algorithm | AD-1 | **landed** |

`PriceBreakdown` living in `discounts.ts` not `types.ts` (AD-3) is a tightening of the addendum, not a miss.

---

## 2. Locked policy index (D-1…D-28)

AD-1 binds the whole table: spec wins; do not reopen forks already closed as D-1 through D-28, including matching and coupon-count cap. Rows below ask whether a later builder could still diverge if they read only the spine ADs.

| IDs | Addendum rule | Where in spine | Landed? |
| --- | --- | --- | --- |
| D-1 | Tier first on full goods; then coupons on remaining; percents not added | AD-9 Rule; paradigm table | **yes** |
| D-2 | Base = goods; shipping never in base, never reduced | AD-9 (shipping never in the pipe); sidecar; AD-10 shipping = `shippingKopecks(order)` | **yes** |
| D-3 | Eligible typed codes in typed order; no best-of; skip ineligible, continue | AD-9 Prevents best-of / reorder; AD-8 skip-and-continue | **yes** |
| D-4 | Percent step half-up (remainder ≥ 50); fixed already integer | AD-6 | **yes** |
| D-5 | Category percent from **original** category totals, then cap by remaining | AD-9 Rule: category-bound vs `lineTotalKopecks` snapshots, then cap by remaining; cites D-5 | **yes** |
| D-6 / D-19 | `minSubtotalKopecks` vs **original** goods subtotal (incl. category coupons) | AD-9 Rule cites D-6, D-19; paradigm Reads “original goods subtotal (min)”; mermaid `origSub → coupons` | **yes** |
| D-7 / D-11 | Remaining ≥ 0; total = remaining + shipping | AD-10 identities | **yes** |
| D-8 / D-12 / D-18 / D-24 | Expired, unknown, unparsable, wrong category → silent skip; always return | AD-8 (also names duplicate-after-first, min-failing) | **yes** |
| D-9 | Mixed percent + fixed: typed order, not “all percents first” | AD-9 cites D-9; Prevents reordering | **yes** |
| D-10 | Two codes, one category: both, sequential, same original category base | AD-9 Rule: original category snapshots, both cap by remaining; cites D-10 | **yes** |
| D-13 | Catalog-only codes (not typed) do not apply | AD-9 typed-code order only; AD-11 catalog is caller-owned, not auto-applied | **yes** (implied by typed-order pipe; no catalog-sweep path) |
| D-14 | Duplicate typed code: **first** occurrence only | AD-8 “duplicate-after-first”; identity is D-15 | **yes** |
| D-15 | Trim + case-insensitive match; first catalog hit on case-duplicates | AD-8 Rule (trim + case-insensitive; first catalog row); AD-9 “after trim/case unique”; AD-1 Prevents matching | **yes** |
| D-16 / D-17 | Required `asOf`; no `Date.now()`; ISO / date-only = 00:00:00.000 UTC; ineligible if `asOf >= parse(expiresAt)` | AD-7 Rule: required `asOf`; no `Date.now()`; `asOf.getTime() >= Date.parse(expiresAt)` (on-or-after ineligible); date-only UTC midnight; unparsable → silent skip | **yes** |
| D-20 | Fixed + category: `min(value, category base, remaining)` | AD-9: category-bound compute against original category, then both cap by remaining; cites D-20. Arithmetic stays in spec §3 | **yes** |
| D-21 | Fixed `Coupon.value` is kopiyky (100 грн = 10_000) | AD-6 integer kopiyky; AD-4 frozen `Coupon`; AD-1 | **yes** |
| D-22 | Invalid catalog unspecified; no extra validator | Conventions Errors; Deferred | **yes** |
| D-23 | Empty cart: all zeros | AD-10 “Empty `items` is all zeros” | **yes** |
| D-25 | Split tier vs coupon totals; no per-code array | AD-10; AD-3 no per-code preview / skip-reason DTOs | **yes** |
| D-26 | Qty 0 → line 0; unknown tiers outside Order contract | AD-4 frozen contract / `pricing.ts` behaviour | **yes** |
| D-27 | No coupon-count cap; shipping not zeroed by discounts | AD-9 Prevents + Rule “No coupon-count cap (D-27)”; AD-1 Prevents coupon-count cap; AD-10 shipping identity | **yes** |
| D-28 | No best-order optimizer; typed order only | AD-9 Prevents reordering + best-of subset; cites D-28 | **yes** |

No D-id is spine-only via “read the spec.” Matching (D-15) and the count cap (D-27) are in AD-1 Prevents **and** in AD-8 / AD-9 Rules.

AD-7’s parenthetical “(equality excluded)” sits next to `>=`, matching addendum “ineligible if `asOf >= parse(expiresAt)`” (on-or-after is ineligible). Not a `>` vs `>=` conflict.

---

## 3. Rejected alternatives (must stay rejected)

| Rejected | Spine encoding | Still rejected? |
| --- | --- | --- |
| Additive percents | AD-9 Prevents; D-1 sequential | **yes** |
| Shipping in the discount base | AD-9; shipping sidecar; D-2 | **yes** |
| Best-price permutation of typed codes | AD-9 Prevents reordering + best-of subset; D-28 cited | **yes** |
| Throw on expired/unknown | AD-8 Prevents thrown errors / Result wrappers | **yes** |
| Floor total including shipping to zero via discounts | AD-10: remaining ≥ 0; total = remaining + shipping; shipping not in the pipe | **yes** |
| Second rounding on the grand total | AD-6 Prevents; do not round `totalKopecks` again | **yes** |
| Per-code discount array | AD-10 Prevents; AD-3 no skip-reason DTOs / per-code preview | **yes** |
| UI / analytics / redemption store in this increment | AD-2; Deferred (explicitly not this altitude) | **yes** |

Addendum “Options considered”: sequential-tier-first; architect must not swap in a margin- or shopper-maximizing optimizer. Locked by AD-9. Rationale correctly omitted from the spine.

Deferred “Next product increment (not this spine): UI and persistence…” names UI as **later**, not this increment. Not a revival.

AD-12 forbids merging `app/src/run-b/` extra types into `PriceBreakdown` (that artifact carried a rejected per-code shape). Reinforces the per-code-array rejection.

**No rejected alternative is adopted, left as an open question, or restated as a live option.**

---

## 4. Task E constraints

| Constraint | In spine? | Assessment |
| --- | --- | --- |
| Do not edit the spec, traceability, A/B write-up, SDD-tool note, walkthrough, ticket, or `app/src` discount/pricing implementation | No (memlog constraint) | **Observed, not adopted as AD.** Spine describes `discounts.ts` as the canonical engine (AD-12); it does not instruct edits to forbidden paths. Encoding “do not implement” as an AD would fight `purpose: build-substrate`. |
| New files only under `_bmad-output/planning-artifacts/` until asked for `docs/task-e-bonus.md` | No | **Observed** by this run’s location. Spine does not point at `docs/task-e-bonus.md`. |
| Dev later: describe next implementation step only — no `bmad-build` | No | **Handoff/memlog only.** A Dev who reads only the spine will not see this process rule. Correct: not an architecture invariant. Spine does not invoke `bmad-build`. |

Task E is not a `conflict` and not an architecture gap. Process constraints belong outside AD Rules.

---

## Findings (priority)

1. **[ok] Mechanism, D-1…D-28 index, sequential-not-optimizer, and all eight rejections are intact.** No additive percents, shipping-in-base, best-of, throws, shipping-floor, second rounding, per-code array, or UI/analytics/redemption in this increment.
2. **[ok] Prior gaps closed in distill.** D-15 matching is an AD-8 / AD-9 Rule (not only AD-1). D-27 no coupon-count cap is AD-9 Prevents + Rule. D-6 / D-19 original-goods min is on the coupon-filter Reads column and in AD-9. D-17 parse / UTC midnight / `>=` is in AD-7.
3. **[ok] Task E is not contradicted.** Process constraints live in memlog, not ADs. Spine does not tell anyone to edit forbidden docs or run `bmad-build`.
4. **[note] D-13 is implied, not named.** Catalog-only codes have no sweep path under “typed-code order.” Two units cannot apply untyped catalog rows without violating AD-9. Not a gap.

---

## Remaining gaps

None.

Do not revive any rejected alternative. Do not edit the addendum or the spine from this extract.
