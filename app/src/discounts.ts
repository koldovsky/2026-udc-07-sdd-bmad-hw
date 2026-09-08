// Discount engine: loyalty tier + coupon codes. Every branch here traces
// back to a decision in docs/spec/pricing-discounts.md (D-#) and its
// acceptance criterion (AC-#) — see docs/traceability.md.

import type { Order, Coupon, LineItem } from "./types.js";
import { lineTotalKopecks, subtotalKopecks, shippingKopecks, tierPercent } from "./pricing.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  /** Combined tier + coupon discount, 0..subtotalKopecks. Not split by source (D-15). */
  discountKopecks: number;
  /** Coupon codes that actually applied, deduplicated, in typed order. */
  appliedCoupons: string[];
  shippingKopecks: number;
  totalKopecks: number;
}

function resolveValidCoupons(order: Order, coupons: Coupon[], now: Date): Coupon[] {
  const byCode = new Map(coupons.map((c) => [c.code, c]));
  const subtotal = subtotalKopecks(order);
  const seen = new Set<string>();
  const valid: Coupon[] = [];

  for (const typedCode of order.coupons) {
    if (seen.has(typedCode)) continue; // D-11: duplicate code applies once
    const coupon = byCode.get(typedCode); // D-14: exact, case-sensitive match
    if (!coupon) continue; // D-9: unknown code
    if (now >= new Date(coupon.expiresAt)) continue; // D-8, D-13
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) continue; // D-6
    seen.add(typedCode);
    valid.push(coupon);
  }

  return valid;
}

/** Combined percent (capped at 100%, D-12) + combined fixed amount for one bucket. */
function bucketDiscountKopecks(base: number, extraPercent: number, coupons: Coupon[]): number {
  const percent = Math.min(
    100,
    extraPercent + coupons.filter((c) => c.kind === "percent").reduce((sum, c) => sum + c.value, 0),
  );
  const fixed = coupons.filter((c) => c.kind === "fixed").reduce((sum, c) => sum + c.value, 0);
  return Math.floor((base * percent) / 100) + fixed; // D-4: floor once per bucket
}

function categorySubtotalKopecks(order: Order, category: LineItem["category"]): number {
  return order.items.filter((i) => i.category === category).reduce((sum, i) => sum + lineTotalKopecks(i), 0);
}

export function priceOrder(order: Order, coupons: Coupon[], now: Date = new Date()): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const validCoupons = resolveValidCoupons(order, coupons, now);

  const orderWideCoupons = validCoupons.filter((c) => c.category === undefined);
  const orderWideDiscount = bucketDiscountKopecks(subtotal, tierPercent(order), orderWideCoupons); // D-1, D-2

  const categories = new Set(
    validCoupons.map((c) => c.category).filter((category): category is LineItem["category"] => category !== undefined),
  );
  let categoryDiscount = 0;
  for (const category of categories) {
    const couponsForCategory = validCoupons.filter((c) => c.category === category);
    categoryDiscount += bucketDiscountKopecks(categorySubtotalKopecks(order, category), 0, couponsForCategory); // D-5, D-10
  }

  const discountKopecks = Math.min(subtotal, orderWideDiscount + categoryDiscount); // D-7
  const shipping = shippingKopecks(order); // D-2: never discounted

  return {
    subtotalKopecks: subtotal,
    discountKopecks,
    appliedCoupons: validCoupons.map((c) => c.code),
    shippingKopecks: shipping,
    totalKopecks: subtotal - discountKopecks + shipping,
  };
}
