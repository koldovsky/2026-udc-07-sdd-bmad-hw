## Purpose

Defines how loyalty tier discounts and promo coupons combine into the final price of an order: the discount base, the stacking order, coupon eligibility, the rounding direction, the non-negative floor, and how an expired coupon is reported. Every fork left open by the original feature request is closed here with a number a test can assert.

## ADDED Requirements

### Requirement: Order price breakdown

The system SHALL expose `priceOrder(order: Order, coupons: Coupon[]): PriceBreakdown`, where `coupons` is the catalogue of known coupons and `order.coupons` holds the codes the customer typed.

`PriceBreakdown` SHALL report five whole-kopeck integers:

- `subtotalKopecks` — the items amount **before** any discount, identical to the existing subtotal behaviour.
- `tierDiscountKopecks` — the loyalty tier discount, never negative.
- `couponDiscountKopecks` — the sum of all applied coupon discounts, never negative.
- `shippingKopecks` — the existing shipping fee, never discounted.
- `totalKopecks` — `subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks + shippingKopecks`.

All amounts SHALL remain integer kopecks; no floating-point amount may appear in a returned field. `priceOrder` SHALL NOT mutate `order` or `coupons`.

#### Scenario: AC-1 — gold customer, no coupons

- **WHEN** a gold customer orders a single standard item of 100 000 kopecks (1 000 грн) to UA and types no coupon codes
- **THEN** the breakdown is `subtotalKopecks` 100 000, `tierDiscountKopecks` 10 000 (100 грн), `couponDiscountKopecks` 0, `shippingKopecks` 4 900, `totalKopecks` 94 900 — 900 грн for the goods plus shipping

#### Scenario: AC-5 — empty order

- **WHEN** a gold customer submits an order with no items and types a valid 10% coupon code
- **THEN** every field of the breakdown is 0: no tier discount, no coupon discount, and no error

### Requirement: Loyalty tier discount applies to the items amount only

The tier discount SHALL be the tier percentage (silver 5%, gold 10%, none 0%) taken from the items amount only; shipping SHALL never be part of any discount base.

Exactly one tier SHALL apply per order — the customer's own tier. Tier percentages SHALL NOT be summed, and where a choice between tiers ever exists the most favourable single tier SHALL be used.

The tier discount SHALL be computed per category bucket (see "Discounts are tracked per category bucket") and reported as the sum of those per-bucket amounts.

#### Scenario: AC-1 — gold is 10%, not 5% + 10%

- **WHEN** a gold customer orders 100 000 kopecks of standard items
- **THEN** the tier discount is 10 000 kopecks, not 15 000

#### Scenario: AC-1 — shipping is outside the discount base

- **WHEN** a gold customer orders 100 000 kopecks of standard items to UA, where shipping is 4 900 kopecks
- **THEN** the tier discount is 10 000 kopecks (10% of 100 000), not 10 490 (10% of 104 900), and `shippingKopecks` is reported in full as 4 900

### Requirement: Every discount amount is rounded up

Percentage discounts SHALL be rounded **up** to whole kopecks, and the rounding SHALL happen at each discount step as that step is computed — first the tier discount, then each coupon in turn — never once at the end. A discount therefore never loses a fraction of a kopeck.

#### Scenario: AC-9 — rounding up happens at each step

- **WHEN** a silver customer orders a single standard item of 3 333 kopecks to UA and types a 10% order-wide coupon
- **THEN** the tier discount is 167 kopecks (5% of 3 333 = 166.65, rounded up), the coupon discount is 317 kopecks (10% of the remaining 3 166 = 316.6, rounded up), and `totalKopecks` is 7 749 (2 849 for the goods plus 4 900 shipping)

### Requirement: Typed coupon codes are resolved against the catalogue

Codes SHALL be taken from `order.coupons` in the order the customer typed them and matched to the `coupons` catalogue by exact code.

- A repeated code SHALL apply at most once; the first occurrence keeps its position in the typed order.
- A typed code with no match in the catalogue SHALL be ignored, without error, and the remaining codes SHALL still apply.
- Where the catalogue holds more than one entry for a code, the first entry SHALL be used.

#### Scenario: AC-10 — the same code typed twice

- **WHEN** a customer with no tier orders 10 000 kopecks of standard items and types the code `SAVE10` (10%, order-wide) twice
- **THEN** the coupon discount is 1 000 kopecks, not 1 900

#### Scenario: AC-11 — a code that is not in the catalogue

- **WHEN** a customer types `NOPE`, which no catalogue entry matches, followed by `SAVE10` (10%, order-wide) on 10 000 kopecks of standard items
- **THEN** `NOPE` is ignored with no error and the coupon discount is 1 000 kopecks

### Requirement: An expired coupon is rejected loudly

A coupon SHALL be treated as expired when the moment of the call is at or after its `expiresAt` instant.

When a typed code resolves to an expired coupon, `priceOrder` SHALL throw `ExpiredCouponError` — an exported error class carrying the offending `code` and naming that code in its message — and SHALL NOT return a breakdown. Expiry SHALL be checked before any eligibility or amount check, so an expired coupon fails loudly even when it would not have applied. Codes SHALL be checked in typed order, so the first expired code is the one reported.

#### Scenario: AC-2 — an expired coupon stops the calculation

- **WHEN** a customer orders 10 000 kopecks of standard items and types `OLD`, a 10% coupon whose `expiresAt` has passed
- **THEN** `priceOrder` throws `ExpiredCouponError` with `code` `OLD`, and no price breakdown is produced

#### Scenario: AC-2 — expiry outranks eligibility

- **WHEN** the expired coupon `OLD` also carries a `minSubtotalKopecks` the order does not reach
- **THEN** `priceOrder` still throws `ExpiredCouponError` rather than quietly skipping the coupon

