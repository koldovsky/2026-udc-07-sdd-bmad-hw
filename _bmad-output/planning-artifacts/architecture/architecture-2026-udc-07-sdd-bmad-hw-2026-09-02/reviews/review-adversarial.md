# Adversarial review — architecture spine

**Target:** `ARCHITECTURE-SPINE.md` (feature altitude, pipes-and-filters, frozen engine `app/src/discounts.ts`)
**Stance:** two units one level down (stories / private helpers in `discounts.ts`) that obey every AD Rule as written, then fail to compose — clashing shared-data shapes, two owners of one entity, conflicting state-mutation paths.
**Out of scope:** arithmetic forks already closed as D-1…D-28 (AD-1); restating spec §3 as new ADs; holes already closed by the current Rules (tightened AD-9 pipe token, AD-10 join-owns-DTO, AD-11 no working-copy cart / no mutate `asOf`).

**Verdict: clean**

---

## Method

Altitude is feature → units below are stories (FR-1 tier vs FR-2…FR-4 coupons vs FR-8 join) that still land as `priceOrder` plus private helpers in `app/src/discounts.ts`. Each pair is written so both sides can quote every AD Rule in good faith. A pair that only disagrees on kopiyky already named in the spec is discarded. A pair that one side can make only by breaking a current Rule is discarded. A pair whose seam is a lossless, spec-named adapter (e.g. `sum(lineTotalKopecks)`) is discarded — it does not force an unspoken policy.

Re-checked after the Finalize tighten of AD-9 / AD-10 / AD-11. Previous pass (`review-adversarial.md` before that tighten) had four holes; those are treated as closed and were not re-opened.

---

## Holes (close with a new or tightened AD)

None. No pair survived: every constructed clash either violates a current Rule, restates a D-id, or composes through an adapter the spec already names.

---

## Closed by current AD Rules (do not reopen)

These are the four pairs from the prior pass. They are recorded so a later gate does not “find” them again.

### Closed 1 — leftover `Record<category, number>` vs scalar `remaining`

**Was:** shared-data shape of the goods pipe token. Unit T passed `remaining: number`. Unit C expected per-category leftover buckets (the `app/src/run-b/` shape), which forces an unspoken allocation of the tier cut (pro-rata vs drain-standard-first).

**Now closed by AD-9:** the pipe carries one integer `remaining` plus read-only original subtotal and original per-category snapshots — not a leftover map, split-line working cart, or per-SKU remainder. Category-bound raw uses original `lineTotalKopecks` snapshots, then both kinds cap by remaining. A helper that still decrements a category map is not Rule-compliant.

### Closed 2 — caller `Order` vs engine working cart

**Was:** two owners of the cart. Unit S cloned `LineItem[]` and reduced working quantities; did not mutate the caller’s object, so the old mutate-list was satisfied.

**Now closed by AD-11:** do not clone-and-mutate a working `Order` / `LineItem[]`. Engine-owned mutables are only `remaining` and the running coupon total. Category bases are snapshots, not leftover line quantities.

### Closed 3 — in-place `asOf.setUTCHours`

**Was:** AD-11 named `asOf` as caller-owned but omitted it from the mutate ban. Unit E zeroed the caller `Date`; Unit D treated it as an immutable instant.

**Now closed by AD-7 and AD-11:** do not mutate `asOf` (`setUTC*` / `setTime`). Read `getTime()` / `Date.parse` only. Eligibility is D-16 / D-17 as written.

### Closed 4 — draft `PriceBreakdown` vs join construction

**Was:** Unit B allocated a receipt before the pipe and filled fields as stages ran; AD-10 identities applied only to the returned object.

**Now closed by AD-10:** construct `PriceBreakdown` once at join from stage numbers; stages do not mutate a draft DTO.

---

## Attacks that did not land

Each row is a pair that was actually constructed. “Why discarded” is the Rule or the lossless adapter that kills it.

### Shared-data shapes

