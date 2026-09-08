## Why

Customers currently lack flexible discount mechanisms beyond tier-based loyalty. The business needs to launch promotional campaigns with coupon codes that combine with tier discounts, operate on specific product categories, and respect budget constraints (minimum order values, expiration dates). This requires a precise, unambiguous system that works reliably across millions of orders.

## What Changes

- **New pricing engine**: Implement sequential discount composition (tier loyalty + multiple coupons)
- **Coupon system**: Support percentage and fixed-amount coupons, category-specific targeting, minimum order thresholds, and expiration dates
- **Precise rounding**: Define single-point rounding at final subtotal to avoid penny/kopeck leakage
- **Edge case handling**: Clearly specify behavior for negative totals (floor at 0), expired coupons (silently ignored), and missing categories (no discount)
- **API contract**: Stable function signature and return type for price calculations

## Capabilities

### New Capabilities
- `pricing/discounts`: Discount engine combining tier loyalty and coupon codes with sequential application, category-specific targeting, and precise rounding rules

### Modified Capabilities
- (none - existing pricing functions remain stable)

## Impact

- **Code**: New `app/src/discounts.ts` module, tests in `app/src/pricing.test.ts`
- **APIs**: New `discountPrice()` function exported from pricing module
- **Breaking**: No - tier loyalty and shipping functions keep existing signatures
- **Checkout**: Frontend will pass coupon codes and receive `PriceBreakdown` with discount breakdown
- **Database**: Coupon table schema (not in scope for this feature - assumed to exist)
