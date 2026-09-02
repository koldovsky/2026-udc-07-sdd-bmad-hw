## Purpose

Defines how loyalty-tier and coupon discounts are computed, ordered, rounded, capped and
reported for a checkout order, so that the payable total is fully determined by the order,
the coupon catalogue and the instant of calculation — with no room for implementation choice.

Normative source: `docs/spec/pricing-discounts.md`. Every requirement below cites the decision
(`D-N`) it encodes and every scenario cites the acceptance criterion (`AC-N`) it implements.
Where this document and the decision table disagree, the decision table wins.

Vocabulary used throughout:

- **subtotal** — the goods total of the order, excluding shipping.
- **remaining** — the goods amount after the discounts applied so far; starts at subtotal and
  never increases.
- **scope** — a coupon's target: its category, or the whole order when it has no category.
- **now** — the explicit instant the price is calculated at.

All amounts are whole kopecks (1 грн = 100 копійок).

## ADDED Requirements

### Requirement: Loyalty tier discount applies to the goods subtotal

The system SHALL reduce the goods amount by the customer's tier percentage (gold 10%, silver
5%, none 0%) computed against the order subtotal, before any coupon is considered (D-1, D-2,
D-15).

#### Scenario: Gold tier, no coupons (AC-1)

- **WHEN** a domestic order of 100 000 kopecks is priced for a `gold` customer with no coupons
- **THEN** the tier discount is 10 000 kopecks, the coupon discount is 0, shipping is 4 900 and
  the payable total is 94 900 kopecks

#### Scenario: Silver and none tiers (AC-2)

- **WHEN** the same 100 000 kopeck domestic order is priced for a `silver` customer
- **THEN** the tier discount is 5 000 kopecks and the total is 99 900 kopecks
- **WHEN** it is priced for a customer with tier `none`
- **THEN** the tier discount is 0 and the total is 104 900 kopecks

### Requirement: Tier and coupon discounts compose sequentially, never additively

The system SHALL apply the tier discount first against the subtotal, then each accepted coupon
in turn against the amount remaining after all earlier discounts. Percentages MUST NOT be summed
(D-1, D-18).

#### Scenario: Tier then percent coupon (AC-3)

- **WHEN** a domestic order of 100 000 kopecks for a `gold` customer is priced with a valid
  order-wide 15% coupon
- **THEN** the tier discount is 10 000 kopecks and the coupon discount is 13 500 kopecks — 15%
  of the remaining 90 000, not 15 000 — leaving goods of 76 500 and a total of 81 400 kopecks

#### Scenario: Two coupons in different scopes stack in entry order (AC-7)

- **WHEN** an order of 60 000 `standard` plus 40 000 `fresh` for a `gold` customer is priced
  with coupons entered as `FRESH20` (20%, `fresh`) then `ORDER10` (10%, order-wide)
- **THEN** the discounts are 10 000 (tier), 7 200 (`FRESH20`, leaving 82 800) and 8 280
  (`ORDER10`, leaving 74 520), the coupon discount total is 15 480 and the payable total is
  79 420 kopecks

### Requirement: Shipping is outside the discount base

The system SHALL compute the discount base from goods only, and SHALL add the shipping fee —
derived from the original order, unaffected by any discount — after all discounts (D-2, D-16).

#### Scenario: International shipping is not discounted (AC-4)

- **WHEN** a 100 000 kopeck order for a `gold` customer ships internationally (fee 19 900)
- **THEN** the tier discount is 10 000 kopecks, not 11 990, and the payable total is 109 900
  kopecks

#### Scenario: Digital-only order keeps zero shipping (AC-19)

- **WHEN** an order of 100 000 kopecks consisting only of `digital` items is priced for a `gold`
  customer with an order-wide 10% coupon
- **THEN** shipping is 0, the tier discount is 10 000, the coupon discount is 9 000 and the
  payable total is 81 000 kopecks

### Requirement: Category coupons discount that category's share of the remaining amount

For a coupon restricted to a category, the system SHALL compute the discount base as that
category's line total scaled by the share of the subtotal still remaining, rounded half-up, and
SHALL cap the resulting discount at that base (D-5, D-19).

#### Scenario: Percent coupon on one category (AC-5)

- **WHEN** an order of 60 000 `standard` plus 40 000 `fresh` (subtotal 100 000) for a `gold`
  customer is priced with a 20% `fresh` coupon