| Pair | Why discarded |
| --- | --- |
| Snapshot `Record<LineItem["category"], number>` vs `Map` vs `{standard,fresh,digital}` vs 3-tuple | All are original per-category kopiyky. Adapter is keying, not new arithmetic. AD-9 already forbids leftover / per-SKU remainder, which is the shape that *did* invent allocation. |
| Snapshot totals vs `Record<category, readonly LineItem[]>` (original lines, never mutated) | Category base = `sum(lineTotalKopecks)` — named in AD-9 / D-5. Not a leftover map. Helpers compose by summing. |
| Coupon-stage token `Coupon` (catalog row) vs private `NormalizedCoupon` / `{ coupon, expiresMs, key }` | Lossless projection of a frozen `Coupon`. Apply can re-`Date.parse` or use `expiresMs` from `Date.parse` (AD-7). No second algorithm. Not exported (AD-3). |
| Unique typed codes as `Coupon[]` vs unique normalized `string[]` then re-lookup | Re-lookup must still be trim+case, first catalog row (AD-8, AD-9 D-15). A helper that re-looks up with exact `===` does **not** obey those Rules. |
| `ReadyCoupon.categoryBase` frozen at coupon-stage entry for unbound codes | Uncategorized must compute against live `remaining` (AD-9 + AD-11 accumulator). Pre-freezing remaining into each coupon is sequential-remaining as D-1, already a Rule miss — not a hole. Category bases *may* be frozen (they are original snapshots). |
| Internal `remaining` as `bigint` vs `number` | DTO fields are spec §5 `number` (AD-1 + AD-10). Internals converting at join is an adapter. Overflow of `amount * percent` is D-4 / AD-6, not a new AD. |
| `Filter = (pipe) => pipe` array vs imperative `priceOrder` body | AD-9 Prevents names “a filter framework”; Rule already keeps the pipeline in `priceOrder` plus private helpers, no class hierarchy, no extra packages. Same numbers either way. A generic runner is style, not a receipt fork. |
| `PriceBreakdown` interface vs single class with the six fields | AD-9 bans a *hierarchy*, not one join-time object. AD-10 still requires six integer fields constructed at join. Brownfield is an interface; extra class is unrequested, not a second contract. |

### Two owners of one entity

| Pair | Why discarded |
| --- | --- |
| Working `Coupon[]` clones (engine copy vs caller catalog) | AD-11 already bans mutating the catalog. Cosmetic clones (`{...row}`, lowercased `code` on the copy) do not change eligibility or kopiyky. Mutating `expiresAt` via `toISOString()` on unparsable input **throws** — violates AD-8 always-return. Remaining clone is lossless, not a second owner that invents policy. |
| Snapshot table filled at setup vs `categorySubtotal(order)` rescan in each coupon helper | AD-11 freezes `Order`; both equal `sum(lineTotalKopecks)` for that category. AD-9 allows either read of “original category goods.” Adapter is the named sum. |
| `originalSubtotal` on the pipe vs `subtotalKopecks(order)` at the min gate | AD-9 names the min operand as original `subtotalKopecks(order)`. Cached copy at start equals a later call because the engine must not mutate `Order`. |
| Catalog `Map` index vs `catalog.find` each time | First-wins `set`-if-absent matches AD-8 “first catalog row.” Last-wins `Map.set` always **violates** AD-8. Not two legal owners. |
| `tierDiscount` / `couponDiscount` as pipe fields vs locals in `priceOrder` | AD-10 join consumes stage numbers; AD-11 allows those two numeric accumulators (plus `remaining`). Join may also derive coupon as `subtotal − tier − remaining` — identities force equality. |
| Shipping computed at sidecar start vs at join | AD-10: shipping equals `shippingKopecks(order)`. Pure + no cart mutation → same integer. AD-9 forbids shipping *entering the discount pipe* as a base, not forbidding a local held until join. |
| Module-level cached empty `PriceBreakdown` vs new object each call | Shared unfrozen DTO lets a caller pollute the next run (AD-7). Frozen/module cache is still not “construct at join from stage numbers” (AD-10). Non-compliant, not a hole. |
| `app/src/run-b/` types (`appliedCoupons`, `merchandiseKopecks`) vs production DTO | AD-3 / AD-8 / AD-10 / AD-12. |

