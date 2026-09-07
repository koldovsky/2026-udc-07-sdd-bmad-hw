## Purpose

Prices a checkout order by applying loyalty-tier and promo-code discounts to goods in whole kopecks, leaving shipping as a separate un-discounted line.

## ADDED Requirements

### Requirement: Loyalty tier applies to goods only
The system MUST apply the customer’s headline tier percentage (Silver 5%, Gold 10%, none 0%) to the goods subtotal only. Shipping MUST NOT enter the discount base and MUST NOT be reduced. The result MUST expose the tier discount as its own amount, separate from promo-code discounts.

#### Scenario: Gold order without promo codes
- **WHEN** a Gold customer’s order goods total 100_000 kopecks (one `standard` line), country is UA, and no promo codes are entered
- **THEN** tier discount is 10_000, coupon discount is 0, shipping is 4_900, and total is 94_900

#### Scenario: Gold order with international shipping
- **WHEN** a Gold customer’s order goods total 100_000 kopecks (one `standard` line), country is PL, and no promo codes are entered
- **THEN** tier discount is 10_000 (not 11_990), shipping is 19_900, and total is 109_900

### Requirement: Promo codes stack sequentially after the tier
The system MUST apply eligible promo codes after the tier discount, each against the remaining goods amount at that step. Percentages MUST NOT be added together (not 10% + 15% = 25%). Mixed percent and fixed codes MUST keep the customer’s typed order; the system MUST NOT reorder them for a better total.

#### Scenario: Gold then 15 percent code
- **WHEN** a Gold customer’s goods total 100_000 kopecks, country is UA, and one valid 15% code with no category is entered
- **THEN** tier discount is 10_000, coupon discount is 13_500, and total is 81_400 (not 79_900 from additive 25%, and not coupon 15_000 from 15% of the original subtotal)

#### Scenario: Percent then fixed in typed order
- **WHEN** a `none`-tier order of 100_000 kopecks (UA) is given first a valid 10% code with no category, then a valid fixed code of 5_000 kopecks
- **THEN** coupon discount is 15_000 and total is 89_900

### Requirement: Category-scoped codes use the original category subtotal
A percent or fixed code with a category MUST compute its raw discount from the original sum of line totals in that category, not from the whole order. The applied amount MUST be capped by that category base and by remaining goods. Two valid codes on the same category MUST both apply in typed order.

#### Scenario: Two percent codes on the same category
- **WHEN** a `none`-tier order has `fresh` 50_000 and `standard` 50_000, and the customer enters a valid 10% `fresh` code then a valid 20% `fresh` code
- **THEN** coupon discount is 15_000 (5_000 + 10_000) and total is 89_900, not 10_000 (best-only) and not 30_000 (30% of the whole cart)

#### Scenario: Category percent does not tax other categories
- **WHEN** a `none`-tier order has `standard` 80_000 and `fresh` 20_000, and a valid 10% code scoped to `fresh` is entered
- **THEN** coupon discount is 2_000 and total is 102_900

### Requirement: Minimum subtotal is checked on the original goods total
When a code has `minSubtotalKopecks`, the system MUST compare it to the original goods subtotal (before any discounts, excluding shipping). If the original subtotal is below the threshold, the code MUST be skipped. The threshold MUST use the whole-order goods total even for category-scoped codes.

#### Scenario: Threshold passes on original subtotal after Gold reduced remaining
- **WHEN** a Gold order of 40_000 kopecks (UA) has a valid 10% code with `minSubtotalKopecks` 38_000
- **THEN** the code applies: tier discount is 4_000, coupon discount is 3_600, total is 37_300

#### Scenario: Threshold fails on original subtotal
- **WHEN** a `none`-tier order of 30_000 kopecks (UA) has a 10% code with `minSubtotalKopecks` 40_000
- **THEN** coupon discount is 0 and total is 34_900

### Requirement: Ineligible codes are skipped without failing the price
Expired codes (`asOf` at or after `expiresAt`), unknown typed codes, codes present only in the catalog, codes with no matching category lines, and duplicate typed codes (after trim and case-insensitive match) MUST contribute zero extra discount. Pricing MUST still return a breakdown and MUST NOT throw because of those codes. Catalog entries not typed on the order MUST NOT apply. Validity instant is the caller-supplied `asOf`; the engine MUST NOT read the system clock.

#### Scenario: Code expired at the asOf instant
- **WHEN** the Gold order from the no-coupon scenario also types a 15% code whose `expiresAt` equals `asOf` at `2026-01-01T00:00:00.000Z`
- **THEN** coupon discount is 0, tier discount is 10_000, total is 94_900, and pricing does not throw

#### Scenario: Unknown code then a valid code
- **WHEN** a `none`-tier order of 100_000 kopecks (UA) types `NOSUCH` then `SAVE10`, and the catalog contains only a valid 10% `SAVE10`
- **THEN** coupon discount is 10_000, total is 94_900, and pricing does not throw

#### Scenario: Same code typed twice
- **WHEN** a `none`-tier order of 100_000 kopecks (UA) types the same valid fixed 10_000-kopeck code twice
- **THEN** coupon discount is 10_000 (not 20_000) and total is 94_900

### Requirement: Goods remaining never goes negative
Applied discounts MUST NOT make remaining goods negative. A fixed code larger than remaining goods MUST cap at remaining goods. Shipping is added after that floor and is not zeroed by discounts (except the existing all-digital / empty-cart shipping rules).

#### Scenario: Fixed discount larger than goods
- **WHEN** a `none`-tier order of 10_000 kopecks (`standard`, UA) has a valid fixed code of 50_000 kopecks
- **THEN** coupon discount is 10_000, remaining goods are 0, shipping is 4_900, total is 4_900, and no breakdown field is negative

### Requirement: Percent discounts round half-up to whole kopecks
Each percent discount MUST convert to whole kopecks with half-up rounding using integer arithmetic only (remainder `>= 50` rounds away from zero). The engine MUST NOT use floating-point division for money.

#### Scenario: Half kopeck rounds up
- **WHEN** a Gold customer has a single `digital` line of 125 kopecks and no promo codes
- **THEN** tier discount is 13, shipping is 0, and total is 112

### Requirement: Empty cart prices to zero
An order with no line items MUST produce a zero breakdown, including zero shipping, even if a tier and a valid percent code are present. Pricing MUST NOT throw.

#### Scenario: Empty Gold cart with a percent code
- **WHEN** `items` is empty, customer tier is Gold, country is UA, and a valid 50% code is typed
- **THEN** subtotal, tier discount, coupon discount, shipping, and total are all 0
