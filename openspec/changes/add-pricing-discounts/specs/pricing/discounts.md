## Purpose

Provides a pricing engine that combines tier-based loyalty discounts with promotional coupons (percent and fixed-amount), applies them sequentially, handles edge cases precisely (rounding, expired coupons, negative totals), and returns a detailed breakdown for checkout display.

## ADDED Requirements

### Requirement: Calculate price with tier loyalty discount

The system SHALL apply a tier-based discount to the order subtotal based on the customer's tier (Silver: 5%, Gold: 10%, None: 0%).

#### Scenario: Gold customer without coupons
- **WHEN** customer tier is "gold" and order subtotal is 100,000 kopecks (1000 грн)
- **THEN** tier discount is 10,000 kopecks and subtotal after discount is 90,000 kopecks

#### Scenario: Silver customer without coupons
- **WHEN** customer tier is "silver" and order subtotal is 100,000 kopecks
- **THEN** tier discount is 5,000 kopecks and subtotal after discount is 95,000 kopecks

#### Scenario: No tier
- **WHEN** customer tier is "none" and order subtotal is 100,000 kopecks
- **THEN** tier discount is 0 kopecks

### Requirement: Apply coupon codes in sequence

The system SHALL apply coupon codes in the order they were entered by the customer, each coupon calculating its discount from the subtotal remaining after previous discounts.

#### Scenario: Two sequential coupons on same category
- **WHEN** customer applies two coupons to fresh products: -10% and -20%, and fresh subtotal is 50,000 kopecks
- **THEN** first coupon reduces it to 45,000 kopecks (5,000 off), second coupon reduces it to 36,000 kopecks (9,000 off), total discount is 14,000 kopecks

#### Scenario: Coupon after tier discount
- **WHEN** tier discount (10%) leaves 90,000 kopecks and coupon is -15%
- **THEN** coupon calculates 15% of 90,000 = 13,500 kopecks discount

### Requirement: Ignore expired coupons

The system SHALL not apply a coupon if its `expiresAt` date is in the past (before today).

#### Scenario: Coupon expired yesterday
- **WHEN** coupon has `expiresAt` = "2026-09-07" and today is "2026-09-08"
- **THEN** coupon is ignored, no discount applied

#### Scenario: Coupon expires today
- **WHEN** coupon has `expiresAt` = "2026-09-08" and today is "2026-09-08"
- **THEN** coupon is ignored (not valid on or after the expiration instant)

### Requirement: Respect coupon minimum subtotal requirement

The system SHALL only apply a coupon if the order subtotal (before applying this coupon) meets the coupon's `minSubtotalKopecks` threshold.

#### Scenario: Order below minimum
- **WHEN** coupon requires `minSubtotalKopecks` = 100,000 and order subtotal is 80,000
- **THEN** coupon does not apply

#### Scenario: Order meets minimum
- **WHEN** coupon requires `minSubtotalKopecks` = 100,000 and order subtotal is 100,000
- **THEN** coupon applies

#### Scenario: Minimum checked before coupon application
- **WHEN** customer has tier discount (10%) leaving 90,000 kopecks and next coupon requires `minSubtotalKopecks` = 100,000
- **THEN** coupon does not apply (minimum is checked against 90,000, not original 100,000)

### Requirement: Apply coupon only to specified category

If a coupon has a `category` field, the system SHALL calculate its discount only from items in that category; otherwise, it applies to the entire subtotal.

#### Scenario: Coupon on fresh category
- **WHEN** coupon is -10% for "fresh", fresh items subtotal is 50,000 kopecks, other items subtotal is 50,000 kopecks
- **THEN** discount is calculated from 50,000 (fresh only) = 5,000 kopecks, not from 100,000

#### Scenario: Global coupon (no category)
- **WHEN** coupon has no `category` field and subtotal is 100,000 kopecks
- **THEN** discount applies to full 100,000 kopecks

#### Scenario: Category coupon but no items in that category
- **WHEN** coupon is -10% for "fresh" but order has no fresh items
- **THEN** coupon applies 0 discount (category sum is 0)

### Requirement: Base discounts on subtotal only, not shipping

The system SHALL calculate all discounts (tier and coupon) as percentages of or amounts off the subtotal (items only), not including shipping costs.

#### Scenario: Tier discount does not affect shipping
- **WHEN** subtotal is 100,000 kopecks and shipping is 4,900 kopecks
- **THEN** tier discount (10%) reduces 100,000 by 10,000, but shipping remains 4,900

#### Scenario: Coupon does not affect shipping
- **WHEN** coupon is -1,000 kopecks fixed and shipping is 4,900
- **THEN** coupon reduces subtotal by 1,000, shipping stays 4,900

### Requirement: Round at final subtotal to nearest kopeck

The system SHALL calculate all discounts with full precision (fractions of kopecks), then round the final subtotal to the nearest whole kopeck. When the result is 0.5 kopecks, round up to 1.

#### Scenario: Rounding with 0.5 kopeck
- **WHEN** tier discount (5%) on 333 kopecks = 16.65 kopecks
- **THEN** subtotal after discount rounds to 333 - 17 = 316 kopecks (0.5 rounds up)

#### Scenario: Rounding 0.4 down
- **WHEN** discount calculation results in 100.4 kopecks off
- **THEN** rounded result treats it as 100 kopecks off

### Requirement: Never allow negative total

The system SHALL ensure the subtotal never becomes negative; if total discounts exceed subtotal, the result SHALL be 0 kopecks.

#### Scenario: Coupon exceeds subtotal
- **WHEN** subtotal is 50,000 kopecks and coupon is -100,000 kopecks fixed
- **THEN** subtotal after discount is 0 kopecks (not -50,000)

#### Scenario: Multiple coupons exceed subtotal
- **WHEN** subtotal is 50,000 kopecks and two coupons are -30,000 and -30,000
- **THEN** after first coupon: 20,000; after second: 0 (not negative)

### Requirement: Return detailed price breakdown

The system SHALL return a breakdown object showing original subtotal, tier discount, total coupon discount, shipping, and final total to pay.

#### Scenario: Complete breakdown
- **WHEN** subtotal is 100,000, tier discount is 10,000, coupon discount is 5,000, shipping is 4,900
- **THEN** system returns: subtotal=100,000, tierDiscountKopecks=10,000, couponDiscountKopecks=5,000, shippingKopecks=4,900, totalKopecks=89,900

### Requirement: Handle empty order

The system SHALL correctly process an order with no items (empty cart / no line items).

#### Scenario: Empty order
- **WHEN** order has zero items, no tier, no coupons
- **THEN** subtotal is 0, all discounts are 0, total is 0 (or shipping if applicable)

#### Scenario: Empty order with shipping
- **WHEN** order is empty but shipping applies (physical address)
- **THEN** total to pay is shipping cost only (0 for digital-only, flat rate otherwise)
