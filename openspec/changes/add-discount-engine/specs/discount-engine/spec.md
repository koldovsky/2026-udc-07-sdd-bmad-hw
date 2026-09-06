## Purpose

The discount-engine capability prices a checkout order under the customer's
loyalty tier and the promo codes they typed, returning a deterministic,
integer-kopeck breakdown so the same cart and codes always resolve to the same
amount due. Full decision rationale lives in `docs/spec/pricing-discounts.md`
(decisions D-1..D-21); scenario names below carry the matching `AC-N` ids.

## ADDED Requirements

### Requirement: Loyalty tier discount is applied first on the goods subtotal

The engine SHALL reduce the order by the loyalty-tier percentage
(`tierPercent`) before any promo code, computing it as
`round(subtotalKopecks * tierPercent / 100)` against the pre-discount goods
subtotal only. A tier of `none` SHALL produce a tier discount of 0.

#### Scenario: AC-1 gold tier, no coupons

- **WHEN** a 100 000-kopeck single-line `standard` order is priced for a `gold` customer with no coupons, country `UA`
- **THEN** `tierDiscountKopecks` is 10 000, `couponDiscountKopecks` is 0, `shippingKopecks` is 4 900, `totalKopecks` is 94 900, and `appliedCoupons` is empty

#### Scenario: AC-2 silver tier, no coupons

- **WHEN** the same order is priced for a `silver` customer
- **THEN** `tierDiscountKopecks` is 5 000 and `totalKopecks` is 99 900

#### Scenario: AC-3 no tier, no coupons

- **WHEN** the same order is priced for a `none` customer with no coupons
- **THEN** `tierDiscountKopecks` is 0, `couponDiscountKopecks` is 0, and `totalKopecks` is 104 900

### Requirement: Promo codes stack sequentially after the tier in typed order

The engine SHALL apply each accepted promo code to the amount remaining after
the tier discount and all previously applied codes, in the exact order of
`order.coupons`. Percentages SHALL NOT be summed.

#### Scenario: AC-4 percent coupon stacks on the post-tier remainder

- **WHEN** a 100 000-kopeck order for a `gold` customer has one valid coupon `AUTUMN15` (percent 15, no category, no minimum)
- **THEN** the tier removes 10 000 (remainder 90 000), the coupon removes `round(90 000 * 15 / 100)` = 13 500, `totalKopecks` is 81 400, and `appliedCoupons` is `["AUTUMN15"]`

#### Scenario: AC-8 typed order changes the result for mixed coupon kinds

- **WHEN** a 100 000-kopeck order with `none` tier has an order-level percent coupon `P10` and an order-level fixed coupon `F200` (value 20 000)
- **THEN** `["P10","F200"]` yields `couponDiscountKopecks` 30 000 and `totalKopecks` 74 900, while `["F200","P10"]` yields `couponDiscountKopecks` 28 000 and `totalKopecks` 76 900

### Requirement: Fixed-amount promo codes discount whole kopecks

The engine SHALL treat a `fixed` coupon's `value` as whole kopecks and apply a
discount of `min(value, base, remaining)`, never more than what is left to
discount. No rounding is performed for fixed coupons.

#### Scenario: AC-5 fixed coupon on an order-level base

- **WHEN** a 100 000-kopeck order with `none` tier has a valid fixed coupon `MINUS200` (value 20 000)
- **THEN** `couponDiscountKopecks` is 20 000, `totalKopecks` is 84 900, and `appliedCoupons` is `["MINUS200"]`

### Requirement: Category-scoped promo codes use that category's line-sum as base

When a coupon has `category` set, the engine SHALL compute its discount against
the sum of `lineTotalKopecks` for items in that category, unreduced by the tier
discount or other coupons, and SHALL cap the result so the running remainder
never goes below 0.

#### Scenario: AC-6 two category coupons on different categories both apply

- **WHEN** an order of `[standard 100 000, fresh 50 000]` with `none` tier has coupons `["STD10","FRESH50"]` (percent 10 on `standard`, percent 50 on `fresh`)
- **THEN** `STD10` removes 10 000, `FRESH50` removes 25 000, `couponDiscountKopecks` is 35 000, `totalKopecks` is 119 900, and `appliedCoupons` is `["STD10","FRESH50"]`

