# Reconcile: `docs/spec/pricing-discounts.md` vs architecture spine

- **Input:** `docs/spec/pricing-discounts.md` (status: agreed). Arithmetic source of truth. Spec wins on conflict.
- **Spine:** `ARCHITECTURE-SPINE.md` (status: draft, purpose: build-substrate, altitude: feature).
- **Date:** 2026-09-02
- **Job:** flag spine contradictions of D-1..D-28, §3 algorithm, §5 contract, or AC intent; flag quiet constraints that did not land as ADs **only if two downstream units could diverge**. Do not demand the spine copy the whole algorithm.
- **Not done:** no edits to the spec, the spine, or frozen homework files.

## Verdict: conflict

One AD Rule restates D-17 with a parenthetical that contradicts the spec’s inclusive-equality clause (and AC-2). The comparison operator in the same Rule matches the spec; the gloss does not. AD-1 (“spec wins”) does not erase a contradicting gloss on AD-7.

No other D-id, §3 step, §5 surface, or AC intent is contradicted. Prior coupon-base / min-base / duplicate-identity issues are closed on the current AD-9 and AD-8 Rules.

## What landed (no issue)

These are consistent with the spec. Listed so the parent does not re-litigate them.

| Spec | Spine |
| --- | --- |
| D-1 tier first, sequential, percents not additive | AD-9; paradigm pipe |
| D-2 / D-11 goods-only; `total = remaining + shipping` | paradigm sidecar; AD-9; AD-10 |
| D-3 / D-9 / D-28 typed order; no best-of; no reorder | AD-9 |
| D-4 / AC-9 half-up via integer `product` / `trunc` / `r >= 50`; no re-round of total | AD-6 |
| D-5 / D-10 / AC-3 category-bound percent from **original** category `lineTotalKopecks` snapshots, then cap by remaining | AD-9 Rule; paradigm table; mermaid `origCat` |
| D-6 / D-19 / AC-7 `minSubtotalKopecks` vs original full `subtotalKopecks(order)`, including category coupons | AD-9 Rule |
| D-7 / D-23 / AC-4 / AC-8 floor remaining ≥ 0; empty cart all zeros | AD-10 |
| D-8 / D-12 / D-18 / D-24 silent skip; always `PriceBreakdown`; no skip-reason field | AD-8; AD-3 |
| D-13 catalog codes not typed do not apply | AD-11 |
| D-14 / D-15 uniqueness and catalog hit: `trim` + case-insensitive; first catalog row wins | AD-8; AD-9 “trim/case unique” |
| D-16 no `Date.now()`; required `asOf`; do not mutate `asOf` | AD-7; AD-11 |
| D-20 fixed+category cap once original category base is stated | AD-9 cites D-20; both cap by remaining |
| D-21 / D-25 / §5 six integer fields; coupon field is a sum; `PriceBreakdown` in `discounts.ts` | AD-6; AD-10; AD-3 |
| D-22 catalog garbage unspecified | Deferred; Errors convention |
| D-26 / D-27 frozen tiers; no coupon-count cap; shipping not zeroed by discounts | AD-4; AD-9; AD-10 |
| §5 `priceOrder(order, catalog, asOf)`; named exports; re-export from `index.ts`; call frozen `subtotalKopecks` / `shippingKopecks` / `tierPercent` | AD-3; AD-4; AD-7 |
| §5 identities on every receipt | AD-10 |
| Tests `app/src/discounts.test.ts`, titles `AC-N:`, AC-1..AC-17; seeded eight stay green | Consistency Conventions; seed tree |
| No UI / CRUD / extra infra | AD-2; Deferred |
| Pipe token is one integer `remaining` plus read-only original subtotal and per-category snapshots | AD-9; AD-11 (no leftover map / clone-and-mutate cart) |

AD-1 correctly names the spec as arithmetic authority over the PRD, this spine, the ticket, and the code, and forbids inventing a second algorithm. That meta-rule does **not** erase a contradicting gloss on another AD.

## Findings

### 1. conflict — AD-7 Rule vs D-17 / AC-2 (expiry equality)

