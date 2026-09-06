## Purpose

Defines how a customer's loyalty tier and a typed coupon code reduce the amount
due on an order: the order the two discounts apply in, what each one is taken
from, which coupon wins when several are typed, how rounding lands, and what the
customer is told about every code that did not apply.

## ADDED Requirements

Conventions used by every scenario below.

- All amounts are whole kopecks. 1 грн = 100 копійок.
- Unless a scenario says otherwise, the order ships to `"UA"` and contains
  non-digital items, so shipping is 4 900.
- Unless a scenario names `now`, it is `new Date("2026-09-05T12:00:00Z")`.
- A coupon called "valid" without a stated `expiresAt` has
  `expiresAt: "2027-01-01T00:00:00Z"`.
- Fields not named in a scenario take their neutral values: both discounts 0,
  `appliedCouponCode` `null`, `rejectedCoupons` empty.
- `idiv(x, 100)` is integer division: `(x - (x % 100)) / 100`.
- Scenario ids are the acceptance-criterion ids of
  `docs/spec/pricing-discounts.md`, which records why each behaviour was chosen.

### Requirement: Tier discount applies to the item subtotal only

The system SHALL compute the loyalty-tier discount as
`idiv(subtotal * tierPercent(order), 100)`, taken from the item subtotal alone.
Shipping SHALL be added after all discounts and SHALL NOT be reduced by any
discount. `priceOrder` SHALL return a `PriceBreakdown` carrying the subtotal,
both discounts, the applied code, the rejected codes, shipping and the total,
and the total SHALL equal
`subtotal - tierDiscount - couponDiscount + shipping`.

#### Scenario: AC-1 — Gold tier, no coupons

- **WHEN** a Gold customer orders 100 000 of items and types no coupon codes
- **THEN** the tier discount is 10 000, the coupon discount is 0, shipping is
  4 900, and the total is 94 900

#### Scenario: AC-7 — shipping is not discounted

- **WHEN** a Gold customer orders 100 000 of items shipped to `"DE"`, where
  shipping is 19 900
- **THEN** the tier discount is 10 000 and is taken from the items only,
  shipping stays 19 900, and the total is 109 900

#### Scenario: AC-14 — empty order

- **WHEN** the order contains no items
- **THEN** the subtotal is 0, both discounts are 0, shipping is 0, and the total
  is 0

#### Scenario: AC-23 — Silver tier with a coupon

- **WHEN** a Silver customer orders 100 000 of items and types a valid 20%
  coupon
- **THEN** the tier discount is 5 000, the coupon discount is 19 000 (20% of the
  95 000 that remain), and the total is 80 900

#### Scenario: AC-34 — fully digital order ships free

- **WHEN** a customer with no tier orders 100 000 of `digital` items only and
  types a valid 10% coupon
- **THEN** the coupon discount is 10 000, shipping is 0, and the total is 90 000

### Requirement: Coupon discount applies after the tier discount

The system SHALL apply the two discounts in sequence, not additively: the tier
discount is taken from the subtotal first, and a coupon without a category is
then taken from what remains. The percentages SHALL NOT be summed.

#### Scenario: AC-2 — 10% tier then 15% coupon

- **WHEN** a Gold customer orders 100 000 of items and types a valid 15% coupon
- **THEN** the tier discount is 10 000, the coupon discount is 13 500 (15% of
  the 90 000 that remain, not 15% of 100 000), and the total is 81 400

#### Scenario: AC-6 — the tier discount does not consume the coupon threshold

- **WHEN** a Gold customer orders 100 000 of items and types a 10% coupon with
  `minSubtotalKopecks: 100 000`
- **THEN** the threshold is compared against the original 100 000 subtotal and
  the coupon applies even though only 90 000 remain after the tier discount: the
  coupon discount is 9 000 and the total is 85 900

### Requirement: Exactly one coupon applies

