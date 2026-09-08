import type { Order, Coupon } from "./types.js";
import { subtotalKopecks, shippingKopecks, tierPercent } from "./pricing.js";

/**
 * Price breakdown after applying all discounts.
 * All amounts are whole kopecks (1 грн = 100 kopecks).
 */
export interface PriceBreakdown {
  /** Original order subtotal (items only) */
  subtotalKopecks: number;
  /** Discount from customer tier loyalty */
  tierDiscountKopecks: number;
  /** Total discount from all applied coupons */
  couponDiscountKopecks: number;
  /** Shipping cost (not affected by discounts) */
  shippingKopecks: number;
  /** Final total to pay: subtotal - tierDiscount - couponDiscount + shipping */
  totalKopecks: number;
}

/**
 * Calculate price with tier and coupon discounts.
 *
 * DESIGN DECISIONS (from feature-request.md):
 *
 * 1. Tier + Coupon combination: SEQUENTIAL
 *    - Tier discount applied to full subtotal first
 *    - Coupons applied one-by-one to the remaining subtotal
 *    - Rationale: "Customer has benefit from both" means sequential, not additive
 *
 * 2. Discount base: SUBTOTAL ONLY (items, excluding shipping)
 *    - Shipping is a separate service cost, not merchandise
 *
 * 3. Multiple coupons: ALL APPLIED, in order given
 *    - Expired coupons silently skipped
 *    - Later coupons operate on the remaining subtotal
 *
 * 4. Category coupons: Calculate from category items ONLY
 *    - Percentage applied to sum of that category
 *    - When multiple category coupons on same category, second applies to remainder
 *    - Discount is clamped to not exceed remaining global subtotal
 *
 * 5. Minimum subtotal: Checked at coupon evaluation time
 *    - Against current subtotal (after tier, before coupon)
 *    - Coupon with unmet minimum is silently skipped
 *
 * 6. Rounding: STANDARD rounding per discount operation
 *    - Math.round(amount * percent / 100) for each discount
 *    - This is how most code systems handle kopeck arithmetic
 *
 * 7. Floor: Subtotal cannot go below 0
 *    - If discounts exceed subtotal, final is 0
 *    - Shipping still added
 *
 * 8. Expired coupon: SILENT skip
 *    - No error, just ignored
 *    - Checked via: expiresAt <= today (not valid on or after expiry date)
 */
export function discountPrice(
  order: Order,
  coupons: Coupon[],
  today: string = new Date().toISOString().split("T")[0]
): PriceBreakdown {
  const originalSubtotal = subtotalKopecks(order);
  let workingSubtotal = originalSubtotal;

  // Step 1: Apply tier loyalty discount to full subtotal
  const tierPercent_ = tierPercent(order);
  const tierDiscount = Math.round(workingSubtotal * (tierPercent_ / 100));
  workingSubtotal -= tierDiscount;

  // Step 2: Apply coupons sequentially
  let totalCouponDiscount = 0;

  // Track cumulative discounts per category to handle multiple category coupons correctly
  const categoryDiscountAccum = new Map<string | undefined, number>();

  for (const coupon of coupons) {
    // Skip expired coupons (not valid on or after expiresAt date)
    if (coupon.expiresAt <= today) {
      continue;
    }

    // Check minimum subtotal requirement against current state
    if (
      coupon.minSubtotalKopecks !== undefined &&
      workingSubtotal < coupon.minSubtotalKopecks
    ) {
      continue;
    }

    // Determine the base amount for calculating discount
    let base: number;

    if (coupon.category) {
      // Category coupon: calculate from sum of items in that category only
      base = order.items
        .filter((item) => item.category === coupon.category)
        .reduce((sum, item) => sum + item.unitPriceKopecks * item.quantity, 0);

      // Adjust for any discounts already applied to this category
      // (in case we have multiple coupons targeting the same category)
      const alreadyApplied = categoryDiscountAccum.get(coupon.category) || 0;
      base = Math.max(0, base - alreadyApplied);
    } else {
      // Global coupon: apply to current working subtotal
      base = workingSubtotal;
    }

    // Calculate discount amount from base
    let discountAmount: number;
    if (coupon.kind === "percent") {
      discountAmount = Math.round(base * (coupon.value / 100));
    } else {
      // fixed coupon: direct kopeck amount
      discountAmount = coupon.value;
    }

    // Clamp discount to not exceed remaining working subtotal
    discountAmount = Math.min(discountAmount, workingSubtotal);

    // Apply the discount to the working subtotal
    workingSubtotal -= discountAmount;
    totalCouponDiscount += discountAmount;

    // Track discount for this category (needed for next category coupon)
    if (coupon.category) {
      const prev = categoryDiscountAccum.get(coupon.category) || 0;
      categoryDiscountAccum.set(coupon.category, prev + discountAmount);
    }
  }

  // Ensure we never go negative (safety check)
  workingSubtotal = Math.max(0, workingSubtotal);

  // Shipping is never affected by discounts
  const shipping = shippingKopecks(order);

  return {
    subtotalKopecks: originalSubtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: totalCouponDiscount,
    shippingKopecks: shipping,
    totalKopecks: workingSubtotal + shipping,
  };
}