**Spec D-17:** code is invalid when `asOf.getTime() >= Date.parse(expiresAt)` (**включно з рівністю** / including equality). Type comment: *not valid on or after this instant*. Unparsable `expiresAt` → silent skip. Date-only `YYYY-MM-DD` → that day `00:00:00.000 UTC`.

**AC-2:** `expiresAt` and `asOf` both `2026-01-01T00:00:00.000Z` → `couponDiscountKopecks = 0`, no throw.

**Spine AD-7 Rule:** “ineligible when `asOf.getTime() >= Date.parse(expiresAt)` **(equality excluded)**; date-only `YYYY-MM-DD` is that day 00:00:00.000 UTC; unparsable → silent skip.”

The operator `>=` matches D-17. Date-only UTC and unparsable skip match. The parenthetical **“equality excluded”** is the antonym of the spec’s “including equality.”

**Divergence if a unit follows the gloss instead of the operator / spec:**

- Treat the test as exclusive (`>`): at the exact instant the coupon still applies → AC-2 fails (`couponDiscountKopecks` ≠ 0).
- Treat “equality excluded” as “the equal instant is excluded from the *valid* set”: AC-2 passes, but that reading fights the English of “excluded” next to `>=`.

Two story authors can both quote AD-7 and ship different receipts on the AC-2 cart. Spec wins: inclusive `>=`, equality ineligible.

**Not** asking the spine to paste `Date.parse` mechanics. Asking AD-7’s Rule to drop or invert the gloss so it cannot be read as exclusive. Fix shape (parent’s job): keep `>=`; say **equality included** / **on or after**, never “equality excluded.”

No other D-17 clause is missing from a Rule.

## D-1..D-28 vs spine (compact)

| Id | Result | Notes |
| --- | --- | --- |
| D-1 | ok | AD-9 |
| D-2 | ok | sidecar; AD-9 |
| D-3 | ok | AD-9 |
| D-4 | ok | AD-6 restates the integer half-up shape, not the full coupon loop |
| D-5 | ok | AD-9 Rule: category-bound vs original category snapshots, then cap remaining |
| D-6 | ok | AD-9 Rule: min vs original `subtotalKopecks(order)` |
| D-7 | ok | AD-10 |
| D-8 | ok | AD-8 |
| D-9 | ok | AD-9 |
| D-10 | ok | same sentence as D-5 |
| D-11 | ok | AD-10 |
| D-12 | ok | AD-8 |
| D-13 | ok | AD-11 |
| D-14 | ok | AD-8 duplicate identity = trim + case-insensitive |
| D-15 | ok | AD-8 first catalog row; AD-9 trim/case unique. Matcher loop correctly not copied |
| D-16 | ok | AD-7 |
| D-17 | **conflict** | operator and UTC/unparsable match; gloss “equality excluded” vs spec inclusive equality / AC-2 |
| D-18 | ok | AD-8 |
| D-19 | ok | AD-9: same original full-cart min for category coupons |
| D-20 | ok | AD-9 cites D-20; category base + remaining cap |
| D-21 | ok | AD-6 |
| D-22 | ok | Deferred |
| D-23 | ok | AD-10 |
| D-24 | ok | AD-8 / AD-3 |
| D-25 | ok | AD-10 |
| D-26 | ok | AD-4 |
| D-27 | ok | AD-9 / AD-10 |
| D-28 | ok | AD-9 |

## §3 algorithm

The spine must not reproduce the loop. It must not **contradict** the loop.

- Tier on full goods subtotal, then coupons, then join with shipping — aligned (paradigm + AD-9 + AD-10).
- Half-up helper — aligned (AD-6), kept private in `discounts.ts` (AD-4).
- Unique typed codes (`trim`, case-insensitive, first catalog hit) — aligned (AD-8 / AD-9), without copying step 3’s loop.
- Category `categoryBase` vs remaining — aligned (AD-9). Uncategorized compute against remaining; category-bound against original category goods; both cap by remaining.
- Min vs original subtotal — aligned (AD-9).
- Contradicted: D-17 equality gloss on AD-7 (finding 1). The `>=` in the same Rule is the spec’s operator.
- Not copied, correctly: per-code skip order, `percent` vs `fixed` `raw`, `applied = min(raw, categoryBase, remaining)` as a formula. AD-9’s “compute against … then cap by remaining” is the invariant, not the loop.

