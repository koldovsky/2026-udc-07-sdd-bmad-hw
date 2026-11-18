# Specification: Order discounts (loyalty tier + coupons)

**Status:** agreed
**Source:** `materials/feature-request.md`
**Decisions author:** Yevhen Braha

---

## 1. Goal

Checkout applies the customer's loyalty-tier discount (Silver 5%, Gold 10%) and
any valid coupons (percent or fixed, optionally limited to a category or a
minimum subtotal) to an order, so the customer benefits from both. Every amount
is computed in integer kopecks by a single deterministic rule set, so the same
order, coupons and clock always produce the same price breakdown, regardless of
who implemented it.

## 2. Out of scope

The following are deliberately **not** part of this iteration and must not be
implemented:

- Coupon start dates / "not yet active" coupons (see D-15).
- Coupon data validation (see D-13), including: percent > 100, non-integer
  percent values, negative values, duplicate coupon codes in `coupons[]` (after
  trim + case-folding), and `expiresAt` values that are not ISO-8601 with an
  explicit `Z` or offset.
- User-facing errors, messages or any UI (e.g. "coupon expired" notices).
- New discount types (BOGO, free shipping, bundles, per-customer coupons, etc.).
- Per-line allocation of discounts (breakdown is order-level only).
- Caching of results.
- Persistence / database of coupons or applied discounts.
- Currencies other than UAH (kopecks).
- Any change to the signatures or behaviour in `app/src/pricing.ts` or to the
  shapes in `app/src/types.ts`.

## 3. Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| D-1 | Tier + coupon: additive or sequential? | Sequential: tier first on the item subtotal, coupons on the amount after tier. | The discount never exceeds the expected one: 1 000 UAH, 10% tier + 15% coupon = 235 UAH off, not 250. |
| D-2 | Discount base: items or items + shipping? | Items only. Shipping is added after and is never discounted. | Shipping is separately specified and is not a product price. |
| D-3 | Several coupons: all / best / first? | All valid coupons can apply, but only **one per scope** (scope = whole order, or one category). Only coupons that are typed (D-17), known, not expired (D-9) and pass `minSubtotalKopecks` (D-6) compete within a scope. Within a scope the coupon with the larger discount in kopecks wins (computed on its base, after the D-11 cap); tie → the one with the earlier `expiresAt`; still tie → the one typed first. The tie-break and the D-10 "first position" rule are not observable in `PriceBreakdown` (tied coupons give the same amount); they are kept for a deterministic implementation and require no AC. | Customer gets the best deal per scope; fully deterministic. |
| D-4 | Rounding: where and which direction? | Each discount amount (tier, each coupon) is computed separately in integer kopecks and rounded **down** (floor); half a kopeck rounds down (10% of 1 005 kopecks = 100). | Integer-only, deterministic, never over-discounts. |
| D-5 | Category coupon base? | Subtotal of that category's lines after the tier discount: `catSubtotal - floor(catSubtotal * tierPercent / 100)`. Accepted consequence: the per-category tier deduction is floored separately, so it may differ by up to 1 kopeck per category from the order-level tier split (`tierDiscountKopecks` stays `floor(subtotal * tierPercent / 100)`). | Consistent with D-1. |
| D-6 | `minSubtotalKopecks` checked before or after other discounts? | Compared with the whole-order item subtotal **before** any discount; condition `subtotal >= minSubtotalKopecks`. This holds for category coupons too: the threshold is never compared with the category subtotal. | It is the threshold the customer sees on the cart; no circular dependency. |
| D-7 | Can the total become negative? | No. The total coupon discount is capped at the item amount after tier (`subtotal - tierDiscount`); shipping is always charged as computed by `shippingKopecks`. | Total is never below shipping. |
| D-8 | Expired coupon: silent or error? | Silently ignored (contributes 0), no error. | The contract has no error channel; user messaging is UI, out of scope. |
| D-9 | Which clock decides expiry? | Optional 3rd parameter `now: Date` (default: current time). A coupon is valid iff `now < expiresAt`, comparing instants. `expiresAt` is ISO-8601 with an explicit `Z` or UTC offset; other formats are out of scope (D-13). | Deterministic tests; matches "not valid on or after this instant" in `types.ts`. |
| D-10 | How are typed codes matched to coupons? | `Order.coupons` strings are matched to `Coupon.code` after trim + case-insensitive comparison. `Coupon.code` in the catalog is normalised the same way (trim + case-insensitive). Unknown code is ignored. A code typed twice counts once (at its first position). | The order holds strings; the engine receives `Coupon` objects. |
| D-11 | Fixed coupon larger than its base / category absent? | Fixed coupon discount = `min(value, its base)`. A category coupon whose category is absent from the order gives 0. | No negative line. |
| D-12 | Which categories does the tier apply to? | All item categories (`standard`, `fresh`, `digital`); not to shipping. | The ticket makes no exceptions. |
| D-13 | Invalid coupon data? | Out of scope; input is assumed valid: a percent coupon `value` is an integer 0–100; fixed values are non-negative; coupon codes in `coupons[]` are unique after trim + case-folding; `expiresAt` is ISO-8601 with an explicit `Z` or offset. Anything else (percent > 100, non-integer percent, negative values, duplicate codes, other date formats) is invalid input with undefined behaviour. | Validation is a separate feature. |
| D-14 | Empty order? | All amounts 0, total 0 (`shippingKopecks` already returns 0 for no items). | Explicit edge case. |
| D-15 | Coupon not yet active? | `Coupon` has no start date and `types.ts` is a protected contract, so any non-expired coupon is active; start dates are out of scope. | Supporting them requires changing the shapes. |
| D-16 | Coupons of different scopes: chained or independent? | Each is computed independently from its own base after tier (not from the amount after other coupons); their sum is then capped per D-7. | Result does not depend on typing order; each coupon is testable alone. |
| D-17 | Can a `Coupon` passed in `coupons[]` apply if the customer never typed its code? | No. Only coupons whose code appears in `Order.coupons` (per D-10 matching) can apply; `Coupon` objects never typed by the customer are ignored. | The customer's input decides; `coupons[]` is just the catalog. |

