## Purpose

Provide deterministic loyalty and coupon pricing so checkout can return a
testable merchandise-discount breakdown without changing existing pricing behavior.

## ADDED Requirements

### Requirement: Price breakdown
The system SHALL calculate a `PriceBreakdown` from an `Order`, supplied `Coupon[]`,
and an explicit current timestamp. It SHALL preserve existing subtotal, shipping, and
tier behavior; discounts SHALL apply to merchandise only, and shipping SHALL be added
after discounts.

#### Scenario: AC-1 Loyalty excludes shipping
- **WHEN** a Gold customer orders 100,000 kopecks of standard merchandise with no coupons in `UA`
- **THEN** the tier discount is 10,000, shipping is 4,900, and the total is 94,900 kopecks

### Requirement: Sequential coupon application
The system SHALL apply loyalty first and then every eligible coupon in customer input
order. Discounts SHALL use remaining eligible merchandise value, allow overlapping
coupons, and use the remaining matching-category value for category coupons.

#### Scenario: AC-2 Loyalty and coupon stack sequentially
- **WHEN** a Gold customer orders 100,000 kopecks and enters a 15% coupon in `UA`
- **THEN** loyalty saves 10,000, the coupon saves 13,500 from 90,000, and the total is 81,400 kopecks

#### Scenario: AC-3 Overlapping coupons follow input order
- **WHEN** fresh merchandise is 10,000, standard merchandise is 10,000, and fresh coupons for fixed 1,000 then 20% are entered
- **THEN** both apply in that order for 1,000 and 1,800 kopecks, and the total is 22,100 kopecks

#### Scenario: AC-6 A category coupon uses its remaining category balance
- **WHEN** a Silver customer has fresh merchandise of 6,000, standard merchandise of 4,000, and enters a fresh 10% coupon
- **THEN** loyalty saves 500, the remaining fresh value is 5,700, the coupon saves 570, and the total is 13,830 kopecks

#### Scenario: AC-7 A fixed category coupon is capped and does not spill
- **WHEN** fresh merchandise is 3,000, standard merchandise is 7,000, and a fresh fixed 5,000 coupon is entered
- **THEN** the coupon applies once for 3,000, does not reduce standard merchandise, and the total is 11,900 kopecks

### Requirement: Coupon eligibility and results
The system SHALL return one ordered coupon result per entered code. It SHALL normalize
codes by trimming whitespace and comparing case-insensitively, apply each normalized
code at most once, and return one rejection reason without failing the calculation.
Rejection priority SHALL be `invalid_or_unknown`, `expired`, `minimum_not_met`,
`no_matching_category`, then `duplicate`. A code with multiple matching definitions
or a malformed expiry SHALL be `invalid_or_unknown`; an eligible zero-saving coupon
SHALL be applied.

#### Scenario: AC-4 A normalized code applies once
- **WHEN** a 10% coupon with code `SAVE` is entered as ` save ` followed by `Save` for 10,000 kopecks of merchandise
- **THEN** the first saves 1,000, the second is rejected as `duplicate`, and the total is 13,900 kopecks

#### Scenario: AC-5 Minimum uses the original subtotal
- **WHEN** a Gold customer orders exactly 10,000 kopecks and enters a 10% coupon with `minSubtotalKopecks` of 10,000
- **THEN** the minimum passes before loyalty, loyalty saves 1,000, the coupon saves 900, and the total is 13,000 kopecks

#### Scenario: AC-9 The expiry instant is excluded
- **WHEN** a 10% coupon for 10,000 kopecks expires at the explicit current timestamp
- **THEN** it is rejected as `expired`, saves zero, and the total is 14,900 kopecks

#### Scenario: AC-10 Rejected coupons do not stop valid coupons
- **WHEN** an unknown code is followed by a valid 10% coupon for 10,000 kopecks
- **THEN** the unknown code is rejected as `invalid_or_unknown`, the valid coupon saves 1,000, and the total is 13,900 kopecks

#### Scenario: AC-11 A missing category is a structured rejection
- **WHEN** an order contains only 10,000 kopecks of standard merchandise and a fresh 10% coupon is entered
- **THEN** the coupon is rejected as `no_matching_category`, saves zero, and the total is 14,900 kopecks

#### Scenario: AC-13 Conflicting coupon definitions are invalid
- **WHEN** 10,000 kopecks of merchandise has `SAVE` definitions for 10% and fixed 500, and `SAVE` is entered
- **THEN** the result is `invalid_or_unknown` with zero savings and the total is 14,900 kopecks

#### Scenario: AC-14 A malformed expiry is invalid
- **WHEN** a 10% `SAVE` coupon for 10,000 kopecks has a malformed expiry and is entered
- **THEN** the result is `invalid_or_unknown` with zero savings and the total is 14,900 kopecks

#### Scenario: AC-16 Below-minimum coupons are rejected
- **WHEN** a 10% coupon requiring 10,000 kopecks is entered for 9,999 kopecks of merchandise
- **THEN** the result is `minimum_not_met` with zero savings and the total is 14,899 kopecks

### Requirement: Rounding and boundaries
The system SHALL round each percentage discount once on its complete eligible amount
to the nearest kopeck, with exact halves rounded up. Every discount SHALL be capped
at remaining eligible value, and an empty order SHALL produce a zero-value result.
Supported percentage coupon values SHALL be whole numbers from 0 through 100.

#### Scenario: AC-8 Exact halves round up once per percentage operation
- **WHEN** a 10% coupon is entered for merchandise totaling 15 kopecks in `UA`
- **THEN** its 1.5-kopeck discount rounds to 2 kopecks and the total is 4,913 kopecks

#### Scenario: AC-12 Empty orders stay at zero
- **WHEN** an order has no items and no coupons
- **THEN** subtotal, tier discount, coupon discount, shipping, and total are all zero

#### Scenario: AC-15 A zero-saving coupon is applied
- **WHEN** a 10% coupon is entered for 1 kopeck of merchandise in `UA`
- **THEN** the result is applied with zero savings and the total is 4,901 kopecks