### Requirement: Coupons stack sequentially on top of the tier discount

Coupon discounts SHALL be applied after the tier discount and computed from what remains, not from the original subtotal, and tier and coupon percentages SHALL NOT be summed into one percentage. Each coupon SHALL be applied in typed order and SHALL see the amounts left by every discount before it.

- A `percent` coupon SHALL take its percentage of the amount remaining in its scope.
- A `fixed` coupon SHALL take its `value`, which is already whole kopecks.

#### Scenario: AC-3 — two coupons on the same category

- **WHEN** a customer with no tier orders 50 000 kopecks of `fresh` items and 50 000 of `standard` items to UA and types `FRESH20` (20%, `fresh`) then `FRESH10` (10%, `fresh`)
- **THEN** both coupons apply: 10 000 kopecks for the first and 4 000 for the second (10% of the 40 000 remaining in `fresh`, not of the original 50 000), for a coupon discount of 14 000 and a total of 90 900

### Requirement: Discounts are tracked per category bucket

The items amount SHALL be tracked as one bucket per category present in the order, each starting at that category's items amount. Every discount SHALL reduce the buckets it applies to, and the remaining items amount SHALL be the sum of the buckets.

- A discount that is not scoped to a category SHALL apply across all buckets: a percentage SHALL be taken from each bucket separately, and a fixed amount SHALL be allocated as described in "Allocating an order-wide fixed discount".
- A discount scoped to a category SHALL reduce only that bucket.

#### Scenario: AC-13 — the tier discount reaches every category

- **WHEN** a gold customer orders 60 000 kopecks of `standard` items and 40 000 of `fresh` items to UA and types `FRESH25` (25%, `fresh`)
- **THEN** the tier discount is 10 000 kopecks (6 000 from `standard`, 4 000 from `fresh`) and the coupon takes 9 000 — 25% of the 36 000 left in `fresh` after the tier discount, not 25% of the original 40 000

### Requirement: A category coupon is computed from that category's amount

A coupon carrying a `category` SHALL compute its discount from that category's remaining amount, never from the whole order.

A category coupon SHALL have no effect when the order contains no items of that category; this is not an error.

#### Scenario: AC-7 — a category coupon does not reach other categories

- **WHEN** a customer with no tier orders 60 000 kopecks of `standard` items and 40 000 of `fresh` items to UA and types `FRESH25` (25%, `fresh`)
- **THEN** the coupon discount is 10 000 kopecks (25% of the 40 000 in `fresh`), not 25 000 (25% of the whole 100 000 order)

### Requirement: Minimum subtotal is checked after earlier discounts

When a coupon carries `minSubtotalKopecks`, it SHALL be compared against the **order-wide** items amount remaining at the moment that coupon is reached — that is, after the tier discount and after every coupon before it — and not against the original subtotal or a single category's amount.

A coupon whose threshold is not met SHALL be skipped silently: no error, and the coupons after it SHALL still apply.

#### Scenario: AC-6 — the threshold is missed only because of earlier discounts

- **WHEN** a gold customer orders 100 000 kopecks of standard items and types `VIP` (10%, `minSubtotalKopecks` 95 000)
- **THEN** `VIP` is skipped without error, because the remaining amount after the 10 000 tier discount is 90 000, below the 95 000 threshold — the coupon discount is 0 and the total is 94 900

#### Scenario: AC-8 — a category coupon checks the order-wide remaining amount

- **WHEN** a gold customer orders 60 000 kopecks of `standard` items and 40 000 of `fresh` items to UA and types `FRESH25` (25%, `fresh`, `minSubtotalKopecks` 85 000)
- **THEN** the threshold is compared against the 90 000 remaining order-wide after the tier discount, not against the 36 000 left in `fresh`, so the coupon applies and takes 9 000 kopecks

### Requirement: Discounts never take the items amount below zero

The items amount SHALL NOT fall below zero, and the total SHALL NOT fall below the shipping fee — a discount may never eat into shipping or produce a refund.

A coupon whose discount would exceed the amount available in its scope SHALL be skipped **whole**: it contributes 0, it is not trimmed to fit, and neither the tier discount nor any other coupon is affected by it.

#### Scenario: AC-4 — a fixed coupon larger than the order

- **WHEN** a customer with no tier orders 5 000 kopecks of standard items to UA and types `BIG` (fixed 10 000) then `SMALL` (fixed 3 000)
- **THEN** `BIG` is skipped entirely, `SMALL` still applies, the coupon discount is 3 000 and the total is 6 900 — 2 000 for the goods plus 4 900 shipping, never a negative amount

### Requirement: Allocating an order-wide fixed discount

A `fixed` coupon that is not scoped to a category SHALL be allocated across the category buckets in proportion to their current amounts, so that later category coupons see a deterministic remaining amount.

Each bucket SHALL first receive its proportional share rounded **down**; the kopecks left over SHALL then be handed out one at a time to the buckets in descending order of their amount before this step, with ties broken in the order `standard`, `fresh`, `digital`, and never beyond a bucket's own amount. The allocated amounts SHALL sum exactly to the coupon's discount.

#### Scenario: AC-12 — a later category coupon sees the reduced bucket

- **WHEN** a customer with no tier orders 60 000 kopecks of `standard` items and 40 000 of `fresh` items to UA and types `CASH` (fixed 10 001) then `FRESH50` (50%, `fresh`)
- **THEN** `CASH` takes 6 001 kopecks from `standard` (6 000 proportional plus the leftover kopeck, `standard` being the larger bucket) and 4 000 from `fresh`, `FRESH50` then takes 18 000 (50% of the 36 000 left in `fresh`), the coupon discount is 28 001 and the total is 76 899