## 4. Acceptance criteria

**Shared fixture (applies to every AC unless the AC says otherwise):**

- `now = 2026-11-18T12:00:00.000Z` (passed explicitly as the 3rd argument).
- Every coupon has `expiresAt = "2027-01-01T00:00:00.000Z"`.
- `country = "UA"` (shipping 4 900 kopecks when at least one non-digital item).
- Every line has `quantity = 1`; `customerTier = "none"`.
- A coupon without `category` is whole-order scope; without `minSubtotalKopecks` has no threshold.
- Each coupon in `coupons` is also typed in `order.coupons` with exactly its `code`, in the listed order.
- Amounts are kopecks; UAH in parentheses. Percent coupon discount = `floor(base * value / 100)`; fixed = `min(value, base)`.

- **AC-1:** WHEN a Gold customer orders one `standard` item of 100 000 (1 000.00 UAH) with no coupons, THEN subtotal 100 000, tier discount `floor(100 000 * 10 / 100)` = 10 000 (100.00 UAH), coupon discount 0, shipping 4 900 (49.00 UAH), total `100 000 - 10 000 - 0 + 4 900` = 94 900 (949.00 UAH). *(D-12, D-2)*
- **AC-2:** WHEN a Gold customer orders one `standard` item of 100 000 (1 000.00 UAH) with a whole-order percent coupon of 15, THEN tier discount 10 000 (100.00 UAH), coupon discount `floor(90 000 * 15 / 100)` = 13 500 (135.00 UAH) — total discount 23 500 (235.00 UAH), not 25 000 — shipping 4 900, total 81 400 (814.00 UAH). *(D-1)*
- **AC-3:** WHEN a Silver customer in `country = "PL"` orders a `standard` item of 20 000 × quantity 2 with a whole-order fixed coupon of 5 000 (50.00 UAH), THEN subtotal 40 000 (400.00 UAH), tier discount `floor(40 000 * 5 / 100)` = 2 000 (20.00 UAH), coupon discount `min(5 000, 38 000)` = 5 000 (50.00 UAH), shipping 19 900 (199.00 UAH) undiscounted, total `40 000 - 2 000 - 5 000 + 19 900` = 52 900 (529.00 UAH). *(D-2, D-11)*
- **AC-4:** WHEN an order has one `standard` item of 50 000 (500.00 UAH) and two whole-order coupons typed in order `A` (percent 10 → 5 000) then `B` (fixed 6 000), THEN only `B` applies: coupon discount 6 000 (60.00 UAH), total `50 000 - 6 000 + 4 900` = 48 900 (489.00 UAH). *(D-3)*
- **AC-5:** WHEN a Silver customer orders `fresh` 30 000 + `standard` 20 000 with two `fresh` coupons `F10` (percent 10) and `F25` (fixed 2 500), THEN subtotal 50 000, tier discount `floor(50 000 * 5 / 100)` = 2 500, fresh base `30 000 - floor(30 000 * 5 / 100)` = 28 500, `F10` = `floor(28 500 * 10 / 100)` = 2 850 beats `F25` = 2 500, so coupon discount 2 850 (28.50 UAH), total `50 000 - 2 500 - 2 850 + 4 900` = 49 550 (495.50 UAH). *(D-3, D-5)*
- **AC-6:** WHEN an order has one `standard` item of 40 000 and two whole-order coupons with equal discounts, `X` (percent 10 → 4 000, `expiresAt` 2027-03-01T00:00:00.000Z) typed first and `Y` (fixed 4 000, `expiresAt` 2027-01-01T00:00:00.000Z) typed second, THEN exactly one coupon applies (the winner per D-3 is `Y`, earlier expiry): coupon discount 4 000 (40.00 UAH), not 8 000, total `40 000 - 4 000 + 4 900` = 40 900 (409.00 UAH). *(D-3)*
- **AC-7:** WHEN a Gold customer orders `standard` 60 000 + `fresh` 40 000 with a whole-order percent coupon `W` of 10 and a `fresh` percent coupon `F` of 20, typed either as `["W","F"]` or `["F","W"]`, THEN subtotal 100 000, tier discount 10 000, `W` = `floor(90 000 * 10 / 100)` = 9 000, fresh base `40 000 - floor(40 000 * 10 / 100)` = 36 000, `F` = `floor(36 000 * 20 / 100)` = 7 200, coupon discount 16 200 (162.00 UAH) in both typing orders, total `100 000 - 10 000 - 16 200 + 4 900` = 78 700 (787.00 UAH). *(D-16, D-5)*
- **AC-8:** WHEN a Gold customer orders one `standard` item of 1 005 (10.05 UAH) with no coupons, THEN tier discount `floor(1 005 * 10 / 100)` = `floor(100.5)` = 100 (1.00 UAH), total `1 005 - 100 + 4 900` = 5 805 (58.05 UAH). *(D-4, half-kopeck edge case)*
- **AC-9:** WHEN a Silver customer orders one `standard` item of 999 (9.99 UAH) with a whole-order percent coupon of 15, THEN tier discount `floor(999 * 5 / 100)` = `floor(49.95)` = 49, coupon discount `floor(950 * 15 / 100)` = `floor(142.5)` = 142, total `999 - 49 - 142 + 4 900` = 5 708 (57.08 UAH). *(D-4, D-1)*
- **AC-10:** WHEN an order has one `standard` item of 50 000 (500.00 UAH) and a whole-order fixed coupon of 5 000 with `minSubtotalKopecks = 50 000`, THEN the coupon applies (`50 000 >= 50 000`): coupon discount 5 000 (50.00 UAH), total `50 000 - 5 000 + 4 900` = 49 900 (499.00 UAH). *(D-6, threshold-exact edge case)*
- **AC-11:** WHEN a Gold customer orders one `standard` item of 50 000 with a whole-order fixed coupon of 5 000 and `minSubtotalKopecks = 50 000`, THEN the threshold is checked against the pre-discount subtotal 50 000 (not the after-tier 45 000), so the coupon applies: tier discount 5 000, coupon discount 5 000, total `50 000 - 5 000 - 5 000 + 4 900` = 44 900 (449.00 UAH). *(D-6, D-1)*
- **AC-12:** WHEN an order has one `standard` item of 49 999 (499.99 UAH) and a whole-order fixed coupon of 5 000 with `minSubtotalKopecks = 50 000`, THEN the coupon does not apply: coupon discount 0, total `49 999 + 4 900` = 54 899 (548.99 UAH). *(D-6, one kopeck below threshold edge case)*
- **AC-13:** WHEN an order has one `standard` item of 3 000 (30.00 UAH) and a whole-order fixed coupon of 10 000 (100.00 UAH), THEN coupon discount `min(10 000, 3 000)` = 3 000 (30.00 UAH), total `3 000 - 3 000 + 4 900` = 4 900 (49.00 UAH) — never negative, shipping still charged. *(D-11, D-7, discount-larger-than-total edge case)*
- **AC-14:** WHEN an order has one `fresh` item of 10 000 (100.00 UAH) with a whole-order fixed coupon of 8 000 and a `fresh` fixed coupon of 5 000, THEN the two coupons compute 8 000 and 5 000 independently, their sum 13 000 is capped at the after-tier item amount 10 000, so coupon discount 10 000 (100.00 UAH), total `10 000 - 10 000 + 4 900` = 4 900 (49.00 UAH). *(D-7, D-16, cross-scope cap edge case)*
- **AC-15:** WHEN an order has one `standard` item of 20 000 (200.00 UAH) and a `fresh` percent coupon of 50, THEN the coupon gives 0 (no `fresh` lines): coupon discount 0, total `20 000 + 4 900` = 24 900 (249.00 UAH). *(D-11)*
- **AC-16:** WHEN an order has one `standard` item of 20 000 and a whole-order percent coupon of 10 with `expiresAt = "2026-01-01T00:00:00.000Z"` (before `now`), THEN `priceOrder` does not throw, coupon discount 0, total 24 900 (249.00 UAH). *(D-8)*
- **AC-17:** WHEN an order has one `standard` item of 20 000 and a whole-order percent coupon of 10 with `expiresAt = "2026-11-18T12:00:00.000Z"` equal to `now`, THEN the coupon is expired (`now < expiresAt` is false): coupon discount 0, total 24 900 (249.00 UAH). *(D-9, expires-exactly-at-now edge case)*
- **AC-18:** WHEN the same order and coupon as AC-17 are priced with `now = 2026-11-18T11:59:59.999Z`, THEN the coupon is valid: coupon discount `floor(20 000 * 10 / 100)` = 2 000 (20.00 UAH), total `20 000 - 2 000 + 4 900` = 22 900 (229.00 UAH). *(D-9)*
- **AC-19:** WHEN an order has one `standard` item of 20 000, `order.coupons = ["  save10 ", "NOPE"]`, and the only `Coupon` is `{ code: "SAVE10", kind: "percent", value: 10 }`, THEN `"  save10 "` matches `SAVE10` and `"NOPE"` is ignored without error: coupon discount 2 000 (20.00 UAH), total 22 900 (229.00 UAH). *(D-10)*
- **AC-20:** WHEN an order has one `standard` item of 20 000, `order.coupons = ["SAVE30", "save30"]`, and the only `Coupon` is `{ code: "SAVE30", kind: "fixed", value: 3 000 }`, THEN the code counts once: coupon discount 3 000 (30.00 UAH), not 6 000, total `20 000 - 3 000 + 4 900` = 21 900 (219.00 UAH). *(D-10)*
- **AC-21:** WHEN a Gold customer submits an order with `items = []` and a typed valid whole-order percent coupon of 10, THEN subtotal 0, tier discount 0, coupon discount 0, shipping 0, total 0. *(D-14, empty-order edge case)*
- **AC-22:** WHEN a Gold customer orders one `digital` item of 30 000 (300.00 UAH) with no coupons, THEN tier discount `floor(30 000 * 10 / 100)` = 3 000 (30.00 UAH), shipping 0 (all-digital), total `30 000 - 3 000 + 0` = 27 000 (270.00 UAH). *(D-12)*
- **AC-23:** WHEN an order has one `standard` item of 20 000 (200.00 UAH), `order.coupons = []`, and `coupons[]` contains a valid whole-order percent coupon `SAVE10` of 10, THEN the coupon is ignored because it was never typed: coupon discount 0, total `20 000 + 4 900` = 24 900 (249.00 UAH). *(D-17)*
- **AC-24:** WHEN an order has `standard` 40 000 + `fresh` 10 000 and a `fresh` fixed coupon of 2 000 with `minSubtotalKopecks = 50 000`, THEN the threshold is compared with the whole-order subtotal 50 000 (not the `fresh` subtotal 10 000), so the coupon applies: coupon discount `min(2 000, 10 000)` = 2 000 (20.00 UAH), total `50 000 - 2 000 + 4 900` = 52 900 (529.00 UAH). *(D-6)*
- **AC-25:** WHEN an order has one `standard` item of 20 000, `order.coupons = ["save10"]`, and the only `Coupon` is `{ code: "  Save10 ", kind: "percent", value: 10 }`, THEN the catalog code matches after the same trim + case-folding: coupon discount `floor(20 000 * 10 / 100)` = 2 000 (20.00 UAH), total `20 000 - 2 000 + 4 900` = 22 900 (229.00 UAH). *(D-10)*
- **AC-26:** WHEN `now` is omitted, an order has one `standard` item of 20 000, and a typed whole-order percent coupon of 10 has `expiresAt = "2099-01-01T00:00:00.000Z"`, THEN the default clock is before expiry so the coupon applies: coupon discount `floor(20 000 * 10 / 100)` = 2 000 (20.00 UAH), total `20 000 - 2 000 + 4 900` = 22 900 (229.00 UAH). *(D-9, default clock)*
- **AC-27:** WHEN `now` is omitted and the same order has that coupon with `expiresAt = "2000-01-01T00:00:00.000Z"`, THEN the default clock is on or after expiry so the coupon is ignored: coupon discount 0, total `20 000 + 4 900` = 24 900 (249.00 UAH). *(D-9, default clock)*
- **AC-28:** WHEN a Gold customer orders one `standard` item of 20 000 and types `" SAVE10 "` for a whole-order percent coupon `SAVE10` of 10, THEN tier discount `floor(20 000 * 10 / 100)` = 2 000, coupon discount `floor(18 000 * 10 / 100)` = 1 800, total `20 000 - 2 000 - 1 800 + 4 900` = 21 100 (211.00 UAH), and afterwards `order` and `coupons` deep-equal the copies taken before the call. *(contract: purity)*

