## Purpose

Defines how a customer's loyalty tier and the promo codes they typed at checkout
reduce an order total: what each discount applies to, in what order they stack,
when a code is refused and why, how fractional kopecks are resolved, and how low
the total may go. Every amount is whole kopecks (1 грн = 100 копійок).

## ADDED Requirements

### Requirement: Loyalty tier reduces the item subtotal

The system SHALL reduce every order by the customer's tier percentage — 5% for
`silver`, 10% for `gold`, 0% otherwise — applied to the item subtotal. The tier
discount SHALL apply to items of every category, with no exclusions.

#### Scenario: AC-1 — gold tier on a plain order

- **WHEN** a `gold` customer orders 100_000 to UA with no coupons
- **THEN** the tier discount is 10_000, the coupon discount is 0, shipping is
  4_900, and the total is 94_900

#### Scenario: AC-17 — tier applies to digital items too

- **WHEN** a `gold` customer orders 20_000 of digital-only items
- **THEN** the tier discount is 2_000, shipping is 0, and the total is 18_000

### Requirement: Shipping is never discounted

The system SHALL compute every discount against the item subtotal only, and
SHALL add shipping after all discounts. No discount SHALL reduce a shipping fee.

#### Scenario: AC-1 — shipping survives a tier discount

- **WHEN** a `gold` customer's 100_000 order attracts a 10_000 tier discount and
  a 4_900 domestic shipping fee
- **THEN** the total is 94_900 — the shipping fee is charged in full

#### Scenario: AC-4 — shipping is still charged when items are fully discounted

- **WHEN** discounts reduce the item amount of a 30_000 order to 0 and shipping
  is 4_900
- **THEN** the total is 4_900

### Requirement: Tier and coupon discounts stack sequentially

The system SHALL apply the tier discount first and then apply coupons to the
amount that remains. Percentages SHALL NOT be summed and applied as a single
combined rate.

#### Scenario: AC-2 — gold plus a 15% code

- **WHEN** a `gold` customer orders 100_000 and applies one order-wide 15% code
- **THEN** the tier discount is 10_000, the coupon discount is 13_500 — 15% of
  the remaining 90_000 — and the total is 81_400
- **AND** the total is NOT 79_900, which summing the rates to 25% would produce

### Requirement: Multiple coupons apply in entry order, one per scope

The system SHALL evaluate the codes a customer typed in the order they typed
them, and SHALL apply each valid coupon to the amount remaining at its turn. A
coupon's scope is the whole order when it names no category, otherwise that
category. At most one coupon SHALL apply per scope; a later coupon whose scope is
already discounted SHALL be refused with reason `duplicate-scope`. A repeat of a
code already seen SHALL be refused with reason `duplicate-code`.

#### Scenario: AC-3 — two coupons on the same category

- **WHEN** an order of fresh 40_000 + standard 60_000 with no tier applies
  `FRESH15` then `FRESH5`, both scoped to `fresh`
- **THEN** `FRESH15` is applied for 6_000, `FRESH5` is refused with reason
  `duplicate-scope`, and the total is 98_900

#### Scenario: AC-14 — the same code entered twice

- **WHEN** a 100_000 order with no tier applies `SAVE10` (order-wide 10%) twice
- **THEN** the first occurrence is applied for 10_000, the second is refused with
  reason `duplicate-code`, and the total is 94_900

#### Scenario: AC-15 — a category coupon and an order-wide coupon stack

- **WHEN** a `gold` customer orders fresh 40_000 + standard 60_000 and applies
  `FRESH15` (15% on `fresh`), `SAVE100` (fixed 10_000 order-wide) and `FRESH5`
  (5% on `fresh`) in that order
- **THEN** the tier discount is 10_000, `FRESH15` is applied for 5_400,
  `SAVE100` is applied for 10_000 against the remaining 84_600, `FRESH5` is
  refused with reason `duplicate-scope`, the coupon discount is 15_400, and the
  total is 79_500

### Requirement: A category coupon is computed on its own category after the tier

The system SHALL compute a category-scoped coupon against that category's items
only, after reducing that category's subtotal by the tier percentage. It SHALL
NOT compute it against the whole order, nor against the category's pre-tier
amount.

#### Scenario: AC-11 — 15% off fresh for a gold customer

- **WHEN** a `gold` customer orders fresh 40_000 + standard 60_000 and applies a
  15% coupon scoped to `fresh`
- **THEN** the tier discount is 10_000, the coupon base is the post-tier fresh
  amount of 36_000, the coupon discount is 5_400, and the total is 89_500
- **AND** the coupon discount is neither 6_000 (pre-tier category base) nor
  13_500 (whole-order base)

