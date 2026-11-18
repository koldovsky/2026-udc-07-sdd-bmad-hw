# Spec Delta

## Purpose

Computes an order's price breakdown in integer kopecks by applying the customer's
loyalty-tier discount and their typed, valid coupons to the item subtotal, then
adding undiscounted shipping, so the same order, coupons and clock always produce
the same result. Source: `docs/spec/pricing-discounts.md` (D-1..D-17, AC-1..AC-28).

Shared fixture for every scenario in this spec unless the scenario says otherwise:
`now = 2026-11-18T12:00:00.000Z` passed explicitly; every coupon has
`expiresAt = "2027-01-01T00:00:00.000Z"`; `country = "UA"` (shipping 4 900 when at
least one non-digital item); every line `quantity = 1`; `customerTier = "none"`; a
coupon without `category` is whole-order scope; without `minSubtotalKopecks` it has
no threshold; each listed coupon is typed in `order.coupons` with exactly its
`code`, in listed order. Amounts are kopecks, UAH in parentheses. Percent discount
= `floor(base * value / 100)`; fixed = `min(value, base)`.

## ADDED Requirements

### Requirement: Price breakdown contract
Pricing an order with a coupon catalog and an optional clock `now` SHALL return subtotal, tier discount, coupon discount, shipping and total, all non-negative integer kopecks, with `total = subtotal - tierDiscount - couponDiscount + shipping`. Subtotal and shipping SHALL be the existing seeded values. Pricing MUST be pure (no mutation of order or coupons), MUST NOT throw for expired, unknown or non-applicable coupons, and `now` SHALL default to the current time.

#### Scenario: AC-1: Gold tier, no coupons
- **WHEN** a Gold customer orders one `standard` item of 100 000 (1 000.00 UAH) with no coupons
- **THEN** subtotal is 100 000, tier discount is `floor(100 000 * 10 / 100)` = 10 000 (100.00 UAH), coupon discount is 0, shipping is 4 900 (49.00 UAH), and total is `100 000 - 10 000 - 0 + 4 900` = 94 900 (949.00 UAH)

#### Scenario: AC-28: Inputs are unchanged after pricing
- **WHEN** a Gold customer orders one `standard` item of 20 000 and types `" SAVE10 "` for a whole-order percent coupon `SAVE10` of 10
- **THEN** tier discount is `floor(20 000 * 10 / 100)` = 2 000, coupon discount is `floor(18 000 * 10 / 100)` = 1 800, total is `20 000 - 2 000 - 1 800 + 4 900` = 21 100 (211.00 UAH), and afterwards `order` and `coupons` deep-equal the copies taken before the call

### Requirement: Tier discount first, coupons on the after-tier amount
The tier discount SHALL be computed on the item subtotal first, and coupon discounts SHALL be computed on the amount after the tier discount (sequential, not additive). (D-1)

#### Scenario: AC-2: Gold tier plus 15% whole-order coupon
- **WHEN** a Gold customer orders one `standard` item of 100 000 (1 000.00 UAH) with a whole-order percent coupon of 15
- **THEN** tier discount is 10 000 (100.00 UAH), coupon discount is `floor(90 000 * 15 / 100)` = 13 500 (135.00 UAH), total discount is 23 500 (235.00 UAH) not 25 000, shipping is 4 900, and total is 81 400 (814.00 UAH)

### Requirement: Shipping is never discounted
The discount base SHALL be item amounts only. Shipping SHALL be added after all discounts at the value given by the existing shipping rule and SHALL never be discounted. (D-2)

#### Scenario: AC-3: Silver, international, fixed coupon
- **WHEN** a Silver customer in `country = "PL"` orders a `standard` item of 20 000 × quantity 2 with a whole-order fixed coupon of 5 000 (50.00 UAH)
- **THEN** subtotal is 40 000 (400.00 UAH), tier discount is `floor(40 000 * 5 / 100)` = 2 000 (20.00 UAH), coupon discount is `min(5 000, 38 000)` = 5 000 (50.00 UAH), shipping is 19 900 (199.00 UAH) undiscounted, and total is `40 000 - 2 000 - 5 000 + 19 900` = 52 900 (529.00 UAH)

### Requirement: Tier discount applies to all item categories
The tier percentage (Silver 5, Gold 10, none 0) SHALL apply to items of every category (`standard`, `fresh`, `digital`) and SHALL NOT apply to shipping. The tier discount SHALL equal `floor(subtotal * tierPercent / 100)`. (D-12)