When several distinct codes are typed, the system SHALL apply exactly one — the
one producing the largest discount. Ties SHALL be broken in favour of the code
typed earlier in `order.coupons`. Every other code that reached this stage SHALL
be reported with reason `superseded`. Coupon discounts SHALL NOT be summed, and
the result SHALL NOT depend on the order of entries in the catalog.

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

### Requirement: A category coupon is limited to its own category

For a coupon whose `category` is set, the system SHALL compute the discount base
as `idiv(categoryTotal(category) * (100 - tierPercent(order)), 100)`, where
`categoryTotal` is the sum of the line totals of items in that category. A
coupon's `category` SHALL be treated as set if and only if it is not `undefined`
— `null` and `""` count as set and select no items. Items whose own `category`
falls outside `"standard" | "fresh" | "digital"` SHALL count towards the
subtotal and towards no category total.

A coupon that survives every check but yields a discount of 0 SHALL NOT be
reported as applied. Its rejection reason SHALL be `no-effect` when the scope it
covers is empty, and `too-small` when the scope is non-empty. That scope is the
category total for a coupon with a category and the post-tier remainder for a
coupon without one.

#### Scenario: AC-5 — percentage of the category, after the tier discount

- **WHEN** a Gold customer orders 40 000 of `fresh` items and 60 000 of
  `standard` items and types a 15% coupon with `category: "fresh"`
- **THEN** the tier discount is 10 000, the coupon base is 36 000 (40 000 less
  the 10% tier), the coupon discount is 5 400, and the total is 89 500

#### Scenario: AC-11 — the category is absent from the cart

- **WHEN** a customer orders 100 000 of `standard` items only and types a valid
  15% coupon with `category: "fresh"`
- **THEN** the coupon discount is 0, `appliedCouponCode` is `null`, the code is
  rejected with reason `no-effect` because the `fresh` total is 0, and the total
  is 104 900

#### Scenario: AC-19 — the base is rounded down once, not twice

- **WHEN** a Gold customer orders 1 111 of `fresh` items and 8 889 of `standard`
  items and types a 50% coupon with `category: "fresh"`
- **THEN** the tier discount is 1 000, the coupon base is
  `idiv(1 111 * 90, 100)` = 999 and not 1 000, the coupon discount is
  `idiv(999 * 50, 100)` = 499 and not 500, and the total is 13 401

#### Scenario: AC-20 — a fixed coupon is capped by its category base

- **WHEN** a Gold customer orders 40 000 of `fresh` items and 60 000 of
  `standard` items and types a fixed 50 000 coupon with `category: "fresh"`
- **THEN** the coupon base is 36 000, the coupon discount is capped at 36 000,
  the tier discount is 10 000, and the total is 58 900

#### Scenario: AC-24 — an out-of-range percentage cannot reach other categories

- **WHEN** a customer with no tier orders 30 000 of `fresh` items and 70 000 of
  `standard` items and types a coupon with `category: "fresh"` and a malformed
  `value: 200`
- **THEN** the coupon base is 30 000, the coupon discount is capped at 30 000 and
  not 60 000, the `standard` items are untouched, and the total is 74 900

#### Scenario: AC-31 — the category is present but rounds to nothing

- **WHEN** a Gold customer orders 1 kopeck of `fresh` items and 9 999 of
  `standard` items and types a 90% coupon with `category: "fresh"`
- **THEN** the tier discount is 1 000, the coupon base is `idiv(1 * 90, 100)` =
  0, the coupon discount is 0, the code is rejected with reason `too-small` and
  not `no-effect` because the cart does hold a `fresh` item, and the total is
  13 900

#### Scenario: AC-36 — Silver, base rounded down once

- **WHEN** a Silver customer orders 10 kopecks of `fresh` items and 9 990 of
  `standard` items and types a 50% coupon with `category: "fresh"`
- **THEN** the tier discount is 500, the coupon base is `idiv(10 * 95, 100)` = 9,
  the coupon discount is `idiv(9 * 50, 100)` = 4, and the total is 14 396

