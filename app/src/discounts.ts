// Discount engine. Built from docs/spec/pricing-discounts.md — every rule here
// traces to a decision (D-n) and an acceptance criterion (AC-n) in that spec.
//
// MONEY: whole kopecks throughout. No floating-point arithmetic on amounts.
// Rounding is half-up, applied at each discount step (D-4).

import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

/** Why an entered code did not apply. Order matches the priority in D-14. */
export type CouponRejectionReason =
  | "unknown"
  | "expired"
  | "min_subtotal_not_met"
  | "category_absent"
  | "no_effect"
  | "not_best";

export interface RejectedCoupon {
  code: string;
  reason: CouponRejectionReason;
}

export interface PriceBreakdown {
  /** Goods total before any discount. */
  subtotalKopecks: number;
  /** Loyalty tier discount. */
  tierDiscountKopecks: number;
  /** Discount from the winning coupon; 0 when none applied. */
  couponDiscountKopecks: number;
  /** The code that applied, or null. */
  appliedCouponCode: string | null;
  /** Every entered code that did not apply, with one reason each (D-14). */
  rejectedCoupons: RejectedCoupon[];
  /** Never discounted (D-2). */
  shippingKopecks: number;
  /** Payable. Always >= 0 (D-7). */
  totalKopecks: number;
}

/**
 * Half-up percentage of an integer amount, without leaving integer arithmetic
 * (D-4). `Math.round(base * percent / 100)` would agree on typical amounts but
 * divides into a float first — exactly what the rounding rule forbids.
 */
function percentOf(base: number, percent: number): number {
  return Math.floor((base * percent + 50) / 100);
}

function categoryTotalKopecks(
  order: Order,
  category: LineItem["category"],
): number {
  return order.items
    .filter((i) => i.category === category)
    .reduce((sum, i) => sum + lineTotalKopecks(i), 0);
}

interface EligibilityRule {
  reason: CouponRejectionReason;
  rejects: (coupon: Coupon, order: Order, subtotal: number, now: Date) => boolean;
}

/**
 * Eligibility as ordered data rather than nested conditionals (design D-C):
 * the first rule that fires is the reported reason, so the D-14 priority is
 * visible in one place and cannot drift when a rule is added.
 */
const ELIGIBILITY_RULES: readonly EligibilityRule[] = [
  {
    // Valid strictly before expiresAt (D-11). A malformed date parses to NaN,
    // every comparison is false, and the coupon fails closed.
    reason: "expired",
    rejects: (coupon, _order, _subtotal, now) =>
      !(now.getTime() < Date.parse(coupon.expiresAt)),
  },
  {
    // Threshold is checked against the undiscounted subtotal (D-6).
    reason: "min_subtotal_not_met",
    rejects: (coupon, _order, subtotal) =>
      coupon.minSubtotalKopecks !== undefined &&
      subtotal < coupon.minSubtotalKopecks,
  },
  {
    reason: "category_absent",
    rejects: (coupon, order) =>
      coupon.category !== undefined &&
      !order.items.some((i) => i.category === coupon.category),
  },
];

/**
 * What the coupon bites into: the post-tier remainder, or — for a
 * category-scoped coupon — that category's total less its share of the tier
 * discount (D-5).
 */
function couponBaseKopecks(
  coupon: Coupon,
  order: Order,
  afterTier: number,
  tierPct: number,
): number {
  if (coupon.category === undefined) return afterTier;
  const categoryTotal = categoryTotalKopecks(order, coupon.category);
  return categoryTotal - percentOf(categoryTotal, tierPct);
}

function couponDiscountKopecks(
  coupon: Coupon,
  order: Order,
  afterTier: number,
  tierPct: number,
): number {
  const base = couponBaseKopecks(coupon, order, afterTier, tierPct);
  return coupon.kind === "percent"
    ? percentOf(base, coupon.value)
    : Math.min(coupon.value, base);
}

/**
 * Prices an order: loyalty tier first, then the single most valuable coupon on
 * the remainder (D-1, D-3). Pure — never throws, never reads the clock.
 *
 * @param catalogue every known coupon; matched on `code`, exactly (D-13)
 * @param now the instant expiry is judged against (D-11)
 */
export function priceOrder(
  order: Order,
  catalogue: Coupon[],
  now: Date,
): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const tierPct = tierPercent(order);
  const tierDiscount = percentOf(subtotal, tierPct);
  const afterTier = subtotal - tierDiscount;

  const rejected: RejectedCoupon[] = [];
  let best: { code: string; discount: number } | null = null;
  const seen = new Set<string>();

  for (const code of order.coupons) {
    if (seen.has(code)) continue; // duplicates count once (D-12)
    seen.add(code);

    const coupon = catalogue.find((c) => c.code === code);
    if (coupon === undefined) {
      rejected.push({ code, reason: "unknown" });
      continue;
    }

    const failed = ELIGIBILITY_RULES.find((rule) =>
      rule.rejects(coupon, order, subtotal, now),
    );
    if (failed !== undefined) {
      rejected.push({ code, reason: failed.reason });
      continue;
    }

    const discount = couponDiscountKopecks(coupon, order, afterTier, tierPct);
    if (discount === 0) {
      rejected.push({ code, reason: "no_effect" }); // D-16
      continue;
    }

    // Strictly greater keeps the earliest-entered winner on a tie (D-3).
    if (best === null || discount > best.discount) {
      if (best !== null) rejected.push({ code: best.code, reason: "not_best" });
      best = { code, discount };
    } else {
      rejected.push({ code, reason: "not_best" });
    }
  }

  // No second clamp against `afterTier` is needed. Every base is already
  // bounded by it: x - percentOf(x, p) is non-decreasing in x, so a category's
  // post-tier base can never exceed the order's. See design D-G.
  const couponDiscount = best === null ? 0 : best.discount;
  const shipping = shippingKopecks(order);

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    appliedCouponCode: best === null ? null : best.code,
    rejectedCoupons: rejected,
    shippingKopecks: shipping,
    totalKopecks: afterTier - couponDiscount + shipping,
  };
}
