import type { Order, Coupon } from "./types.js";
import { subtotalKopecks, shippingKopecks, tierPercent } from "./pricing.js";

/**
 * Detailed price breakdown after applying tier discount and coupons.
 * All amounts are whole kopecks (1 грн = 100 kopecks).
 */
export interface PriceBreakdown {
  /** Original order subtotal (items only) */
  subtotalKopecks: number;
  /** Discount from customer tier loyalty */
  tierDiscountKopecks: number;
  /** Total discount from all coupons applied sequentially */
  couponDiscountKopecks: number;
  /** Shipping cost (not included in discounts) */
  shippingKopecks: number;
  /** Total to pay: subtotal - tierDiscount - couponDiscount + shipping (≥ 0) */
  totalKopecks: number;
}

/**
 * Calculate final price with tier loyalty and coupon discounts.
 *
 * Applies discounts sequentially: tier first, then each coupon in order.
 * Each coupon operates on the subtotal remaining after previous discounts.
 *
 * Rounding: performed once at the final subtotal (0.5 → 1, standard rounding).
 * Negative totals: clamped to 0 kopecks.
 * Expired coupons: silently ignored.
 * Minimum subtotal: checked before applying each coupon against current subtotal.
 *
 * @param order Order with items and tier
 * @param coupons Array of coupon objects from the database (not codes, actual coupons)
 * @param today ISO date for expiration check (defaults to today)
 * @returns Price breakdown with final total ≥ 0
 */
export function discountPrice(
  order: Order,
  coupons: Coupon[],
  today: string = new Date().toISOString().split("T")[0]
): PriceBreakdown {
  const original = subtotalKopecks(order);
  let currentSubtotal = original;

  // Apply tier discount
  const tierPct = tierPercent(order);
  const tierDiscount = Math.round(currentSubtotal * (tierPct / 100));
  currentSubtotal -= tierDiscount;

  // Track category adjustments for sequential application
  const categoryAdjustments = new Map<string | undefined, number>();

  // Apply coupons sequentially
  let totalCouponDiscount = 0;

  for (const coupon of coupons) {
    // Skip expired coupons
    if (coupon.expiresAt <= today) {
      continue;
    }

    // Check minimum subtotal requirement
    if (coupon.minSubtotalKopecks !== undefined && currentSubtotal < coupon.minSubtotalKopecks) {
      continue;
    }

    // Calculate base for this coupon
    let base = currentSubtotal;
    if (coupon.category) {
      // Category-specific: calculate from sum of items in that category,
      // adjusted for previous discounts on this category
      base = order.items
        .filter((item) => item.category === coupon.category)
        .reduce((sum, item) => sum + item.unitPriceKopecks * item.quantity, 0);

      // Subtract any adjustments already made to this category
      const categoryAdjustment = categoryAdjustments.get(coupon.category) || 0;
      base = Math.max(0, base - categoryAdjustment);
    }

    // Apply coupon
    let couponDiscount = 0;
    if (coupon.kind === "percent") {
      couponDiscount = Math.round(base * (coupon.value / 100));
    } else {
      // fixed
      couponDiscount = coupon.value;
    }

    // Apply coupon to current subtotal
    couponDiscount = Math.min(couponDiscount, currentSubtotal);
    currentSubtotal -= couponDiscount;
    totalCouponDiscount += couponDiscount;

    // Track adjustment for category if applicable
    if (coupon.category) {
      const prev = categoryAdjustments.get(coupon.category) || 0;
      categoryAdjustments.set(coupon.category, prev + couponDiscount);
    }
  }

  // Ensure subtotal never goes negative
  if (currentSubtotal < 0) {
    currentSubtotal = 0;
  }

  // Shipping is not affected by discounts
  const shipping = shippingKopecks(order);

  return {
    subtotalKopecks: original,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: totalCouponDiscount,
    shippingKopecks: shipping,
    totalKopecks: currentSubtotal + shipping,
  };
}