#### Scenario: AC-22: Gold tier on an all-digital order
- **WHEN** a Gold customer orders one `digital` item of 30 000 (300.00 UAH) with no coupons
- **THEN** tier discount is `floor(30 000 * 10 / 100)` = 3 000 (30.00 UAH), shipping is 0 (all-digital), and total is `30 000 - 3 000 + 0` = 27 000 (270.00 UAH)

### Requirement: Each discount amount is floored to whole kopecks
Each discount amount (the tier discount and each coupon's discount) SHALL be computed separately in integer kopecks and rounded down (floor); half a kopeck rounds down. No floating-point arithmetic SHALL be used on amounts. (D-4)

#### Scenario: AC-8: Half-kopeck tier discount rounds down
- **WHEN** a Gold customer orders one `standard` item of 1 005 (10.05 UAH) with no coupons
- **THEN** tier discount is `floor(1 005 * 10 / 100)` = `floor(100.5)` = 100 (1.00 UAH), and total is `1 005 - 100 + 4 900` = 5 805 (58.05 UAH)

#### Scenario: AC-9: Tier and coupon each floored separately
- **WHEN** a Silver customer orders one `standard` item of 999 (9.99 UAH) with a whole-order percent coupon of 15
- **THEN** tier discount is `floor(999 * 5 / 100)` = `floor(49.95)` = 49, coupon discount is `floor(950 * 15 / 100)` = `floor(142.5)` = 142, and total is `999 - 49 - 142 + 4 900` = 5 708 (57.08 UAH)

### Requirement: Only typed coupons can apply
A coupon in the catalog SHALL apply only if its code appears in the order's typed codes; catalog coupons the customer never typed SHALL be ignored. (D-17)

#### Scenario: AC-23: Valid but untyped coupon is ignored
- **WHEN** an order has one `standard` item of 20 000 (200.00 UAH), `order.coupons = []`, and the catalog contains a valid whole-order percent coupon `SAVE10` of 10
- **THEN** the coupon is ignored because it was never typed: coupon discount is 0, and total is `20 000 + 4 900` = 24 900 (249.00 UAH)

### Requirement: Typed codes are matched by trim and case-insensitive comparison
Typed codes SHALL be matched to catalog `Coupon.code` values after the same normalisation on both sides: trim whitespace, then compare case-insensitively. An unknown typed code SHALL be ignored without error. A code typed more than once SHALL count once, at its first position. (D-10)

#### Scenario: AC-19: Whitespace and case are normalised; unknown code ignored
- **WHEN** an order has one `standard` item of 20 000, `order.coupons = ["  save10 ", "NOPE"]`, and the only catalog coupon is `{ code: "SAVE10", kind: "percent", value: 10 }`
- **THEN** `"  save10 "` matches `SAVE10` and `"NOPE"` is ignored without error: coupon discount is 2 000 (20.00 UAH), and total is 22 900 (229.00 UAH)

#### Scenario: AC-20: A code typed twice counts once
- **WHEN** an order has one `standard` item of 20 000, `order.coupons = ["SAVE30", "save30"]`, and the only catalog coupon is `{ code: "SAVE30", kind: "fixed", value: 3 000 }`
- **THEN** the code counts once: coupon discount is 3 000 (30.00 UAH), not 6 000, and total is `20 000 - 3 000 + 4 900` = 21 900 (219.00 UAH)

#### Scenario: AC-25: Catalog code is trimmed and case-folded
- **WHEN** an order has one `standard` item of 20 000, `order.coupons = ["save10"]`, and the only catalog coupon is `{ code: "  Save10 ", kind: "percent", value: 10 }`
- **THEN** the catalog code matches after the same trim and case-folding: coupon discount is `floor(20 000 * 10 / 100)` = 2 000 (20.00 UAH), and total is `20 000 - 2 000 + 4 900` = 22 900 (229.00 UAH)

### Requirement: Expired coupons are silently ignored
A coupon whose expiry has passed SHALL contribute 0 and SHALL NOT cause an error. (D-8)

#### Scenario: AC-16: Expired coupon does not throw
- **WHEN** an order has one `standard` item of 20 000 and a whole-order percent coupon of 10 with `expiresAt = "2026-01-01T00:00:00.000Z"` (before `now`)
- **THEN** pricing does not throw, coupon discount is 0, and total is 24 900 (249.00 UAH)

### Requirement: Expiry is decided by the supplied clock
A coupon SHALL be valid if and only if `now < expiresAt`, comparing instants, where `now` is the supplied clock (default: current time). `expiresAt` is ISO-8601 with an explicit `Z` or UTC offset. (D-9)

#### Scenario: AC-17: Coupon expiring exactly at now is expired
- **WHEN** an order has one `standard` item of 20 000 and a whole-order percent coupon of 10 with `expiresAt = "2026-11-18T12:00:00.000Z"` equal to `now`
- **THEN** the coupon is expired (`now < expiresAt` is false): coupon discount is 0, and total is 24 900 (249.00 UAH)

#### Scenario: AC-18: One millisecond before expiry the coupon is valid
- **WHEN** the same order and coupon as AC-17 are priced with `now = 2026-11-18T11:59:59.999Z`
- **THEN** the coupon is valid: coupon discount is `floor(20 000 * 10 / 100)` = 2 000 (20.00 UAH), and total is `20 000 - 2 000 + 4 900` = 22 900 (229.00 UAH)

#### Scenario: AC-26: Omitted now uses the clock; future expiry applies
- **WHEN** `now` is omitted, an order has one `standard` item of 20 000, and a typed whole-order percent coupon of 10 has `expiresAt = "2099-01-01T00:00:00.000Z"`
- **THEN** the default clock is before expiry, so the coupon applies: coupon discount is `floor(20 000 * 10 / 100)` = 2 000 (20.00 UAH), and total is `20 000 - 2 000 + 4 900` = 22 900 (229.00 UAH)

#### Scenario: AC-27: Omitted now uses the clock; past expiry is ignored
- **WHEN** `now` is omitted and the same order has that coupon with `expiresAt = "2000-01-01T00:00:00.000Z"`
- **THEN** the default clock is on or after expiry, so the coupon is ignored: coupon discount is 0, and total is `20 000 + 4 900` = 24 900 (249.00 UAH)

### Requirement: Minimum subtotal is checked against the pre-discount order subtotal
A coupon with `minSubtotalKopecks` SHALL be eligible only if the whole-order item subtotal before any discount satisfies `subtotal >= minSubtotalKopecks`. This SHALL hold for category coupons too; the threshold is never compared with a category subtotal. (D-6)

#### Scenario: AC-10: Subtotal exactly at threshold
- **WHEN** an order has one `standard` item of 50 000 (500.00 UAH) and a whole-order fixed coupon of 5 000 with `minSubtotalKopecks = 50 000`
- **THEN** the coupon applies (`50 000 >= 50 000`): coupon discount is 5 000 (50.00 UAH), and total is `50 000 - 5 000 + 4 900` = 49 900 (499.00 UAH)

#### Scenario: AC-11: Threshold uses subtotal before tier discount
- **WHEN** a Gold customer orders one `standard` item of 50 000 with a whole-order fixed coupon of 5 000 and `minSubtotalKopecks = 50 000`
- **THEN** the threshold is checked against the pre-discount subtotal 50 000 (not the after-tier 45 000), so the coupon applies: tier discount is 5 000, coupon discount is 5 000, and total is `50 000 - 5 000 - 5 000 + 4 900` = 44 900 (449.00 UAH)

#### Scenario: AC-12: One kopeck below threshold
- **WHEN** an order has one `standard` item of 49 999 (499.99 UAH) and a whole-order fixed coupon of 5 000 with `minSubtotalKopecks = 50 000`
- **THEN** the coupon does not apply: coupon discount is 0, and total is `49 999 + 4 900` = 54 899 (548.99 UAH)

#### Scenario: AC-24: Category coupon threshold uses whole-order subtotal
- **WHEN** an order has `standard` 40 000 + `fresh` 10 000 and a `fresh` fixed coupon of 2 000 with `minSubtotalKopecks = 50 000`
- **THEN** the threshold is compared with the whole-order subtotal 50 000 (not the `fresh` subtotal 10 000), so the coupon applies: coupon discount is `min(2 000, 10 000)` = 2 000 (20.00 UAH), and total is `50 000 - 2 000 + 4 900` = 52 900 (529.00 UAH)

### Requirement: One winning coupon per scope
A scope is the whole order or one category. Among eligible coupons (typed, known, not expired, threshold met) in a scope, only one SHALL apply: the one with the larger discount in kopecks on its base after the fixed-coupon cap; on a tie, the earlier `expiresAt`; still tied, the one typed first. Coupons of different scopes can all apply. (D-3)

#### Scenario: AC-4: Larger whole-order coupon wins
- **WHEN** an order has one `standard` item of 50 000 (500.00 UAH) and two whole-order coupons typed in order `A` (percent 10 → 5 000) then `B` (fixed 6 000)
- **THEN** only `B` applies: coupon discount is 6 000 (60.00 UAH), and total is `50 000 - 6 000 + 4 900` = 48 900 (489.00 UAH)

#### Scenario: AC-6: Equal discounts in one scope apply only once
- **WHEN** an order has one `standard` item of 40 000 and two whole-order coupons with equal discounts, `X` (percent 10 → 4 000, `expiresAt` 2027-03-01T00:00:00.000Z) typed first and `Y` (fixed 4 000, `expiresAt` 2027-01-01T00:00:00.000Z) typed second
- **THEN** exactly one coupon applies (the winner is `Y`, earlier expiry): coupon discount is 4 000 (40.00 UAH), not 8 000, and total is `40 000 - 4 000 + 4 900` = 40 900 (409.00 UAH)

### Requirement: Category coupon base is the category subtotal after tier
A category coupon's base SHALL be the subtotal of that category's lines after the tier discount: `catSubtotal - floor(catSubtotal * tierPercent / 100)`. The reported tier discount SHALL remain `floor(subtotal * tierPercent / 100)` for the whole order, even if per-category flooring differs by up to 1 kopeck per category. (D-5)

#### Scenario: AC-5: Two fresh coupons compete on the after-tier fresh base
- **WHEN** a Silver customer orders `fresh` 30 000 + `standard` 20 000 with two `fresh` coupons `F10` (percent 10) and `F25` (fixed 2 500)
- **THEN** subtotal is 50 000, tier discount is `floor(50 000 * 5 / 100)` = 2 500, fresh base is `30 000 - floor(30 000 * 5 / 100)` = 28 500, `F10` = `floor(28 500 * 10 / 100)` = 2 850 beats `F25` = 2 500, so coupon discount is 2 850 (28.50 UAH), and total is `50 000 - 2 500 - 2 850 + 4 900` = 49 550 (495.50 UAH)

### Requirement: Coupons of different scopes are computed independently
Each scope's winning coupon SHALL be computed from its own after-tier base, not from the amount left after other coupons, so the result does not depend on typing order. (D-16)

#### Scenario: AC-7: Whole-order and fresh coupons, either typing order
- **WHEN** a Gold customer orders `standard` 60 000 + `fresh` 40 000 with a whole-order percent coupon `W` of 10 and a `fresh` percent coupon `F` of 20, typed either as `["W","F"]` or `["F","W"]`
- **THEN** subtotal is 100 000, tier discount is 10 000, `W` = `floor(90 000 * 10 / 100)` = 9 000, fresh base is `40 000 - floor(40 000 * 10 / 100)` = 36 000, `F` = `floor(36 000 * 20 / 100)` = 7 200, coupon discount is 16 200 (162.00 UAH) in both typing orders, and total is `100 000 - 10 000 - 16 200 + 4 900` = 78 700 (787.00 UAH)

### Requirement: Fixed coupons are capped at their base; absent category gives zero
A fixed coupon's discount SHALL be `min(value, its base)`. A category coupon whose category has no lines in the order SHALL give 0. (D-11)

#### Scenario: AC-15: Category coupon for an absent category
- **WHEN** an order has one `standard` item of 20 000 (200.00 UAH) and a `fresh` percent coupon of 50
- **THEN** the coupon gives 0 (no `fresh` lines): coupon discount is 0, and total is `20 000 + 4 900` = 24 900 (249.00 UAH)

### Requirement: Total coupon discount is capped; total never negative
The sum of all applied coupon discounts SHALL be capped at the item amount after tier (`subtotal - tierDiscount`). Shipping SHALL always be charged as computed, so the total is never below shipping and never negative. (D-7)

#### Scenario: AC-13: Fixed coupon larger than the order
- **WHEN** an order has one `standard` item of 3 000 (30.00 UAH) and a whole-order fixed coupon of 10 000 (100.00 UAH)
- **THEN** coupon discount is `min(10 000, 3 000)` = 3 000 (30.00 UAH), and total is `3 000 - 3 000 + 4 900` = 4 900 (49.00 UAH), never negative, shipping still charged

#### Scenario: AC-14: Cross-scope sum capped at after-tier item amount
- **WHEN** an order has one `fresh` item of 10 000 (100.00 UAH) with a whole-order fixed coupon of 8 000 and a `fresh` fixed coupon of 5 000
- **THEN** the two coupons compute 8 000 and 5 000 independently, their sum 13 000 is capped at the after-tier item amount 10 000, so coupon discount is 10 000 (100.00 UAH), and total is `10 000 - 10 000 + 4 900` = 4 900 (49.00 UAH)

### Requirement: Empty order prices to zero
An order with no items SHALL produce subtotal, tier discount, coupon discount, shipping and total all equal to 0. (D-14)

#### Scenario: AC-21: Empty order with a valid coupon
- **WHEN** a Gold customer submits an order with `items = []` and a typed valid whole-order percent coupon of 10
- **THEN** subtotal is 0, tier discount is 0, coupon discount is 0, shipping is 0, and total is 0