- **THEN** the tier discount is 10 000, the category base is 36 000 (40 000 × 90 000 / 100 000),
  the coupon discount is 7 200 and the payable total is 87 700 kopecks

#### Scenario: Category base rounds half-up (AC-14)

- **WHEN** an order of 5 000 `standard` plus 5 001 `fresh` (subtotal 10 001) for a `silver`
  customer is priced with a 10% `fresh` coupon
- **THEN** the tier discount is 500 (500.05 rounded), the category base is 4 751, the coupon
  discount is 475 (475.1 rounded) and the payable total is 13 926 kopecks

#### Scenario: Coupon targets a category absent from the order (AC-17)

- **WHEN** an order containing only `standard` items is priced with a `fresh` coupon
- **THEN** the coupon is rejected with reason `no_matching_items` and does NOT appear among the
  applied coupons with a zero discount

### Requirement: At most one coupon may apply per scope

The system SHALL accept the first valid coupon for a given scope and SHALL reject every later
coupon targeting the same scope with reason `duplicate_scope`. A code entered more than once
SHALL be rejected with reason `duplicate_code` on its repeat occurrences (D-3, D-11).

#### Scenario: Two coupons on the same category (AC-6)

- **WHEN** an order of 60 000 `standard` plus 40 000 `fresh` for a `gold` customer is priced
  with `FRESH20` then `FRESH10`, both valid and both scoped to `fresh`
- **THEN** only `FRESH20` applies for 7 200 kopecks, `FRESH10` is rejected with reason
  `duplicate_scope`, and the payable total is 87 700 kopecks

#### Scenario: The same code entered twice (AC-16)

- **WHEN** a 100 000 kopeck domestic order for a tier `none` customer is priced with
  `ORDER10` entered twice
- **THEN** the discount is granted once for 10 000 kopecks, the second occurrence is rejected
  with reason `duplicate_code` and the payable total is 94 900 kopecks

### Requirement: Minimum-subtotal thresholds evaluate against the pre-discount subtotal

The system SHALL compare a coupon's `minSubtotalKopecks` against the original order subtotal,
inclusively, before any discount is subtracted (D-6).

#### Scenario: Threshold met on the pre-discount subtotal (AC-8)

- **WHEN** a 100 000 kopeck domestic order for a `gold` customer — whose remaining amount after
  the tier discount is 90 000 — is priced with a 5 000 kopeck fixed coupon requiring a minimum
  subtotal of 95 000
- **THEN** the coupon applies for 5 000 kopecks and the payable total is 89 900 kopecks

#### Scenario: Threshold not met (AC-9)

- **WHEN** an order of 94 999 kopecks is priced with that same coupon
- **THEN** the coupon is rejected with reason `below_min_subtotal` and the coupon discount is 0
- **WHEN** the subtotal is exactly 95 000 kopecks
- **THEN** the coupon applies

### Requirement: Coupon expiry is evaluated against an explicit instant

A coupon SHALL be treated as valid only while `now` is strictly before its `expiresAt` instant;
it is invalid at that instant and after it. The instant used for pricing SHALL be an explicit
input rather than an ambient clock read (D-8, D-9).

#### Scenario: Expired coupon is reported, not thrown (AC-10)

- **WHEN** an order is priced at `now = 2026-10-01T00:00:00Z` with a coupon whose `expiresAt` is
  `2026-10-01T00:00:00Z`
- **THEN** the coupon is rejected with reason `expired`, the coupon discount is 0, the rest of
  the calculation proceeds as if no coupon were entered, and no exception is raised
- **WHEN** the same order is priced at `now = 2026-09-30T23:59:59Z`
- **THEN** the coupon is valid and applies

### Requirement: Unusable coupons are reported with a machine-readable reason and never abort pricing

The system SHALL always return a successful breakdown and SHALL classify every coupon it cannot
apply into exactly one reason, evaluated in the fixed order `unknown`, `duplicate_code`,
`invalid_value`, `expired`, `below_min_subtotal`, `duplicate_scope`, `no_matching_items`. It
MUST NOT raise an exception for any input and MUST NOT clamp malformed coupon values into range
(D-8, D-10, D-12, D-13, D-17, D-21, D-23).

#### Scenario: Unknown code (AC-15)

- **WHEN** an order is priced with a code that is absent from the coupon catalogue
- **THEN** that code is rejected with reason `unknown`, the coupon discount is 0 and pricing
  completes successfully

#### Scenario: Malformed coupon values (AC-18)

