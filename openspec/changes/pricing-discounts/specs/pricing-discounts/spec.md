## Purpose
This capability calculates the final pricing for an order, applying tier-based and coupon-based discounts sequentially while preventing negative totals and ensuring correct rounding.

## ADDED Requirements

### Requirement: Tier discounts
The system SHALL apply a percentage discount based on the customer's loyalty tier. Gold tier receives 10%, Silver receives 5%, others 0%.

#### Scenario: Gold tier discount (AC-1)
- **WHEN** the order is 100000 kopecks for a gold tier customer (10%) and 4900 shipping, with no coupons
- **THEN** a 10% discount is applied, resulting in: `{subtotalKopecks: 100000, tierDiscountKopecks: 10000, couponDiscountKopecks: 0, shippingKopecks: 4900, totalKopecks: 94900}`

#### Scenario: Rounding on half kopeck (AC-6)
- **WHEN** the order is 10010 kopecks for a silver tier customer (5%)
- **THEN** the discount is mathematically rounded to the nearest whole kopeck, resulting in 501 kopecks.

### Requirement: Coupon discounts
The system SHALL apply valid coupons in the order they are provided, calculated from the remaining subtotal after the tier discount.

#### Scenario: Multiple sequential coupons (AC-3)
- **WHEN** order is 100000 kopecks and has coupons: 10% on all, and 5000 fixed
- **THEN** they apply sequentially (100000 -> 90000 after 10% -> 85000 after 5000 fixed), giving a total coupon discount of 15000.

#### Scenario: Min subtotal threshold (AC-7)
- **WHEN** a coupon specifies `minSubtotalKopecks` of 100000 on an order originally 100000 but reduced by silver tier
- **THEN** the coupon is applied successfully based on the original subtotal.

### Requirement: Category specific coupons
The system SHALL apply category-specific coupons only to the original value of items matching that category.

#### Scenario: Category coupon calculation (AC-8)
- **WHEN** a category coupon of 20% for "digital" is used, and a general fixed 1000 coupon, on an order with 50000 "digital" and 50000 "standard" for UA
- **THEN** the category discount is calculated based on the 50000 original amount, resulting in 10000 discount, for a total coupon discount of 11000, and result: `{subtotalKopecks: 100000, tierDiscountKopecks: 0, couponDiscountKopecks: 11000, shippingKopecks: 4900, totalKopecks: 93900}`.

#### Scenario: Category coupon fixed amount capped (AC-9)
- **WHEN** a category coupon provides a fixed discount of 50000 kopecks for "digital", but the "digital" items original subtotal is only 30000 kopecks
- **THEN** the discount is capped at the category's original subtotal of 30000 kopecks.

### Requirement: Negative total prevention
The system SHALL ensure the subtotal never drops below 0 kopecks after discounts.

#### Scenario: Discount exceeds subtotal (AC-4)
- **WHEN** order subtotal is 100000 kopecks and fixed coupon is 200000 kopecks
- **THEN** the total discount is capped at the subtotal, leaving 0 for items plus 4900 shipping, resulting in: `{subtotalKopecks: 100000, tierDiscountKopecks: 0, couponDiscountKopecks: 100000, shippingKopecks: 4900, totalKopecks: 4900}`

#### Scenario: Empty order (AC-5)
- **WHEN** the order contains no items
- **THEN** subtotal is 0, discount is 0, and total is 0.

### Requirement: Invalid coupon handling
The system SHALL ignore expired or invalid coupons silently.

#### Scenario: Expired coupon (AC-2)
- **WHEN** check occurs at 2026-09-09T00:00:00Z on a 100000 kopeck order, and a 10000 fixed coupon expired at 2026-09-08T00:00:00Z is provided
- **THEN** it is ignored, resulting in: `{subtotalKopecks: 100000, tierDiscountKopecks: 0, couponDiscountKopecks: 0, shippingKopecks: 4900, totalKopecks: 104900}`