#### Scenario: AC-16 category base is not reduced by the tier discount

- **WHEN** an order of `[standard 100 000, fresh 40 000]` for a `gold` customer has coupon `FRESH25` (percent 25 on `fresh`)
- **THEN** the tier removes `round(140 000 * 10 / 100)` = 14 000, the coupon removes `round(40 000 * 25 / 100)` = 10 000 (from the fresh line-sum, not the 126 000 remainder), and `totalKopecks` is 120 900

### Requirement: At most one coupon discounts any given category

Once a coupon has produced a discount greater than 0 for a category, the engine
SHALL skip any later coupon targeting that same category.

#### Scenario: AC-7 second coupon on the same category is ignored

- **WHEN** a 100 000-kopeck `standard` order with `none` tier has coupons `["STD10","STD25"]`, both scoped to `standard`
- **THEN** only `STD10` applies (discount 10 000), `couponDiscountKopecks` is 10 000, `totalKopecks` is 94 900, and `appliedCoupons` is `["STD10"]`

### Requirement: Minimum-subtotal gate is checked against the pre-discount subtotal

When a coupon has `minSubtotalKopecks`, the engine SHALL accept it only if the
raw `subtotalKopecks(order)` — before the tier and any coupon — is greater than
or equal to that threshold.

#### Scenario: AC-15a threshold not met, coupon rejected

- **WHEN** a 40 000-kopeck order for a `gold` customer has coupon `BIG50` (percent 50, `minSubtotalKopecks` 50 000)
- **THEN** the coupon is rejected, `tierDiscountKopecks` is 4 000, `couponDiscountKopecks` is 0, `totalKopecks` is 40 900, and `appliedCoupons` is empty

#### Scenario: AC-15b threshold met on the raw subtotal even though the post-tier amount is lower

- **WHEN** a 50 000-kopeck order for a `gold` customer has the same `BIG50` coupon
- **THEN** the coupon is accepted, the tier removes 5 000 (remainder 45 000), the coupon removes `round(45 000 * 50 / 100)` = 22 500, and `totalKopecks` is 27 400

### Requirement: Expired, unknown and duplicate codes are silently skipped

The engine SHALL never throw for a code it cannot honour. A code whose coupon
has `now >= expiresAt` or an unparseable `expiresAt`, a code absent from the
catalog, and any repeat of a code already seen in `order.coupons` SHALL be
ignored; the rest of the order prices normally and the skipped code does not
appear in `appliedCoupons`. `now` is a parameter defaulting to the current time.

#### Scenario: AC-12 expired coupon is ignored

- **WHEN** a 100 000-kopeck order for a `silver` customer has coupon `OLD20` with `expiresAt` in the past
- **THEN** no exception is raised, `tierDiscountKopecks` is 5 000, `couponDiscountKopecks` is 0, `totalKopecks` is 99 900, and `appliedCoupons` is empty

#### Scenario: AC-13 unknown code is ignored

- **WHEN** a 100 000-kopeck order with `none` tier lists a code `NOPE` that is not in the catalog
- **THEN** no exception is raised, `couponDiscountKopecks` is 0, `totalKopecks` is 104 900, and `appliedCoupons` is empty

#### Scenario: AC-14 duplicate code counts once

- **WHEN** a 100 000-kopeck order with `none` tier lists `["AUTUMN15","AUTUMN15"]`
- **THEN** `AUTUMN15` is applied once, `couponDiscountKopecks` is 15 000, `totalKopecks` is 89 900, and `appliedCoupons` is `["AUTUMN15"]`

#### Scenario: AC-22 code matching is exact and case-sensitive

- **WHEN** the catalog holds `AUTUMN15` and a 100 000-kopeck order with `none` tier lists `["autumn15"]`
- **THEN** the codes do not match, `couponDiscountKopecks` is 0, `totalKopecks` is 104 900, and `appliedCoupons` is empty

### Requirement: Total is floored at zero and shipping is never discounted

The discounted goods amount SHALL be floored at 0; `totalKopecks` SHALL equal
`max(0, subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks) +
shippingKopecks`. `shippingKopecks` SHALL equal `shippingKopecks(order)`
unchanged.

#### Scenario: AC-9 discount larger than the goods total

