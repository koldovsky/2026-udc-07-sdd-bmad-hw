// Discount engine — loyalty tier + coupons, built from
// docs/spec/pricing-discounts.md (decision table D-1…D-18, criteria AC-1…AC-14).
//
// Pure function, no state. All money is integer kopecks. Rounding is a
// specification decision (D-4), not invented here.

import type { Order, Coupon, LineItem } from "./types.js";
import { subtotalKopecks, lineTotalKopecks, tierPercent, shippingKopecks } from "./pricing.js";

export interface PriceBreakdown {
  /** Items subtotal before any discount. subtotalKopecks(order). */
  subtotalKopecks: number;
  /** Loyalty-tier discount, in kopecks, already rounded (D-4). */
  tierDiscountKopecks: number;
  /** Combined discount from ALL applied coupons, in kopecks (D-1, D-3). */
  couponDiscountKopecks: number;
  /** From shippingKopecks(order); never discounted (D-2). */
  shippingKopecks: number;
  /** max(0, subtotal - tierDiscount - couponDiscount) (D-7) + shipping. */
  totalKopecks: number;
}

/**
 * Round to a whole kopeck. Exactly half a kopeck rounds DOWN (D-4), in favour
 * of the amount payable. Integer-only: no floating-point accumulation of money.
 */
function roundHalfDown(numeratorKopecks: number, denominator: number): number {
  const whole = Math.floor(numeratorKopecks / denominator);
  const remainder = numeratorKopecks % denominator;
  // remainder*2 > denominator  → strictly more than half → round up
  // remainder*2 === denominator → exactly half → stay (round down, D-4)
  return remainder * 2 > denominator ? whole + 1 : whole;
}

/** Sum of line totals for items of a given category (D-5 category base). */
function categorySubtotalKopecks(items: LineItem[], category: LineItem["category"]): number {
  return items
    .filter((i) => i.category === category)
    .reduce((sum, i) => sum + lineTotalKopecks(i), 0);
}

/**
 * A coupon applies only if ALL of its stated conditions hold at once (D-18):
 *   - not expired: now strictly before expiresAt (D-17)
 *   - the ORIGINAL subtotal reaches minSubtotalKopecks, inclusive (D-6, D-11)
 *   - for a category coupon, the order actually contains that category
 * Any failure is a silent skip — contributes 0, never throws (D-5, D-8, D-9).
 */
function isCouponApplicable(coupon: Coupon, order: Order, originalSubtotal: number, now: Date): boolean {
  if (now.getTime() >= new Date(coupon.expiresAt).getTime()) return false;
  if (coupon.minSubtotalKopecks !== undefined && originalSubtotal < coupon.minSubtotalKopecks) {
    return false;
  }
  if (coupon.category !== undefined && categorySubtotalKopecks(order.items, coupon.category) === 0) {
    return false;
  }
  return true;
}

/**
 * Resolve the customer-typed codes to coupon definitions.
 * - exact, case-sensitive string match, no trimming (D-16)
 * - a code with no definition in the catalogue is dropped (D-9)
 * - a repeated code counts once, keeping the first occurrence's position (D-10, D-3)
 */
function resolveCoupons(codes: string[], catalogue: Coupon[]): Coupon[] {
  const seen = new Set<string>();
  const resolved: Coupon[] = [];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    const def = catalogue.find((c) => c.code === code);
    if (def) resolved.push(def);
  }
  return resolved;
}

/**
 * Price an order: loyalty tier first, then every valid coupon in the order the
 * customer typed them, each applied to what is left after the previous step
 * (D-1, D-3). Two parallel counters (D-15): the order-wide remainder `R` and a
 * per-category remainder `C[cat]`. An order-wide discount takes its base from
 * `R`; a category coupon from `C[cat]`. Either way the amount actually taken is
 * also capped by `R`, so the items total never goes below 0 (D-7, D-12).
 */
export function priceOrder(order: Order, coupons: Coupon[], now: Date = new Date()): PriceBreakdown {
  const subtotal = subtotalKopecks(order);

  // Loyalty tier — order-wide, applied to the items subtotal (D-1, D-2).
  // tierPercent is 0/5/10, so this can never exceed the subtotal.
  const tierDiscount = roundHalfDown(subtotal * tierPercent(order), 100);

  let orderRemainder = subtotal - tierDiscount;

  // Per-category remainders. Tier is order-wide, so it does NOT touch these (D-15).
  const categoryRemainder = new Map<LineItem["category"], number>();
  for (const item of order.items) {
    if (!categoryRemainder.has(item.category)) {
      categoryRemainder.set(item.category, categorySubtotalKopecks(order.items, item.category));
    }
  }

  let couponDiscount = 0;
  for (const coupon of resolveCoupons(order.coupons, coupons)) {
    if (!isCouponApplicable(coupon, order, subtotal, now)) continue;

    const scoped = coupon.category !== undefined;
    const base = scoped ? categoryRemainder.get(coupon.category!) ?? 0 : orderRemainder;

    const nominal =
      coupon.kind === "percent" ? roundHalfDown(base * coupon.value, 100) : coupon.value;

    // Capped by its own base AND by what is left in the order overall (D-7, D-12, D-15).
    const actual = Math.max(0, Math.min(nominal, base, orderRemainder));

    orderRemainder -= actual;
    if (scoped) categoryRemainder.set(coupon.category!, base - actual);
    couponDiscount += actual;
  }

  const shipping = shippingKopecks(order);
  const totalKopecks = Math.max(0, subtotal - tierDiscount - couponDiscount) + shipping;

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    shippingKopecks: shipping,
    totalKopecks,
  };
}
