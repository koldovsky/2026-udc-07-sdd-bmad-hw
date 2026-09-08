## Purpose

Calculates the discount an order receives from the customer's loyalty tier
and any coupon codes they typed, and returns a full, auditable price
breakdown built on top of the existing subtotal/shipping calculations.

## ADDED Requirements

### Requirement: Tier and coupon discounts combine additively
The system SHALL combine the customer's loyalty-tier percentage and the
percentage of every valid, order-wide coupon into a single combined
percentage, and SHALL apply that combined percentage exactly once to the
merchandise subtotal.

#### Scenario: AC-1 - tier discount alone
- **WHEN** a Gold customer (10%) places a 1 000 UAH order with no coupons
- **THEN** the merchandise discount is 100 UAH

#### Scenario: AC-2 - tier and coupon percentages add up
- **WHEN** a Gold customer (10%) applies one order-wide 15% coupon to a
  1 000 UAH order
- **THEN** the combined percentage is 25% (10% + 15%, not compounded) and
  the discount is 250 UAH

### Requirement: Discount base excludes shipping
The system SHALL compute every discount against the merchandise subtotal
(`subtotalKopecks`) only. Shipping (`shippingKopecks`) SHALL never be
reduced by a tier or coupon discount, and SHALL be added after the
discounted subtotal is computed.

#### Scenario: AC-11 - shipping cost does not change the discount
- **WHEN** the same 1 000 UAH Gold-tier order is priced once with domestic
  shipping (49 UAH) and once with international shipping (199 UAH)
- **THEN** the merchandise discount is 100 UAH in both cases, and the two
  totals differ only by the shipping difference

### Requirement: All valid coupons apply, order-independent
The system SHALL apply every coupon code the customer typed that passes
validation (not expired, known code, minimum-subtotal met, not a repeat of
an already-applied code). The system SHALL NOT select only the
best-value coupon, and the resulting discount SHALL NOT depend on the
order the codes were typed in.

#### Scenario: Two valid coupons both apply
- **WHEN** a customer types two different valid order-wide percent coupons
- **THEN** both contribute to the combined percentage, regardless of which
  was typed first

### Requirement: Category-restricted coupons discount only their category
A coupon with a `category` SHALL compute its discount against the original
subtotal of line items in that category only, independent of the tier
discount or any other coupon. When multiple valid coupons target the same
category, their percentages SHALL combine additively (same rule as the
order-wide case), capped at 100% of that category's subtotal.

#### Scenario: AC-3 - two coupons on the same category
- **WHEN** a 1 000 UAH order has 400 UAH of `fresh`-category items and two
  valid 10% and 5% coupons both restricted to `category: "fresh"` are
  applied
- **THEN** the combined 15% is taken from the 400 UAH `fresh` subtotal (60
  UAH discount) and the remaining 600 UAH of non-`fresh` items receives no
  discount from these coupons

#### Scenario: Category coupon with no matching items
- **WHEN** a coupon restricted to `category: "fresh"` is applied to an
  order with zero `fresh` items
- **THEN** the coupon is valid but contributes 0 to the discount

### Requirement: Discount amounts round down to whole kopecks
Wherever a percentage is converted into a kopeck amount, the system SHALL
round down (floor) to the nearest whole kopeck. Rounding SHALL happen once
per combined percentage (once for the order-wide combined percentage, and
once per category that has its own coupons) - not once per line item.

#### Scenario: AC-8 - exact half-kopeck rounds down
- **WHEN** a 50% coupon applies to a category subtotal of exactly 101
  kopecks (yielding 50.5 kopecks)
- **THEN** the discount is 50 kopecks, not 51

### Requirement: Minimum-subtotal threshold uses the original subtotal
A coupon's `minSubtotalKopecks` condition SHALL be evaluated against the
order's original subtotal, before any tier or coupon discount is applied.