### Requirement: A discount never exceeds what remains

The system SHALL clamp a fixed-amount coupon to the amount its scope still
carries, and SHALL report the clamped figure as the discount granted. The
discounted item amount SHALL NOT fall below 0, and the total SHALL NOT fall
below the shipping fee.

#### Scenario: AC-4 — a fixed coupon larger than the order

- **WHEN** a 30_000 order with no tier applies a fixed coupon of 50_000
- **THEN** the discount granted is reported as 30_000, not 50_000, the item
  amount is 0, and the total is the 4_900 shipping fee — never a negative amount

### Requirement: Fractional kopecks round half away from zero

The system SHALL round each percentage discount to whole kopecks at the moment it
is computed, resolving an exact half upward, and SHALL use integer arithmetic
throughout. No floating-point arithmetic SHALL be used for amounts.

#### Scenario: AC-5 — half a kopeck on a tier discount

- **WHEN** a `gold` customer orders 12_345, so 10% is exactly 1_234.5
- **THEN** the tier discount is 1_235 and the total is 16_010

#### Scenario: AC-6 — half a kopeck on a coupon discount

- **WHEN** a 12_350 order with no tier applies an order-wide 5% code, so the
  discount is exactly 617.5
- **THEN** the coupon discount is 618 and the total is 16_632

### Requirement: An invalid coupon is refused with a reason, not an error

The system SHALL price the order regardless of any invalid code and SHALL NOT
raise an error. Each code that does not apply SHALL be reported with exactly one
machine-readable reason: `unknown` when the catalog has no such code, `expired`
when the evaluation instant is at or after the coupon's expiry,
`below-min-subtotal` when the gross item subtotal has not reached the coupon's
minimum, `no-eligible-items` when the coupon's scope carries no amount, or the
duplicate reasons above. Code matching SHALL be exact and case-sensitive.

#### Scenario: AC-7 — a coupon at the instant it expires

- **WHEN** a 100_000 order with no tier applies a coupon and the evaluation
  instant is exactly the coupon's expiry instant
- **THEN** the coupon is refused with reason `expired`, the coupon discount is 0,
  the total is 104_900, and no error is raised

#### Scenario: AC-8 — a code the catalog does not contain

- **WHEN** a 100_000 order with no tier applies a code absent from the catalog
- **THEN** the code is refused with reason `unknown` and the total is 104_900

#### Scenario: AC-13 — a category coupon with no items in that category

- **WHEN** a coupon scoped to `digital` is applied to an order containing no
  digital item
- **THEN** the coupon is refused with reason `no-eligible-items` and the total is
  unchanged

#### Scenario: AC-12 — an order with no items at all

- **WHEN** a `gold` customer applies a 10% code to an order containing no items
- **THEN** the subtotal is 0, the tier discount is 0, shipping is 0, the total is
  0, and the code is refused with reason `no-eligible-items`

### Requirement: A minimum-subtotal coupon is judged on the gross subtotal

The system SHALL compare a coupon's minimum-subtotal condition against the gross
item subtotal, before any discount, and SHALL treat a subtotal exactly equal to
the minimum as satisfying it.

#### Scenario: AC-9 — subtotal exactly at the minimum

- **WHEN** a `gold` customer's subtotal is exactly 50_000 and a 10% coupon
  requires a minimum subtotal of 50_000
- **THEN** the coupon applies — the tier discount is 5_000, the coupon discount
  is 4_500, and the total is 45_400 — even though the post-tier amount of 45_000
  is below the minimum

#### Scenario: AC-10 — subtotal just below the minimum

- **WHEN** the subtotal is 49_900 and the coupon requires a minimum of 50_000
- **THEN** the coupon is refused with reason `below-min-subtotal`, the coupon
  discount is 0, and the total is 54_800

### Requirement: The breakdown explains the total and accounts for every code

The system SHALL return a breakdown carrying the item subtotal, the tier
discount, the total coupon discount, each applied coupon with the amount it
granted, each refused coupon with its reason, the shipping fee, and the total.
The breakdown SHALL satisfy
`subtotal − tierDiscount − couponDiscount + shipping = total` and
`total >= shipping`, and every code the customer typed SHALL appear exactly once
across the applied and refused lists. Pricing SHALL be deterministic: the same
order, catalog and evaluation instant SHALL always produce the same breakdown,
and pricing SHALL NOT modify the order or the catalog.

#### Scenario: AC-16 — the breakdown reconciles

- **WHEN** any order is priced
- **THEN** subtracting the tier and coupon discounts from the subtotal and adding
  shipping yields exactly the reported total
- **AND** the total is at least the shipping fee
- **AND** each typed code appears exactly once as either applied or refused