#### Scenario: AC-50 — an item whose category is outside the union

- **WHEN** a customer with no tier orders one item of 100 000 with
  `category: "bogus"` and types a valid 10% coupon with `category: "fresh"`
- **THEN** the subtotal is 100 000, the item counts towards no category total so
  the coupon base is 0, the coupon discount is 0 with reason `no-effect`,
  shipping is 4 900 because the item is not digital, the total is 104 900, and no
  exception is thrown

#### Scenario: AC-51 — a coupon whose category is null

- **WHEN** a customer with no tier orders 100 000 of `standard` items and types a
  valid 10% coupon whose `category` is `null`
- **THEN** the category counts as set: the base is 0, the coupon discount is 0,
  `appliedCouponCode` is `null`, the code is rejected with reason `no-effect`,
  and the total is 104 900 and not 94 900

#### Scenario: AC-52 — a coupon category outside the union

- **WHEN** a customer with no tier orders 30 000 of `fresh` items and 70 000 of
  `standard` items and types a valid 10% coupon with `category: "bogus"`
- **THEN** the base is 0, the coupon discount is 0, the code is rejected with
  reason `no-effect`, and the total is 104 900 — an unrecognised category matches
  neither `fresh` nor the whole cart

### Requirement: Typed codes are normalised, de-duplicated and echoed verbatim

The system SHALL compare a typed code with a catalog code after trimming
surrounding whitespace and upper-casing both. A typed entry that is empty after
trimming, or that is not a string, SHALL be ignored entirely and SHALL NOT
appear in `rejectedCoupons`. Repeats of the same normalised code SHALL be
collapsed to their first occurrence. When several catalog entries share a
normalised code, the first SHALL be used.

Normalisation SHALL affect comparison only. `appliedCouponCode` and the `code`
of a rejected entry SHALL carry the catalog entry's own `code` string verbatim,
except for reason `unknown`, which SHALL carry the customer's typed string
verbatim including surrounding whitespace.

#### Scenario: AC-9 — the same code typed twice

- **WHEN** a customer with no tier orders 100 000 of items and types `SAVE10`
  (10%) twice
- **THEN** the coupon discount is 10 000, applied once, `rejectedCoupons` is
  empty, and the total is 94 900

#### Scenario: AC-10 — case and whitespace are ignored when matching

- **WHEN** a customer with no tier orders 100 000 of items and types
  `"  save10  "` while the catalog holds `SAVE10` at 10%
- **THEN** the code applies, the discount is 10 000, `appliedCouponCode` is
  `SAVE10`, and the total is 94 900

#### Scenario: AC-22 — a blank entry is not a typed code

- **WHEN** a customer with no tier orders 100 000 of items and types two entries,
  `"   "` and `SAVE10` (10%)
- **THEN** the blank entry is ignored entirely, `rejectedCoupons` is empty, the
  coupon discount is 10 000, and the total is 94 900

#### Scenario: AC-28 — the applied code echoes the catalog spelling

- **WHEN** the catalog holds an entry with `code: "save10"` at 10% and a customer
  with no tier types `SAVE10` on an order of 100 000
- **THEN** the code applies, the discount is 10 000, `appliedCouponCode` is
  `save10` — the catalog string verbatim, not `SAVE10` — and the total is 94 900

#### Scenario: AC-29 — an unknown code echoes what was typed

- **WHEN** a customer with no tier orders 100 000 of items and types
  `"  bogus  "`, which is absent from the catalog
- **THEN** the code is rejected with reason `unknown` and a `code` equal to
  `"  bogus  "` including its surrounding whitespace, and the total is 104 900

#### Scenario: AC-41 — a non-string entry is ignored

- **WHEN** `order.coupons` is `[null, "SAVE10"]` on an order of 100 000 with no
  tier and the catalog holds `SAVE10` at 10%
