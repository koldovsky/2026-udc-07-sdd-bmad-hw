## Context

See `proposal.md` (Why) and `docs/spec/pricing-discounts.md` (agreed behaviour). Domain types and seeded pricing already exist:

- `app/src/types.ts` — `Order`, `LineItem`, `Coupon` (do not change shapes)
- `app/src/pricing.ts` — `lineTotalKopecks`, `subtotalKopecks`, `shippingKopecks`, `tierPercent` (do not change signatures or behaviour)
- `app/src/index.ts` — public surface; discount engine is not exported yet
- `app/AGENTS.md` — TypeScript ES2022 / NodeNext, vitest, named exports, `.js` extensions on relative imports, money as integer kopecks

There is no discount engine today. `tierPercent` is unused in totals.

## Goals / Non-Goals

**Goals:**

- Implement exactly `priceOrder(order, catalog, nowIso) → PriceBreakdown` as specified in `docs/spec/pricing-discounts.md` §5.
- Keep the implementation a pure function: no I/O, no `Date.now()`.
- Encode the normative algorithm below verbatim so two implementers cannot diverge by 1 kopeck.
- Cover AC-1…AC-15 with vitest names that include the AC id.

**Non-Goals:**

- New public APIs beyond `priceOrder` / `PriceBreakdown`.
- Changing seeded pricing or types.
- UI, persistence, coupon admin, free-shipping coupons, tax.

## Decisions

### D1. New module beside `pricing.ts`, not inside it

- **Choice:** add `app/src/discounts.ts` (+ `app/src/discounts.test.ts`). Re-export `priceOrder` and `PriceBreakdown` from `app/src/index.ts`.
- **Why:** seeded `pricing.ts` is a protected contract. The homework and `app/AGENTS.md` expect the engine to plug in alongside.
- **Alternative considered:** fold into `pricing.ts` — rejected, mixes protected and new behaviour and risks accidental signature edits.

### D2. Contract and clock

- **Choice:** `priceOrder(order: Order, catalog: Coupon[], nowIso: string): PriceBreakdown` with the five integer fields from the spec. Expiry uses `Date.parse(nowIso)` vs `Date.parse(expiresAt)`.
- **Why:** D-9 in the agreed spec. A hidden `Date.now()` makes AC-2 flake.
- **Alternative considered:** default `nowIso` to `new Date().toISOString()` — rejected; tests and checkout callers must pass time explicitly.

### D3. Per-line integer rounding, then sequential coupons

- **Choice:** follow the normative algorithm in the next section (copy of spec §5). No float (`* 0.1`, `/ 100` on `number` without the integer formula).
- **Why:** D-1, D-4, D-11, D-12. Rounding the aggregate (30 × 10% → 3) disagrees with per-line (15+15 → 4).
- **Alternative considered:** one discount on the subtotal, then largest-remainder allocation — more code, same ACs only if allocation is specified; the agreed spec already chose per-line.

### D4. Silent skip, not exceptions

- **Choice:** invalid coupons (expired, unknown, bad parse, bad kind/value, duplicate code after first use) contribute 0 and do not throw.
- **Why:** D-8. The domain function stays total-able from a cart with draft codes.
- **Alternative considered:** throw `ExpiredCouponError` — out of scope (no UX in this library).

### D5. Tests named after AC ids

- **Choice:** colocated vitest file; each test title starts with `AC-N:` matching the agreed spec. Keep `pricing.test.ts` untouched.
- **Why:** Task C / `app/AGENTS.md` require the spec link to be visible in test output.

## Normative algorithm (from `docs/spec/pricing-discounts.md` §5)

Any implementation that differs by 1 kopeck is wrong.

1. `remaining[i] = lineTotalKopecks(order.items[i])` for each index `i`.
2. `subtotal = subtotalKopecks(order)`.
3. `percent = tierPercent(order)`. `tierDiscount = 0`.
4. If `percent > 0`, for each `i` in array order:
   - `d = Math.floor((remaining[i] * percent + 50) / 100)`
   - `d = min(d, remaining[i])`
   - `remaining[i] -= d`; `tierDiscount += d`
5. `couponDiscount = 0`. `seen =` empty set of strings.
6. For each `code` in `order.coupons` (typing order):
   1. If `code` is already in `seen` — skip. Else add to `seen`.
   2. `c` = first `catalog` element with `c.code === code` (exact, case-sensitive, no trim). None — skip.
   3. `tNow = Date.parse(nowIso)`, `tExp = Date.parse(c.expiresAt)`. If either is `NaN` or `tNow >= tExp` — skip.
   4. If `c.minSubtotalKopecks !== undefined` and `subtotal < c.minSubtotalKopecks` — skip.
   5. If `c.kind === "percent"`: if `c.value` is not an integer or `c.value < 0` or `c.value > 100` — skip. Else for each `i` in `eligible(c)`:
      - `d = Math.floor((remaining[i] * c.value + 50) / 100)`
      - `d = min(d, remaining[i])`
      - `remaining[i] -= d`; `couponDiscount += d`
   6. If `c.kind === "fixed"`: if `c.value` is not an integer or `c.value < 0` — skip. `need = c.value`. For each `i` in `eligible(c)`:
      - `take = min(remaining[i], need)`
      - `remaining[i] -= take`; `need -= take`; `couponDiscount += take`
      - if `need === 0` — stop the line loop
   7. Other `kind` — skip.
7. `eligible(c)` = all indices if `c.category` is unset; else indices where `order.items[i].category === c.category`. Order is increasing index.
8. `shipping = shippingKopecks(order)`.
9. Return `{ subtotalKopecks: subtotal, tierDiscountKopecks: tierDiscount, couponDiscountKopecks: couponDiscount, shippingKopecks: shipping, totalKopecks: sum(remaining) + shipping }`.

Invariants: all five fields are integer `number`; `tierDiscount + couponDiscount ≤ subtotal`; `total === subtotal - tierDiscount - couponDiscount + shipping`.

Integer percent check: `Number.isInteger(c.value)`. Same for fixed `value`.

## Risks / Trade-offs

- [Implementer “simplifies” to one rounding on the subtotal] → AC-10 fails (4 vs 3). Algorithm above is mandatory.
- [Implementer uses `Date.now()`] → AC-2 depends on the machine. `nowIso` is required.
- [Implementer “fixes” empty-order shipping to 49 грн] → conflicts with existing `shippingKopecks([]) === 0`. Always call the seeded function.
- [Float percent like `remaining * 0.1`] → kopecks drift. Only the `+ 50 / 100` integer formula.

## Migration Plan

- Library-only change: add module + tests, re-export. No data migration, no rollback beyond revert of the new files.
- Verify: `cd app && npm test` (8 existing + AC-1…AC-15) and `npm run typecheck`.
