## MODIFIED Requirements

Conventions are unchanged from the `add-discount-engine` change: amounts are
whole kopecks, the order ships to `"UA"` with non-digital items so shipping is
4 900, `now` is `new Date("2026-09-05T12:00:00Z")` unless a scenario names it, a
coupon called "valid" expires `2027-01-01T00:00:00Z`, and scenario ids are the
acceptance-criterion ids of `docs/spec/pricing-discounts.md`.

### Requirement: Malformed catalog data never raises the total

The system SHALL constrain every coupon discount to the closed range
`[0, base]`, so that no coupon increases the amount due and no coupon gives away
more than the scope it covers. A `value` that is zero or negative, a `value` that
is not a finite integer, and a `kind` that is neither `"percent"` nor `"fixed"`
SHALL each produce a discount of 0. A catalog entry whose `code` is not a string
SHALL normalise to the empty string and SHALL therefore match no typed code,
because typed codes that are empty after normalisation are dropped before the
lookup; such an entry is unreachable rather than fatal. The catalog SHALL NOT
otherwise be validated: the first entry matching a normalised code SHALL be
used. Given argument shapes that match the declared signature, `priceOrder`
SHALL NOT throw.

#### Scenario: AC-12 — a fixed coupon larger than the order

- **WHEN** a customer with no tier orders 30 000 of items and types a fixed
  50 000 coupon
- **THEN** the subtotal is 30 000, the tier discount is 0, the coupon discount is
  capped at 30 000, `appliedCouponCode` is that coupon's code, and the total is
  4 900 — shipping alone, never negative

#### Scenario: AC-25 — a negative value is not a surcharge

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `kind: "fixed"` and `value: -5000`
- **THEN** the coupon discount is 0 and not −5 000, so the total does not grow:
  the code is rejected with reason `too-small`, `appliedCouponCode` is `null`,
  and the total is 104 900

#### Scenario: AC-33 — duplicate catalog codes resolve to the first entry

- **WHEN** the catalog holds two entries with code `SAVE10`, the first at 10% and
  the second at 50%, and a customer with no tier types `SAVE10` on an order of
  100 000
- **THEN** the first entry is used: the discount is 10 000 and the total is
  94 900

#### Scenario: AC-37 — `NaN` never reaches the total

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `kind: "percent"` and `value: NaN`
- **THEN** the coupon discount is 0, the total is 104 900 and is a number rather
  than `NaN`, the code is rejected with reason `too-small`, and
  `appliedCouponCode` is `null`

#### Scenario: AC-60 — `Infinity` does not give the order away

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `kind: "fixed"` and `value: Infinity`
- **THEN** the coupon discount is 0 rather than 100 000, the code is rejected
  with reason `too-small`, `appliedCouponCode` is `null`, the total is 104 900,
  and every numeric field satisfies `Number.isSafeInteger` — an implementation
  testing `Number.isNaN` instead of `Number.isInteger` would cap `Infinity` at
  the base and hand over the whole order

#### Scenario: AC-61 — a non-string catalog code is unreachable, not fatal

- **WHEN** the catalog holds an entry with `code: null` in front of a valid
  `SAVE10` at 10%, and a customer with no tier types `SAVE10` on an order of
  100 000 of `standard` items
- **THEN** no exception is thrown, the corrupt entry matches nothing, `SAVE10`
  applies for a discount of 10 000, and the total is 94 900
- **AND WHEN** the corrupt entry is the only one in the catalog
- **THEN** `SAVE10` is rejected with reason `unknown`, the coupon discount is 0,
  the total is 104 900, and no exception is thrown — an implementation
  normalising `coupon.code` without a type check calls `null.trim()` and takes
  the checkout page down

#### Scenario: AC-42 — an unrecognised coupon kind

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `kind: "bogus"` and `value: 10`
- **THEN** the coupon discount is 0, the code is rejected with reason
  `too-small`, the total is 104 900, and no exception is thrown

#### Scenario: AC-44 — an empty catalog still prices the order

- **WHEN** the catalog is empty and a customer with no tier types `SAVE10` and
  `MINUS50` on an order of 100 000
- **THEN** both codes are rejected with reason `unknown` in the order typed, and
  the total is correct at 104 900