#### Scenario: AC-5 - below-threshold coupon does not apply
- **WHEN** a coupon requires a 1 000 UAH minimum subtotal and the order's
  original subtotal is 900 UAH
- **THEN** the coupon does not apply, regardless of any other discount on
  the order

### Requirement: Merchandise discount never exceeds merchandise value
The total merchandise discount (tier + all applied coupons) SHALL be capped
at the merchandise subtotal, so the discounted subtotal is never negative.
Shipping SHALL always be charged in full regardless of this cap.

#### Scenario: AC-6 - combined discount larger than the order
- **WHEN** a Gold customer's 10% tier discount plus a 2 000 UAH fixed
  coupon are applied to a 100 UAH order
- **THEN** the discounted subtotal is capped at 0 UAH (not negative), and
  the customer still pays shipping in full

#### Scenario: AC-7 - empty order
- **WHEN** an order has no line items
- **THEN** the discount is 0, shipping is 0 (per existing
  `shippingKopecks` behavior for all-digital/empty orders), and the
  function does not throw

### Requirement: Expired coupons are silently ignored
A coupon whose `expiresAt` is at or before the reference time SHALL
contribute nothing to the discount and SHALL NOT cause the pricing
function to throw an error.

#### Scenario: AC-4 - expired coupon has no effect
- **WHEN** the only coupon typed on an order has already expired relative
  to the reference time
- **THEN** the order is priced as if no coupon had been typed

### Requirement: Unknown coupon codes are silently ignored
A typed coupon code with no matching entry (by exact `code`) in the
supplied coupon catalog SHALL contribute nothing to the discount and SHALL
NOT cause the pricing function to throw an error.

#### Scenario: AC-9 - code not in the catalog
- **WHEN** a customer types a coupon code that does not match any coupon
  in the catalog passed to the pricing function
- **THEN** that code has no effect on the price, the same as an expired
  coupon

### Requirement: Duplicate coupon codes apply once
When the same coupon code appears more than once among the codes the
customer typed, the system SHALL apply it only once (first occurrence).

#### Scenario: AC-10 - same code typed twice
- **WHEN** a valid 10% order-wide coupon code is typed twice on the same
  order
- **THEN** the combined percentage includes that coupon's 10% only once,
  not 20%

### Requirement: Combined percentage is capped at 100%
The combined percentage used for the order-wide discount, and the combined
percentage used for any single category's discount, SHALL each be capped
at 100% before being converted into a kopeck amount.

#### Scenario: Tier plus coupons exceed 100%
- **WHEN** the tier percentage and all applicable coupon percentages for
  the same base sum to more than 100%
- **THEN** the percentage used to compute the discount is capped at 100%

### Requirement: Coupon expiry is checked against an explicit reference time
The pricing function SHALL accept an explicit reference time (defaulting to
the current time when not supplied) and SHALL use only that value to decide
whether a coupon has expired.

#### Scenario: Deterministic expiry check
- **WHEN** the pricing function is called with an explicit reference time
  and a coupon whose `expiresAt` is after that time but before the actual
  current time
- **THEN** the coupon is treated as still valid

### Requirement: Coupon code matching is case-sensitive
The system SHALL match a typed coupon code to a catalog coupon using an
exact, case-sensitive string comparison, with no normalization.

#### Scenario: Different casing does not match
- **WHEN** a customer types `save10` and the catalog contains a coupon
  with code `SAVE10`
- **THEN** the typed code does not match that coupon and has no effect

### Requirement: Price breakdown reports a combined discount, not a per-source split
The pricing function's result SHALL report a single combined merchandise
discount amount and the list of coupon codes that were actually applied.
It SHALL NOT attempt to attribute portions of the combined discount back
to the tier or to individual coupons.

#### Scenario: Breakdown after tier and coupon both apply
- **WHEN** an order's price is computed with both a tier discount and a
  coupon discount applied
- **THEN** the result exposes one combined discount amount and the list of
  applied coupon codes, with no separate tier-only or coupon-only amount