Coverage: D-1 (AC-2, AC-9, AC-11), D-2 (AC-1, AC-3), D-3 (AC-4, AC-5, AC-6),
D-4 (AC-8, AC-9), D-5 (AC-5, AC-7), D-6 (AC-10, AC-11, AC-12, AC-24), D-7
(AC-13, AC-14), D-8 (AC-16), D-9 (AC-17, AC-18, AC-26, AC-27), D-10 (AC-19, AC-20, AC-25), D-11
(AC-3, AC-13, AC-15), D-12 (AC-1, AC-22), D-14 (AC-21), D-16 (AC-7, AC-14),
D-17 (AC-23). AC-28 covers the section 5 purity contract. D-13 and D-15 are scope decisions with no runtime behaviour to
test; the D-3 tie-break and D-10 first-position rule are not observable in
`PriceBreakdown` (see D-3).

## 5. Contract

New file `app/src/discounts.ts`, re-exported from `app/src/index.ts`:

```ts
import type { Order, Coupon } from "./types.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

export function priceOrder(order: Order, coupons: Coupon[], now?: Date): PriceBreakdown;
```

- **Invariant:** `totalKopecks = subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks + shippingKopecks`.
- **Reuse:** `subtotalKopecks`, `shippingKopecks` and `tierPercent` from
  `app/src/pricing.ts` must be used (not reimplemented); their signatures and
  behaviour stay unchanged.
- All fields are non-negative integers (kopecks); no floating-point arithmetic on amounts.
- `priceOrder` is pure: it does not mutate `order` or `coupons` and does not throw for
  expired, unknown or non-applicable coupons.
- `now` defaults to the current time when omitted (D-9).

## 6. How to verify

```bash
cd app
npm test
npm run typecheck
```

- `npm test` is green, including the 8 pre-existing tests in `pricing.test.ts`.
- `npm run typecheck` reports no errors.
- Every discount test is named `AC-N: ...` matching an AC id in section 4, and every
  AC-1 … AC-28 appears in the test output at least once.