### Conflicting state-mutation paths

| Pair | Why discarded |
| --- | --- |
| `let remaining -= x` vs pure `return remaining - x` | Both are the AD-11 local accumulator. No caller-visible mutation; no invented arithmetic. Merge is a one-line wrapper, not a policy. |
| `seen: Set<string>` vs rescan-previous / immutable unique list | Duplicate identity is AD-8 / D-14 / D-15. Either structure implements the same key. The Set is matching machinery, not a second remaining-goods owner. |
| `Object.freeze(order \| catalog \| asOf)` as “immutability help” | Freeze mutates property descriptors on caller objects — banned by AD-11’s must-not-mutate list (including `asOf`). |
| `asOf` clone then `setUTCHours(0,0,0,0)` on the clone | Does not write the caller `Date`, but changes the instant used for D-17. AD-7 Rule is `asOf.getTime() >= Date.parse(expiresAt)` on the given instant, not a midnight-normalized copy. Spec arithmetic, already bound. |
| Coupon helper decrements snapshots *and* `remaining` | Snapshots are read-only originals (AD-9). Decrementing them is a leftover map. |
| Stages write `out.couponDiscountKopecks` because the paradigm table says the coupon stage “Writes” that field | The **Rule** (AD-10) owns: stages emit numbers; join constructs the DTO. The table is seed, not a license to mutate a draft. |
| Empty-cart fast path hardcoding `shippingKopecks: 0` vs calling `shippingKopecks(order)` | AD-4 requires the call; AD-10 already says empty `items` is all zeros *and* shipping equals the primitive. |
| Invalid `asOf` (`getTime()` is `NaN`): skip-all vs literal `NaN >= parse` | AD-8 always returns (no throw). AD-7 states the comparison; `NaN >= n` is the language result of that Rule. Fail-closed skip-all invents a gate. D-22-adjacent, not an AD miss. |

### Spec / public-API pairs (not AD work)

| Pair | Why discarded |
| --- | --- |
| Category % of remaining vs original category goods | D-5 + AD-9 Rule (tightened). |
| Min vs remaining-after-tier vs original subtotal | D-6 / D-19 + AD-9. |
| `SAVE10` vs `save10` as two codes | AD-8 duplicate identity + AD-9 D-15. |
| Inclusive vs exclusive expiry; date-only TZ | AD-7 D-17. |
| `Math.round` / float money / second round of total | AD-6 / D-4. |
| Throw, Result, skip-reason on `PriceBreakdown` | AD-8, AD-3. |
| Extra public helper, `PriceBreakdown` in `types.ts`, default export | AD-3. |
| Re-export `run-b` from `index.ts` | AD-12 + AD-5. |
| Half-up moved into `pricing.ts` | AD-4, AD-5. |
| Coupon-before-tier, additive percents, best-of, coupon-count cap, shipping in the pipe | AD-9. |
| Catalog-garbage two behaviours (D-22); dirty LineItems | Intentionally Deferred; an AD would fight the spec. |
| FR-8 map label “split lines” vs numeric snapshots | Capability caption is not a Rule. Implementing split-line working lists violates AD-9 / AD-11. |

---

## Suggested AD edits

None. Do not add an AD for helper argument order, `Record` vs `Map` of original category totals, private `NormalizedCoupon`, or mutate-vs-copy of a local `remaining`. Those are not divergence points two stories of this increment can ship incompatibly once the current Rules are followed.

No new AD that restates half-up, stacking order, expiry parse, min operand, or duplicate identity — those are already D-ids, and AD-9 / AD-7 / AD-8 now cite them.

---

## Gate note

The goods pipe token, receipt ownership, working cart, and `asOf` mutation were the real feature-altitude forks. They are in the Rules now. A further AD would fatten a twelve-decision spine without closing a remaining compose-failure.
