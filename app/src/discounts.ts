// Discount engine — built from docs/spec/pricing-discounts.md (decisions D-1..D-20).
// Pure and deterministic: the same (order, catalog, now) always yields the same
// breakdown, to the kopeck. All amounts are whole kopecks; the only place a
// fraction can appear is a percentage, and it is rounded away immediately (D-4).

import type { Order, Coupon } from "./types.js";
import {
  lineTotalKopecks,
  subtotalKopecks,
  shippingKopecks,
  tierPercent,
} from "./pricing.js";

export interface PriceBreakdown {
  /** Sum of line totals, before any discount. */
  subtotalKopecks: number;
  /** Loyalty-tier reduction actually applied. */
  tierDiscountKopecks: number;
  /** Sum of every promo-code reduction actually applied. */
  couponDiscountKopecks: number;
  /** Equal to shippingKopecks(order); never touched by discounts (D-2). */
  shippingKopecks: number;
  /** max(0, subtotal - tier - coupons) + shipping. Never negative (D-7). */
  totalKopecks: number;
  /** Codes that passed every gate AND reduced the total > 0, in application order (D-14). */
  appliedCoupons: string[];
}

/** D-4 / D-16: half-up rounding, pct clamped to [0, 100], junk value → 0. */
function percentOf(baseKopecks: number, percent: number): number {
  const pct = !Number.isFinite(percent) || percent <= 0 ? 0 : Math.min(percent, 100);
  return Math.round((baseKopecks * pct) / 100);
}

/** D-11: valid strictly before expiresAt; an unparseable date cannot prove validity. */
function isExpired(coupon: Coupon, now: Date): boolean {
  const expiry = Date.parse(coupon.expiresAt);
  return Number.isNaN(expiry) || now.getTime() >= expiry;
}

/** D-5: a category coupon's base is that category's own line-sum, unreduced by the tier. */
function categorySubtotalKopecks(order: Order, category: Coupon["category"]): number {
  return order.items
    .filter((i) => i.category === category)
    .reduce((sum, i) => sum + lineTotalKopecks(i), 0);
}

/**
 * @param order   the order; order.coupons are codes in the order the customer typed them
 * @param catalog available coupons (Coupon shape); unknown codes are ignored (D-9)
 * @param now     instant used to evaluate expiry; defaults to new Date() (D-11)
 */
export function priceOrder(order: Order, catalog: Coupon[], now: Date = new Date()): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const shipping = shippingKopecks(order);

  // D-19 / D-1 / D-2: tier first, off the raw goods subtotal. D-12: none → 0.
  const tierDiscount = percentOf(subtotal, tierPercent(order));

  // D-1 / D-7: one running remainder, floored at 0; every coupon subtracts from it.
  let remaining = Math.max(0, subtotal - tierDiscount);
  let couponDiscount = 0;
  const appliedCoupons: string[] = [];

  const byCode = new Map(catalog.map((c) => [c.code, c]));
  const seenCodes = new Set<string>(); // D-10
  const discountedCategories = new Set<NonNullable<Coupon["category"]>>(); // D-3

  for (const code of order.coupons) {
    if (seenCodes.has(code)) continue; // D-10: duplicate code counts once
    seenCodes.add(code);

    const coupon = byCode.get(code);
    if (!coupon) continue; // D-9: unknown code
    if (isExpired(coupon, now)) continue; // D-8 / D-11: expired code
    // D-6 / D-18: min-subtotal gate is checked against the pre-discount subtotal.
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) continue;
    // D-3: at most one coupon per category.
    if (coupon.category !== undefined && discountedCategories.has(coupon.category)) continue;

    // D-5: category coupons read the category line-sum; order-level ones read the remainder.
    const base =
      coupon.category !== undefined
        ? categorySubtotalKopecks(order, coupon.category)
        : remaining;

    let discount =
      coupon.kind === "percent"
        ? percentOf(base, coupon.value)
        : Math.max(0, Math.min(coupon.value, base)); // D-15: fixed amount, capped at its base
    discount = Math.min(discount, remaining); // D-7: never drive the remainder below 0

    if (discount <= 0) continue; // D-14 / D-17: a 0-effect coupon is not "applied"; no category slot taken

    remaining -= discount;
    couponDiscount += discount;
    appliedCoupons.push(code);
    if (coupon.category !== undefined) discountedCategories.add(coupon.category);
  }

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    shippingKopecks: shipping,
    totalKopecks: remaining + shipping, // D-2: shipping added on top, undiscounted
    appliedCoupons,
  };
}