- **THEN** `null` is ignored exactly as a blank entry is, `rejectedCoupons` is
  empty, the discount is 10 000, the total is 94 900, and no exception is thrown

#### Scenario: AC-54 — the first of two catalog entries that differ only by case

- **WHEN** the catalog holds `SAVE10` at 10% followed by `save10` at 50%, and a
  customer with no tier types `save10` on an order of 100 000
- **THEN** the first entry is used: the discount is 10 000, `appliedCouponCode`
  is `SAVE10` (the catalog string verbatim), and the total is 94 900

### Requirement: Expiry is checked against the supplied instant

The system SHALL check expiry against the `now` argument and SHALL NOT read the
clock. A coupon SHALL be rejected with reason `expired` when `now` is at or after
its `expiresAt`, when `expiresAt` is not one of the two accepted forms —
`YYYY-MM-DD`, or a date and time carrying an explicit `Z` or `±HH:MM` offset
within ±14:00 — when its calendar day does not exist, or when `now` is an
`Invalid Date`. A date-only `expiresAt` SHALL mean midnight UTC. Absence from
the catalog SHALL be reported before expiry. One rejected code SHALL NOT block
the others. No malformed value SHALL cause an exception.

#### Scenario: AC-4 — expiry is inclusive of the instant itself

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `expiresAt: "2026-09-01"` while `now` is `2026-09-01T00:00:00Z`
- **THEN** the coupon discount is 0, the code is rejected with reason `expired`,
  the total is 104 900, and no exception is thrown

#### Scenario: AC-17 — out-of-range date parts are rejected before parsing

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `expiresAt: "2026-13-45"`, whose month and day are out of range
- **THEN** the code is rejected with reason `expired`, the coupon discount is 0,
  the total is 104 900, no exception is thrown, and the outcome does not depend
  on how a particular engine would interpret the string

#### Scenario: AC-26 — a time without an explicit offset is rejected

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `expiresAt: "2027-01-01T00:00:00"`, which carries no offset
- **THEN** the code is rejected with reason `expired` even though that date has
  not arrived, the coupon discount is 0, the total is 104 900, and the outcome is
  the same in every server time zone

#### Scenario: AC-27 — an invalid `now` rejects rather than accepts

- **WHEN** a customer with no tier orders 100 000 of items, types a valid
  unexpired `SAVE10` at 10%, and `now` is `new Date("not a date")`
- **THEN** the code is rejected with reason `expired`, the coupon discount is 0,
  the total is 104 900, and no exception is thrown

#### Scenario: AC-32 — one expired code does not block the others

- **WHEN** a customer with no tier orders 100 000 of items and types, in this
  order, `OLD10` with `expiresAt: "2020-01-01"` and `SAVE10` at 10%
- **THEN** `OLD10` is rejected with reason `expired`, `SAVE10` applies with a
  discount of 10 000, and the total is 94 900

#### Scenario: AC-45 — an unknown code is reported as unknown, not expired

- **WHEN** a customer with no tier orders 100 000 of items, types `BOGUS` which
  is absent from the catalog, and `now` is `new Date("not a date")`
- **THEN** the code is rejected with reason `unknown` and not `expired`, because
  catalog lookup precedes the expiry check, and the total is 104 900

#### Scenario: AC-46 — a calendar day that does not exist

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `expiresAt: "2026-02-30"` while `now` is `2026-01-01T00:00:00Z`
- **THEN** the code is rejected with reason `expired` and the total is 104 900 —
  the string is well-formed but names no real day, and it MUST NOT be allowed to
  roll forward into a later valid date

#### Scenario: AC-49 — a real leap day is accepted

- **WHEN** a customer with no tier orders 100 000 of items and types a 10% coupon
  with `expiresAt: "2028-02-29"` while `now` is `2028-01-01T00:00:00Z`
- **THEN** the calendar-day check does not reject it, the code applies, the
  discount is 10 000, and the total is 94 900

