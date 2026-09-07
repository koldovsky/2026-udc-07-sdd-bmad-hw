## MODIFIED Requirements

Conventions are unchanged from the `add-discount-engine` change: amounts are
whole kopecks, the order ships to `"UA"` with non-digital items so shipping is
4 900, `now` is `new Date("2026-09-05T12:00:00Z")` unless a scenario names it, a
coupon called "valid" expires `2027-01-01T00:00:00Z`, and scenario ids are the
acceptance-criterion ids of `docs/spec/pricing-discounts.md`.

### Requirement: Every discount is a whole number of kopecks, rounded down

The system SHALL round each discount down to a whole kopeck and SHALL round the
total not at all. Division by 100 SHALL be integer division, and no
floating-point arithmetic SHALL be used for amounts. A `value` that is not a
finite integer SHALL produce a discount of 0. A percentage `value` of 100 or more
SHALL produce a discount of exactly `base`, and SHALL do so without forming the
product `base × value`, so that no `value` accepted by the finite-integer test
can put a non-finite number into the breakdown. Every numeric field of the
breakdown SHALL satisfy `Number.isSafeInteger` for any input within the stated
input bounds — a subtotal of at most 100 000 000 000, a percentage `value` of at
most 10 000 and a fixed `value` of at most 100 000 000 000.

#### Scenario: AC-13 — a fractional discount rounds down

- **WHEN** a customer with no tier orders one item of 1 234 and types a 7% coupon
- **THEN** 7% of 1 234 is 86.38, the discount is 86, and the total is 6 048

#### Scenario: AC-18 — a discount below one kopeck

- **WHEN** a customer with no tier orders one item of 10 kopecks and types a
  valid 7% coupon
- **THEN** 7% of 10 is 0.7, the discount is 0, the code is rejected with reason
  `too-small` and not `no-effect` because the scope is the remainder of 10,
  `appliedCouponCode` is `null`, and the total is 4 910

#### Scenario: AC-38 — a fractional fixed value gives no discount

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `kind: "fixed"` and `value: 1234.5`
- **THEN** the coupon discount is 0 and not 1 234.5, all seven breakdown fields
  stay whole kopecks, the code is rejected with reason `too-small`, and the total
  is 104 900

#### Scenario: AC-43 — the upper bound stays within safe integers

- **WHEN** a Gold customer orders one item of 100 000 000 000 kopecks and types a
  coupon with `kind: "percent"` and `value: 10 000`
- **THEN** the tier discount is 10 000 000 000, the coupon discount is capped by
  its base at 90 000 000 000, the total is 4 900, and all five numeric breakdown
  fields satisfy `Number.isSafeInteger`

#### Scenario: AC-53 — a percentage far past the bound is capped, not broken

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `kind: "percent"` and `value: 1 000 000`
- **THEN** the coupon discount is capped at its base of 100 000,
  `appliedCouponCode` is that coupon's code, the total is 4 900, and all five
  numeric breakdown fields satisfy `Number.isSafeInteger`

#### Scenario: AC-62 — an out-of-range percentage cannot make the total NaN

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `kind: "percent"` and `value: Number.MAX_VALUE`, which passes the
  finite-integer test
- **THEN** the coupon discount is its base of 100 000, the total is 4 900, and
  all five numeric breakdown fields satisfy `Number.isSafeInteger` — in
  particular none of them is `NaN`

### Requirement: Exactly one coupon applies

When several distinct codes are typed, the system SHALL apply exactly one — the
one producing the largest discount. Ties SHALL be broken in favour of the code
typed earlier in `order.coupons`. Every other code that reached this stage SHALL
be reported with reason `superseded`. Coupon discounts SHALL NOT be summed. The result
SHALL NOT depend on the order of entries in the catalog when their normalised
codes are unique; where two entries share a normalised code, the first SHALL
win, as required by `Malformed catalog data never raises the total`.

#### Scenario: AC-3 — the larger discount wins

- **WHEN** a customer with no tier orders 100 000 of items and types two valid
  coupons, `SAVE10` at 10% and `MINUS50` for a fixed 5 000
- **THEN** `SAVE10` applies with a discount of 10 000, `MINUS50` is rejected with
  reason `superseded`, and the total is 94 900

#### Scenario: AC-16 — a tie goes to the code typed first

- **WHEN** a customer with no tier orders 100 000 of items and types, in this
  order, `MINUS100` (fixed 10 000) and `SAVE10` (10%), so both would give exactly
  10 000
- **THEN** `MINUS100` applies as the one typed earlier, `SAVE10` is rejected with
  reason `superseded`, and the total is 94 900

#### Scenario: AC-30 — rejections are listed in the order typed

- **WHEN** a customer with no tier orders 100 000 of items and types, in this
  order, `BADCODE` (absent from the catalog), `SAVE10` (10%) and `MINUS50`
  (fixed 5 000)
- **THEN** `SAVE10` applies with a discount of 10 000, the total is 94 900, and
  `rejectedCoupons` holds exactly two entries in this order: `BADCODE` with
  reason `unknown`, then `MINUS50` with reason `superseded` — the order typed,
  not the order the reasons arose in

#### Scenario: AC-55 — two coupons on the same category do not stack

- **WHEN** a customer with no tier orders 40 000 of `fresh` items and 60 000 of
  `standard` items and types, in this order, `FRESH10` (10%, category `fresh`)
  and `FRESH20` (20%, category `fresh`)
- **THEN** both have a base of 40 000, `FRESH20` applies with a discount of
  8 000, `FRESH10` is rejected with reason `superseded`, the `standard` items are
  untouched, and the total is 96 900