- **WHEN** the catalogue contains a percent coupon with value 150, or a fixed coupon with value
  −100
- **THEN** each is rejected with reason `invalid_value`, and neither is clamped to 100% nor to 0

#### Scenario: Unparseable expiry date is a data defect, not an expiry (AC-21)

- **WHEN** the catalogue contains a coupon whose `expiresAt` cannot be parsed as an instant, for
  example `"not-a-date"`
- **THEN** it is rejected with reason `invalid_value` and NOT with reason `expired`, the coupon
  discount is 0 and no exception is raised

#### Scenario: Duplicate entries in the catalogue (AC-22)

- **WHEN** the catalogue contains two entries with the code `SAME`, the first a 10% coupon and
  the second a 50% coupon, and a 100 000 kopeck order for a tier `none` customer enters `SAME`
- **THEN** the first entry wins, the coupon discount is 10 000 kopecks and the payable total is
  94 900 kopecks

#### Scenario: Non-integral coupon values (AC-23)

- **WHEN** the catalogue contains a fixed coupon whose value is `NaN`, or a fixed coupon worth
  100.5 kopecks
- **THEN** each is rejected with reason `invalid_value`, because a non-integral or non-finite
  amount would otherwise reach the breakdown and violate the balance requirement
- **WHEN** the catalogue contains a percent coupon of 7.5% applied to a 100 000 kopeck order for
  a tier `none` customer
- **THEN** it is accepted — a fractional percentage is legitimate — the coupon discount is
  7 500 kopecks and the payable total is 97 400 kopecks

#### Scenario: Coupon codes match exactly (AC-24)

- **WHEN** the catalogue holds the code `O10` and a 100 000 kopeck order for a tier `none`
  customer enters `o10`, or ` O10 ` with surrounding spaces
- **THEN** the code is rejected with reason `unknown` and the payable total is 104 900 kopecks —
  the engine SHALL NOT trim or case-fold entered codes, because normalising customer input is
  the responsibility of the layer that collects it (D-24)
- **WHEN** the entered code is exactly `O10`
- **THEN** it applies and the payable total is 94 900 kopecks

### Requirement: The payable total is never negative

The system SHALL cap every individual discount at the amount still remaining, SHALL floor the
discounted goods amount at 0, and SHALL NOT let any discount reduce the shipping fee. The
minimum payable total is therefore the shipping fee (D-7, D-20).

#### Scenario: Fixed coupon exceeds the order value (AC-11)

- **WHEN** a domestic order of 5 000 kopecks for a tier `none` customer is priced with a fixed
  coupon of 10 000 kopecks
- **THEN** the coupon discount is capped at 5 000, the discounted goods amount is 0, shipping
  remains 4 900 and the payable total is 4 900 kopecks

### Requirement: An empty order prices to zero without special-casing

The system SHALL price an order with no line items as subtotal 0, all discounts 0, shipping 0
and total 0, rejecting any entered coupon under the ordinary rules rather than raising an error
(D-14).

#### Scenario: Empty cart with a coupon entered (AC-12)

- **WHEN** an order with no items for a `gold` customer is priced with an order-wide coupon
- **THEN** subtotal, tier discount, coupon discount, shipping and total are all 0, the coupon is
  rejected with reason `no_matching_items` and no exception is raised

### Requirement: Money is whole kopecks, rounded half-up at every discount step

Every amount the system exposes SHALL be a non-negative integer number of kopecks. Each discount
SHALL be rounded half-up away from zero at the step that produces it — not per line item and not
only at the end (D-4).

#### Scenario: Half a kopeck rounds up (AC-13)

- **WHEN** a domestic order of three items at 1 350 kopecks each (subtotal 4 050) is priced for
  a `silver` customer
- **THEN** the 5% tier discount of 202.5 kopecks becomes 203, not 202, leaving goods of 3 847 and
  a payable total of 8 747 kopecks

### Requirement: The breakdown balances arithmetically

For every result the system produces, the reported figures SHALL reconcile exactly, so a reader
can verify the total from the parts without re-running the calculation (D-4, D-7).

#### Scenario: Totals reconcile on every result (AC-20)

- **WHEN** any order is priced with any catalogue and any instant
- **THEN** subtotal minus the tier discount minus the coupon discount plus shipping equals the
  payable total exactly
- **THEN** the coupon discount equals the sum of the per-coupon discounts of the applied coupons
- **THEN** every reported amount is a non-negative integer


