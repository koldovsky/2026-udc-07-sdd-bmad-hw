## 1. Scaffold

- [x] 1.1 Add `app/src/discounts.ts` exporting `PriceBreakdown` and `priceOrder(order, catalog, nowIso)` with the signatures from `docs/spec/pricing-discounts.md` §5; do not edit `app/src/types.ts` or signatures in `app/src/pricing.ts`. Verify: `cd app && npm run typecheck` passes (stub return of zeros is acceptable until 2.1).
- [x] 1.2 Re-export `priceOrder` and `PriceBreakdown` from `app/src/index.ts` (named exports, `.js` import path). Verify: the symbols resolve from `app/src/index.ts` and typecheck still passes.

## 2. Engine (normative algorithm from spec §5 / design.md)

Implement `priceOrder` as a pure function (no I/O, no `Date.now()`). Money is integer kopecks only. Use this algorithm verbatim:

1. `remaining[i] = lineTotalKopecks(order.items[i])` for each index `i`.
2. `subtotal = subtotalKopecks(order)`.
3. `percent = tierPercent(order)`. `tierDiscount = 0`.
4. If `percent > 0`, for each `i` in array order: `d = Math.floor((remaining[i] * percent + 50) / 100)`; `d = min(d, remaining[i])`; `remaining[i] -= d`; `tierDiscount += d`.
5. `couponDiscount = 0`. `seen` = empty set of strings.
6. For each `code` in `order.coupons` (typing order):
   1. If `code` is already in `seen` — skip. Else add to `seen`.
   2. `c` = first catalog element with `c.code === code` (exact, case-sensitive, no trim). None — skip.
   3. `tNow = Date.parse(nowIso)`, `tExp = Date.parse(c.expiresAt)`. If either is `NaN` or `tNow >= tExp` — skip.
   4. If `c.minSubtotalKopecks !== undefined` and `subtotal < c.minSubtotalKopecks` — skip.
   5. If `c.kind === "percent"`: if `!Number.isInteger(c.value)` or `c.value < 0` or `c.value > 100` — skip. Else for each `i` in `eligible(c)`: same `floor((remaining * value + 50) / 100)` formula; add to `couponDiscount`.
   6. If `c.kind === "fixed"`: if `!Number.isInteger(c.value)` or `c.value < 0` — skip. `need = c.value`. For each `i` in `eligible(c)`: `take = min(remaining[i], need)`; subtract; if `need === 0` stop the line loop.
   7. Other `kind` — skip.
7. `eligible(c)` = all indices if `c.category` is unset; else matching `category`, increasing index.
8. `shipping = shippingKopecks(order)`.
9. Return `{ subtotalKopecks: subtotal, tierDiscountKopecks: tierDiscount, couponDiscountKopecks: couponDiscount, shippingKopecks: shipping, totalKopecks: sum(remaining) + shipping }`.

- [x] 2.1 Implement the algorithm above in `app/src/discounts.ts` using existing `lineTotalKopecks`, `subtotalKopecks`, `shippingKopecks`, `tierPercent`. Verify: no `any`, no float money math, `npm run typecheck` passes.

## 3. Acceptance tests (vitest, titles MUST start with `AC-N:`)

Default `nowIso` in tests: `2026-09-06T12:00:00.000Z`. Country `UA` unless stated. File: `app/src/discounts.test.ts`.

- [x] 3.1 Add test `AC-1: Gold order without coupons` — one `standard` item 100000, gold, no coupons → subtotal 100000, tier 10000, coupon 0, shipping 4900, total 94900. Verify: that test passes.
- [x] 3.2 Add test `AC-2: expired coupon does not apply` — same as AC-1 plus `OLD20` 20% with `expiresAt` `2026-09-01T00:00:00.000Z` → no throw, tier 10000, coupon 0, total 94900. Verify: that test passes.
- [x] 3.3 Add test `AC-3: two coupons on the same category` — one `fresh` 100000, none, `["FRESH10","FRESH5"]` (10% then 5%, fresh only) → coupon 14500, tier 0, shipping 4900, total 90400. Verify: that test passes.
- [x] 3.4 Add test `AC-4: discount exceeds merchandise` — one `standard` 20000, none, fixed `BIG500` value 50000 → coupon 20000, tier 0, shipping 4900, total 4900. Verify: that test passes.
- [x] 3.5 Add test `AC-5: half-kopeck rounds up` — one `standard` unit 15 qty 1, gold, no coupons → tier 2, coupon 0, shipping 4900, total 4913. Verify: that test passes.
- [x] 3.6 Add test `AC-6: empty order` — `items: []`, gold, UA, any catalog codes → all zeros, no throw. Verify: that test passes.
- [x] 3.7 Add test `AC-7: category coupon on fresh only` — fresh 60000 + standard 40000, none, 20% fresh → coupon 12000, tier 0, shipping 4900, total 92900. Verify: that test passes.
- [x] 3.8 Add test `AC-8: minSubtotal on original not post-tier` — one item 60000, gold, 10% unscoped `minSubtotalKopecks` 56000 → tier 6000, coupon 5400, shipping 4900, total 53500. Verify: that test passes.
- [x] 3.9 Add test `AC-9: sequential Gold then 15 percent` — one item 100000, gold, valid 15% unscoped → tier 10000, coupon 13500, shipping 4900, total 81400. Verify: that test passes.
- [x] 3.10 Add test `AC-10: two lines round separately` — two `standard` lines of 15, gold, no coupons → tier 4, shipping 4900, total 4926. Verify: that test passes.
- [x] 3.11 Add test `AC-11: minSubtotal not met` — one item 40000, none, 10% `minSubtotalKopecks` 50000 → coupon 0, tier 0, shipping 4900, total 44900. Verify: that test passes.
- [x] 3.12 Add test `AC-12: duplicate and unknown codes` — one item 100000, none, `["SAVE10","SAVE10","UNKNOWN"]`, catalog only valid 10% `SAVE10` → coupon 10000, total 94900. Verify: that test passes.

## 4. Regression

- [x] 4.1 Run `cd app && npm test` and `npm run typecheck`. Verify: all tests green, including the original 8 in `pricing.test.ts`, and every AC-1…AC-12 name appears in the vitest output.
