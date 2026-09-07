# pricing-discounts Specification

## Purpose

Рахує суму замовлення до сплати: знижка за рівнем лояльності і всі валідні введені промокоди в цілих копійках, без відʼємної вартості товарів і без знижки на доставку.

Джерело правди для чисел і порядку кроків: `docs/spec/pricing-discounts.md` (agreed). Цей файл — дельта для OpenSpec, не нове рішення розвилок.

## Requirements

### Requirement: Loyalty tier reduces merchandise only

The system MUST apply the customer tier percentage (none 0, silver 5, gold 10, via existing `tierPercent`) to merchandise line remainders only. Shipping MUST be taken from existing `shippingKopecks` after all discounts and MUST NOT be reduced. The returned breakdown MUST expose integer fields `subtotalKopecks`, `tierDiscountKopecks`, `couponDiscountKopecks`, `shippingKopecks`, and `totalKopecks`.

#### Scenario: AC-1 Gold order without coupons

- **WHEN** an order has one `standard` item of 100000 kopecks, `customerTier` is `gold`, `coupons` is empty, country is `UA`
- **THEN** `subtotalKopecks` is 100000, `tierDiscountKopecks` is 10000, `couponDiscountKopecks` is 0, `shippingKopecks` is 4900, `totalKopecks` is 94900

### Requirement: Percent discounts round half-up per line

Each percent discount MUST be computed per line with integer arithmetic only: `d = floor((remaining * percent + 50) / 100)`, then `d = min(d, remaining)`. The system MUST NOT use floating-point arithmetic for money. Aggregate-then-round MUST NOT be used: two 15-kopeck lines at Gold MUST yield 4, not 3.

#### Scenario: AC-5 half-kopeck rounds up

- **WHEN** an order has one `standard` item with `unitPriceKopecks` 15 and `quantity` 1, `customerTier` is `gold`, no coupons
- **THEN** `tierDiscountKopecks` is 2, `couponDiscountKopecks` is 0, `shippingKopecks` is 4900, `totalKopecks` is 4913

#### Scenario: AC-10 two lines round separately

- **WHEN** an order has two `standard` lines of 15 kopecks each, `customerTier` is `gold`, no coupons
- **THEN** `tierDiscountKopecks` is 4, `shippingKopecks` is 4900, `totalKopecks` is 4926

### Requirement: Coupons apply sequentially after the tier

After the tier, the system MUST apply every valid coupon in `order.coupons` typing order to the current line remainders. A later percent coupon MUST use the remainder after previous discounts, not the original price. Additive stacking (sum of percents on the original subtotal) MUST NOT be used.

#### Scenario: AC-9 sequential Gold then 15 percent

- **WHEN** an order has one item of 100000 kopecks, `customerTier` is `gold`, and a valid unscoped 15 percent coupon is applied
- **THEN** `tierDiscountKopecks` is 10000, `couponDiscountKopecks` is 13500, `shippingKopecks` is 4900, `totalKopecks` is 81400

#### Scenario: AC-3 two category coupons on the same category

- **WHEN** an order has one `fresh` item of 100000 kopecks, `customerTier` is `none`, and valid coupons `FRESH10` then `FRESH5` (10 percent and 5 percent, `fresh` only, no minimum) are entered
- **THEN** `couponDiscountKopecks` is 14500, `tierDiscountKopecks` is 0, `shippingKopecks` is 4900, `totalKopecks` is 90400

### Requirement: Category coupons use remaining matching lines

A category-scoped coupon MUST apply only to the current remainders of lines whose `category` matches. It MUST NOT use the whole-order subtotal or the pre-discount category sum.

#### Scenario: AC-7 percent coupon on fresh only

- **WHEN** an order has `fresh` 60000 plus `standard` 40000, `customerTier` is `none`, and one valid 20 percent coupon scoped to `fresh` is applied
- **THEN** `couponDiscountKopecks` is 12000, `tierDiscountKopecks` is 0, `shippingKopecks` is 4900, `totalKopecks` is 92900

