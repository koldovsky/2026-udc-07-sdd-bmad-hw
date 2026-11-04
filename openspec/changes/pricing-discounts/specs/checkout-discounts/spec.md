# Spec Delta

## Purpose

Checkout quotes combine earned loyalty savings with the best eligible entered coupon and return reproducible, itemized amounts.

[Source specification](../../../../../docs/spec/pricing-discounts.md)

All money values below are in kopecks. Unless stated otherwise, use a UA order with tier `none`, one quantity-1 `standard` line priced at the stated subtotal, and no entered codes. Listed coupons are both in the catalog and entered in the listed order unless stated otherwise. Use `nowMs = Date.parse("2026-10-01T12:00:00Z")`; coupons expire at `2026-10-02T12:00:00Z` unless stated otherwise.

The input contract requires unique catalog codes, valid ISO expiration timestamps with explicit UTC offsets, and a valid epoch-millisecond evaluation time. Unit prices, quantities, fixed amounts, and minimums are nonnegative safe integers. Percentage rates are whole numbers from 0 through 100. Undiscounted subtotal plus shipping fits in a safe integer. Invalid input handling is outside the contract.

## ADDED Requirements

### Requirement: Deterministic price breakdown

The system SHALL accept an order, a readonly coupon catalog, and an explicit evaluation time in epoch milliseconds, and SHALL return the original merchandise subtotal, actual coupon discount, actual loyalty discount, unchanged shipping, and final total in whole kopecks. It SHALL preserve the inputs and compute the quote without reading the system clock.

#### Scenario: AC-7 (boundary)

- **WHEN** a Gold customer's basket is empty and an entered fixed coupon offers 1,000
- **THEN** subtotal, coupon discount, loyalty discount, shipping, and total are all 0.

### Requirement: Loyalty on remaining merchandise

After deducting the winning coupon, the system SHALL apply loyalty to the remaining merchandise subtotal at 0% for none, 5% for Silver, and 10% for Gold. It SHALL round the aggregate loyalty discount to the nearest kopeck with halves rounded up and cap it at the remaining subtotal.

#### Scenario: AC-1

- **WHEN** a Gold customer orders merchandise worth 100,000 without coupons
- **THEN** the loyalty discount is 10,000, the coupon discount is 0, and the total is 94,900.

#### Scenario: AC-5

- **WHEN** a Silver customer enters a 10% coupon on a subtotal of 10,000
- **THEN** the coupon discount is 1,000, the loyalty discount is 450, and the total is 13,450.

#### Scenario: AC-6 (boundary)

- **WHEN** a Gold customer buys two standard lines worth 2 and 3 with no coupons
- **THEN** the aggregate loyalty discount rounds from exactly half a kopeck to 1 and the total is 4,904.

### Requirement: Coupon eligibility

The system SHALL match codes exactly and case-sensitively and ignore unknown codes and coupons whose expiration instant is at or before evaluation time, without throwing or returning rejection reasons. When a coupon specifies a minimum, the original whole-order merchandise subtotal SHALL meet or exceed it.

#### Scenario: AC-2

- **WHEN** a 1,000 fixed coupon is evaluated on a subtotal of 10,000 one millisecond before, exactly at, or one millisecond after expiration
- **THEN** the coupon discounts are 1,000, 0, and 0 respectively, with no error.

#### Scenario: AC-8 (boundary)

- **WHEN** a Gold customer has 4,000 in fresh goods and 6,000 in standard goods and enters a 10% fresh coupon with a minimum of 10,000
- **THEN** the coupon discount is 400; reducing the standard line to 5,999 makes the coupon discount 0.

#### Scenario: AC-11

- **WHEN** a basket subtotal is 10,000 and codes `save`, `MISSING`, `SAVE`, and `SAVE` are entered against a catalog containing only `SAVE` worth 1,000
- **THEN** the first two codes alone yield a coupon discount of 0 and all four together yield 1,000.

### Requirement: Coupon discount calculation

The system SHALL use original merchandise totals for the specified category or the entire merchandise subtotal if unrestricted. It SHALL apply the fixed face value once or round the percentage on the aggregate base to the nearest kopeck with halves rounded up, using exact intermediates. It SHALL cap the candidate at its eligible base, including zero.

#### Scenario: AC-10

- **WHEN** a basket contains only 10,000 in standard goods and the entered coupon is a fixed fresh coupon worth 1,000
- **THEN** the coupon discount is 0 and the total is 14,900.

#### Scenario: AC-12

- **WHEN** a basket contains two digital lines worth 2 and 3 and the only coupon offers 10% off digital goods
- **THEN** the coupon discount is 1, shipping is 0, and the total is 4.

### Requirement: Winning coupon

The system SHALL evaluate each entered code independently on original merchandise amounts and apply only the greatest positive capped and rounded discount. It SHALL keep the earliest entered code on a tie and apply zero when no positive candidate exists. Repeated entries SHALL NOT increase the discount. The breakdown SHALL omit winning code identity.

#### Scenario: AC-3

- **WHEN** a basket has 10,000 in fresh goods and 10,000 in standard goods and two fresh coupons offer 10% and 15%
- **THEN** the coupon discount is 1,500 in either entry order and the total is 23,400.

#### Scenario: AC-9

- **WHEN** a basket has 1,000 in fresh goods and 9,000 in standard goods and the candidates are a fresh fixed coupon worth 5,000 and an unrestricted fixed coupon worth 1,200
- **THEN** the coupon discount is 1,200.

#### Scenario: AC-14

- **WHEN** a basket subtotal is 10,000 and a 10% coupon ties a fixed coupon worth 1,000
- **THEN** either entry order returns the same breakdown, including a coupon discount of 1,000 and a total of 13,900; winning code identity is not exposed.

### Requirement: Shipping and final total

The system SHALL exclude shipping from discount bases and eligibility checks and add the unchanged shipping fee after subtracting both discounts from the original subtotal. Discounts SHALL NOT create credit.

#### Scenario: AC-4 (boundary)

- **WHEN** a Gold customer enters a fixed coupon worth 20,000 on a subtotal of 10,000
- **THEN** the coupon discount is 10,000, the loyalty discount is 0, and the total is 4,900.

#### Scenario: AC-13

- **WHEN** a physical order of 10,000 ships outside UA with a 10% coupon
- **THEN** the coupon discount is 1,000, shipping is 19,900, and the total is 28,900.