#### Scenario: AC-58 — an offset beyond the allowed range

- **WHEN** a customer with no tier orders 100 000 of items and types a coupon
  with `expiresAt: "2027-01-01T00:00:00+14:30"`
- **THEN** the code is rejected with reason `expired`, the coupon discount is 0,
  and the total is 104 900; the same string with an offset of `+14:00` is
  accepted

### Requirement: A minimum-subtotal threshold is compared with the full subtotal

When `minSubtotalKopecks` is present, the system SHALL compare it with the
original item subtotal, before any discount and regardless of the coupon's
category, and SHALL apply the coupon when the subtotal reaches it. A threshold of
0 SHALL count as present and met. A threshold that is not a finite non-negative
integer SHALL be treated as unreachable. A code rejected for the threshold SHALL
carry reason `min-subtotal`, and SHALL carry the threshold in
`minSubtotalKopecks` only when that threshold is a finite non-negative integer;
otherwise the property SHALL be absent from the rejection entry rather than
present and `undefined`. The expiry check SHALL precede the threshold check.

#### Scenario: AC-15 — the threshold is not reached

- **WHEN** a customer with no tier orders 50 000 of items and types a 10% coupon
  with `minSubtotalKopecks: 100 000`
- **THEN** the coupon discount is 0, the code is rejected with reason
  `min-subtotal` and `minSubtotalKopecks` of 100 000, and the total is 54 900

#### Scenario: AC-35 — a category coupon is measured against the whole order

- **WHEN** a customer with no tier orders 30 000 of `fresh` items and 70 000 of
  `standard` items and types a 10% coupon with `category: "fresh"` and
  `minSubtotalKopecks: 100 000`
- **THEN** the threshold is compared with the full subtotal of 100 000 and not
  with the category total of 30 000, so the coupon applies: the base is 30 000,
  the coupon discount is 3 000, and the total is 101 900

#### Scenario: AC-39 — a threshold of zero is a threshold

- **WHEN** a customer with no tier orders 100 000 of items and types a 10% coupon
  with `minSubtotalKopecks: 0`
- **THEN** the threshold counts as present and met, the coupon applies with a
  discount of 10 000, and the total is 94 900

#### Scenario: AC-40 — an unreadable threshold closes the coupon

- **WHEN** a customer with no tier orders 100 000 of items and types a 10% coupon
  with `minSubtotalKopecks: NaN`
- **THEN** the threshold counts as unreachable, the coupon discount is 0, the
  code is rejected with reason `min-subtotal`, the `minSubtotalKopecks` property
  is absent from the rejection entry, and the total is 104 900

#### Scenario: AC-56 — expiry is reported ahead of the threshold

- **WHEN** a customer with no tier orders 50 000 of items and types a 10% coupon
  that both has `expiresAt: "2020-01-01"` and `minSubtotalKopecks: 100 000`
- **THEN** the reason is `expired` and not `min-subtotal`, the
  `minSubtotalKopecks` property is absent from the rejection entry, and the total
  is 54 900

#### Scenario: AC-57 — a negative threshold does not open the coupon

- **WHEN** a customer with no tier orders 100 000 of items and types a 10% coupon
  with `minSubtotalKopecks: -1`
- **THEN** the threshold counts as unreachable, the coupon discount is 0, the
  code is rejected with reason `min-subtotal`, the `minSubtotalKopecks` property
  is absent from the rejection entry, and the total is 104 900

### Requirement: Every discount is a whole number of kopecks, rounded down

The system SHALL round each discount down to a whole kopeck and SHALL round the
total not at all. Division by 100 SHALL be integer division, and no
floating-point arithmetic SHALL be used for amounts. A `value` that is not a
finite integer SHALL produce a discount of 0. Every numeric field of the
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

### Requirement: Malformed catalog data never raises the total