- **WHEN** a 10 000-kopeck `standard` order with `none` tier has a fixed coupon `MINUS500` (value 50 000)
- **THEN** `couponDiscountKopecks` is capped at 10 000, the discounted goods amount is 0, `totalKopecks` is 4 900 (shipping only), and `appliedCoupons` is `["MINUS500"]`

#### Scenario: AC-17 all-digital order waives shipping, discounts still apply to goods

- **WHEN** a single-line `digital` order of 100 000 is priced for a `gold` customer with no coupons
- **THEN** `shippingKopecks` is 0, `tierDiscountKopecks` is 10 000, and `totalKopecks` is 90 000

#### Scenario: AC-18 international shipping is added at full rate on top of discounted goods

- **WHEN** a 100 000-kopeck `standard` order to country `PL` for a `gold` customer has coupon `AUTUMN15` (percent 15)
- **THEN** goods are reduced to 76 500, shipping 19 900 is added undiscounted, and `totalKopecks` is 96 400

### Requirement: Rounding is half-up at each application step

Every percentage discount SHALL be `Math.round(base * pct / 100)` — rounded to
whole kopecks, half away from zero, at the step it is applied. No fractional
kopeck value SHALL survive a step.

#### Scenario: AC-11 half-kopeck rounds up

- **WHEN** a single-line order of `unitPriceKopecks` 1 005, `quantity` 1, `none` tier, has coupon `HALF50` (percent 50)
- **THEN** the coupon discount is `round(1 005 * 50 / 100)` = `round(502.5)` = 503, and `totalKopecks` is `502 + 4 900` = 5 402

### Requirement: An empty order prices to zero without error

The engine SHALL handle an order with no items: subtotal 0, both discounts 0,
shipping per `shippingKopecks(order)`, total 0, `appliedCoupons` empty, and no
exception.

#### Scenario: AC-10 empty order with a tier and a coupon

- **WHEN** an order with `items: []` is priced for a `gold` customer with coupon `AUTUMN15`
- **THEN** `subtotalKopecks` is 0, `tierDiscountKopecks` is 0, `couponDiscountKopecks` is 0, `shippingKopecks` is 0, `totalKopecks` is 0, and `appliedCoupons` is empty

### Requirement: Out-of-range percent values are clamped defensively

The engine SHALL clamp a percent coupon's `value` to `[0, 100]` and treat a
non-finite or non-positive value as 0. It SHALL NOT otherwise validate or
report malformed catalog data.

#### Scenario: AC-19 percent value above 100 is treated as 100

- **WHEN** a 100 000-kopeck order with `none` tier has a percent coupon `WILD150` with `value` 150
- **THEN** the discount is `round(100 000 * 100 / 100)` capped at the remainder = 100 000, `totalKopecks` is 4 900, and `appliedCoupons` is `["WILD150"]`

#### Scenario: AC-20 non-positive percent value yields no discount

- **WHEN** a 100 000-kopeck order with `none` tier has a percent coupon `ZERO` with `value` 0
- **THEN** `couponDiscountKopecks` is 0, `totalKopecks` is 104 900, and `appliedCoupons` is empty

### Requirement: A category coupon with no matching items is a no-op

When a coupon's `category` has no items in the order, the engine SHALL skip it
without error, SHALL NOT list it in `appliedCoupons`, and SHALL NOT consume that
category's one-coupon slot.

#### Scenario: AC-21 fresh coupon on a cart with no fresh items

- **WHEN** a 100 000-kopeck `standard`-only order with `none` tier has a coupon `FRESH10` scoped to `fresh`
- **THEN** no exception is raised, `couponDiscountKopecks` is 0, `totalKopecks` is 104 900, and `appliedCoupons` is empty

### Requirement: priceOrder returns a complete PriceBreakdown

`priceOrder` SHALL return an object with `subtotalKopecks`,
`tierDiscountKopecks`, `couponDiscountKopecks`, `shippingKopecks`,
`totalKopecks` (all integers) and `appliedCoupons` (a string array in
application order).

#### Scenario: breakdown fields are populated

- **WHEN** any order is priced
- **THEN** all six fields are present, every kopeck field is an integer, and `appliedCoupons` lists only codes that produced a discount greater than 0