### Requirement: Minimum subtotal is checked on the original merchandise

When `minSubtotalKopecks` is set, the coupon MUST apply only if the original merchandise subtotal (before any discounts) is greater than or equal to that threshold. The threshold MUST NOT be compared to the post-tier remainder and MUST NOT be narrowed to a category sum. If the field is absent, there is no threshold.

#### Scenario: AC-8 threshold met on original not post-tier

- **WHEN** an order has one item of 60000 kopecks, `customerTier` is `gold`, and a valid unscoped 10 percent coupon has `minSubtotalKopecks` 56000
- **THEN** the coupon is applied; `tierDiscountKopecks` is 6000, `couponDiscountKopecks` is 5400, `shippingKopecks` is 4900, `totalKopecks` is 53500

#### Scenario: AC-11 threshold not met

- **WHEN** an order has one item of 40000 kopecks, `customerTier` is `none`, and a 10 percent coupon has `minSubtotalKopecks` 50000
- **THEN** the coupon is not applied; `couponDiscountKopecks` is 0, `tierDiscountKopecks` is 0, `shippingKopecks` is 4900, `totalKopecks` is 44900

### Requirement: Invalid coupons are skipped silently

The pricing operation MUST NOT throw for business-invalid coupons. Expired, unknown, unparseable `expiresAt` or now instant, unsupported `kind`, non-integer or out-of-range percent (not in 0–100), and negative fixed values MUST contribute 0. Other valid coupons and the tier MUST still apply. Expiry: the coupon is valid only when both timestamps parse to finite times and the provided now instant is strictly before `expiresAt` (equal is expired). The now instant MUST be an input, not the machine clock.

#### Scenario: AC-2 expired coupon does not apply

- **WHEN** an order has one item of 100000 kopecks, `customerTier` is `gold`, now is `2026-09-06T12:00:00.000Z`, and code `OLD20` is a 20 percent coupon with `expiresAt` `2026-09-01T00:00:00.000Z`
- **THEN** the operation does not throw, `tierDiscountKopecks` is 10000, `couponDiscountKopecks` is 0, `totalKopecks` is 94900

#### Scenario: AC-12 duplicate and unknown codes

- **WHEN** an order has one item of 100000 kopecks, `customerTier` is `none`, `coupons` is `["SAVE10", "SAVE10", "UNKNOWN"]`, and the catalog contains only a valid unscoped 10 percent `SAVE10`
- **THEN** `SAVE10` is applied once, `UNKNOWN` is skipped, `couponDiscountKopecks` is 10000, `totalKopecks` is 94900

### Requirement: Merchandise after discounts is never negative

A line remainder MUST NOT go below 0. A fixed coupon larger than remaining eligible merchandise MUST consume only the remainder. `totalKopecks` MUST equal the sum of remainders plus shipping and MUST be at least `shippingKopecks`.

#### Scenario: AC-4 fixed coupon larger than merchandise

- **WHEN** an order has one `standard` item of 20000 kopecks, `customerTier` is `none`, and a valid fixed coupon `BIG500` has value 50000
- **THEN** `couponDiscountKopecks` is 20000, `tierDiscountKopecks` is 0, `shippingKopecks` is 4900, `totalKopecks` is 4900

### Requirement: Empty order uses existing shipping behaviour

An order with no lines MUST return zero merchandise and zero discounts. Shipping MUST be whatever the existing `shippingKopecks` function returns (0 for an empty item list). The operation MUST NOT throw even if coupon codes are present.

#### Scenario: AC-6 empty gold order

- **WHEN** an order has `items` `[]`, `customerTier` is `gold`, country is `UA`, and any codes are present in `coupons`
- **THEN** `subtotalKopecks` is 0, `tierDiscountKopecks` is 0, `couponDiscountKopecks` is 0, `shippingKopecks` is 0, `totalKopecks` is 0, and the operation does not throw