The system SHALL constrain every coupon discount to the closed range
`[0, base]`, so that no coupon increases the amount due and no coupon gives away
more than the scope it covers. A `value` that is zero or negative, a `value` that
is not a finite integer, and a `kind` that is neither `"percent"` nor `"fixed"`
SHALL each produce a discount of 0. The catalog SHALL NOT otherwise be
validated: the first entry matching a normalised code SHALL be used. Given
argument shapes that match the declared signature, `priceOrder` SHALL NOT throw.

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

### Requirement: Every typed code is accounted for

The system SHALL report each unique non-empty typed code exactly once: either in
`appliedCouponCode` or as one entry in `rejectedCoupons`, never both and never
neither. Rejections SHALL be listed in the order the codes were typed. A code
absent from the catalog SHALL carry reason `unknown`.

#### Scenario: AC-8 — a code absent from the catalog

- **WHEN** a customer orders 100 000 of items and types a code that the supplied
  catalog does not contain
- **THEN** the coupon discount is 0, the code is rejected with reason `unknown`
  carrying the typed string, and the total is 104 900

#### Scenario: AC-21 — an empty order still reports the typed code

- **WHEN** the order contains no items and the customer typed a valid `SAVE10` at
  10%
- **THEN** the total is 0, shipping is 0, `appliedCouponCode` is `null`, and
  `SAVE10` is rejected with reason `no-effect` because the scope is the remainder
  of 0

### Requirement: The breakdown holds together for any accepted input

The system SHALL satisfy these invariants for every input meeting the declared
argument shapes.

- **I-1** — the number of rejected codes plus one for an applied code equals the
  number of unique non-empty normalised codes typed.
- **I-2** — `totalKopecks` equals
  `subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks + shippingKopecks`;
  both discounts are non-negative;
  `subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks >= 0`; and
  `totalKopecks >= shippingKopecks >= 0`.
- **I-3** — all five numeric breakdown fields satisfy `Number.isSafeInteger`.
- **I-4** — if any rejection carries reason `superseded`, `appliedCouponCode` is
  not `null`.
- **I-5** — `priceOrder` is pure: two calls with the same arguments return deeply
  equal results, and neither argument is mutated.

#### Scenario: AC-47 — nine typed codes, seven unique, all accounted for

- **WHEN** a customer with no tier orders 100 000 of `standard` items and types
  nine entries in this order — `BOGUS`, `OLD10`, `BIG`, `FRESHONLY`, `ZERO`,
  `SAVE10`, `MINUS50`, `save10`, `"  "` — where `OLD10` has
  `expiresAt: "2020-01-01"`, `BIG` has `minSubtotalKopecks: 200 000`,
  `FRESHONLY` is 10% with `category: "fresh"`, `ZERO` is `kind: "fixed"` with
  `value: 0`, `SAVE10` is 10% and `MINUS50` is a fixed 5 000
- **THEN** `SAVE10` applies with a discount of 10 000, the total is 94 900, and
  `rejectedCoupons` holds exactly six entries in the order typed — `BOGUS`
  (`unknown`), `OLD10` (`expired`), `BIG` (`min-subtotal`, threshold 200 000),
  `FRESHONLY` (`no-effect`), `ZERO` (`too-small`), `MINUS50` (`superseded`) —
  so that six rejected plus one applied equals the seven unique non-empty codes
  typed (I-1), and the `superseded` entry has a winner to name (I-4)

#### Scenario: AC-48 — the same call twice changes nothing

- **WHEN** `priceOrder` is called twice with the same arguments as AC-19 — a Gold
  customer, 1 111 of `fresh`, 8 889 of `standard`, and a 50% coupon on `fresh`
- **THEN** the two results are deeply equal; `order` and `catalog` are deeply
  equal to copies taken before the first call; all five numeric breakdown fields
  satisfy `Number.isSafeInteger`;
  `subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks >= 0`; and
  `totalKopecks === subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks + shippingKopecks`