§3’s field-assignment sentence omits `remainingGoodsKopecks`; §5 and the invariant paragraph include it. Spine AD-10 matches §5. Not a spine defect.

## §5 contract

No contradiction.

- Public surface, named exports, barrel re-export, `asOf: Date`, six non-negative integer fields, identities, `shippingKopecks === shippingKopecks(order)`, tests path and `AC-N:` prefix — all in AD-3, AD-4, AD-7, AD-10, conventions.
- AD-3 is stricter than §5 in forbidding classes, default exports, per-code preview, skip-reason DTOs — compatible, matches D-24 / D-25.
- AD-4 requires calling `lineTotalKopecks` as well as the three primitives §5 names. Compatible: §3 / D-5 / §2 already compute category and line totals that way. Not extra behaviour.

## AC intent

| AC | Intent | Spine |
| --- | --- | --- |
| AC-1, AC-17 | Gold 10% / Silver 5% on goods; shipping added after | AD-9, AD-10, AD-4 `tierPercent` |
| AC-2 | expiry on-or-after **including equality**, no throw, coupon 0 | AD-8 skip; AD-7 `>=` matches; gloss “equality excluded” threatens AC-2 (finding 1) |
| AC-3 | two category percents from **original** category base | AD-9 Rule |
| AC-4 | fixed coupon floor at remaining; shipping stands | AD-10 |
| AC-5 | sequential not additive percents; unbound % of remaining after tier | AD-9 |
| AC-6 | category % of that category, not whole cart | AD-9 |
| AC-7 | min vs original subtotal, then % of remaining after tier | AD-9 |
| AC-8 | empty items → all zeros, including shipping | AD-10 |
| AC-9 | 12.5 kopiyky → 13 half-up | AD-6 |
| AC-10 | tier not on goods+shipping | AD-9 D-2 |
| AC-11 | mixed % + fixed in typed order | AD-9 |
| AC-12 | duplicate typed code once | AD-8 |
| AC-13 | unknown then valid | AD-8 |
| AC-14 | min fail → 0 | AD-8 |
| AC-15 | trim + case-insensitive match | AD-8 / AD-9 |
| AC-16 | wrong category → 0 | AD-8 |

No AC expected totals are restated (and therefore none are restated wrongly).

## Quiet constraints considered and **not** raised

These live in the spec but do not need ADs: two compliant units would not pick incompatible architecture from them, or AD-1 + an existing Rule already pins them.

- Full §3 control-flow (skip-check order, `raw` then `min` formula).
- Empty typed string after trim (§3 step 3): unknown-code skip yields the same 0; catalog-empty-code is D-22 unspecified.
- D-20 fixed+category cap once D-5 is in AD-9.
- D-22 / dirty line items (§2): compute via `lineTotalKopecks`; no validator — Deferred + Errors + AD-4.
- D-26 quantity 0 / unknown tier out of contract — frozen types.
- §6 “no new tests without `AC-N:` except seeded `pricing.test.ts`” — conventions already require `AC-N:` on `discounts.test.ts` and keep the eight seeded tests. Extra helper test files are homework-process, not a second engine.
- §4 intro “не кидає” vs §5 “не кидає через промокоди”: AD-8 matches the D-ids. Throwing on garbage catalog is D-22 unspecified.
- Checkout UI, skip copy, persistence — Deferred / AD-2.

D-17’s parse / UTC / `>=` **did** land as an AD Rule; the remaining issue is the contradicting gloss, not a quiet drop.

## Recommendation (parent Finalize; this file is notes only)

1. Amend **AD-7 Rule**: keep `asOf.getTime() >= Date.parse(expiresAt)`; replace “(equality excluded)” with “(equality included / on or after)” so AC-2 cannot be read as exclusive `>`. Do not paste the rest of D-17.

Do not duplicate the rest of §3 into the spine. Do not reopen D-5 / D-6 / D-10 / D-14 / D-15 / D-19 — those Rules already match. Do not edit the spec.
