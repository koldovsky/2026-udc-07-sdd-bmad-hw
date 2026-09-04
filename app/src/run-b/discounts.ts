import type { Coupon, LineItem, Order } from "../types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "../pricing.js";

export type CouponRejectReason =
  | "unknown"
  | "expired"
  | "below-minimum"
  | "duplicate"
  | "no-eligible-remaining";

export interface RejectedCoupon {
  code: string;
  reason: CouponRejectReason;
}

export interface AppliedCoupon {
  code: string;
  discountKopecks: number;
}

export interface PriceBreakdown {
  subtotalKopecks: number;
  shippingKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  merchandiseKopecks: number;
  totalKopecks: number;
  appliedCoupons: AppliedCoupon[];
  rejectedCoupons: RejectedCoupon[];
}

type Category = LineItem["category"];

const CATEGORIES: readonly Category[] = ["standard", "fresh", "digital"];

/**
 * Percent of an integer kopeck amount. Truncates toward zero so a half-kopeck
 * never rounds up. `amount * percent / 100` stays in integer arithmetic.
 */
export function percentOfKopecks(amountKopecks: number, percent: number): number {
  if (amountKopecks <= 0 || percent <= 0) return 0;
  const capped = percent > 100 ? 100 : percent;
  return Math.trunc((amountKopecks * capped) / 100);
}

export function priceOrder(
  order: Order,
  catalog: readonly Coupon[],
  now: Date = new Date(),
): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const shipping = shippingKopecks(order);
  const remaining = emptyRemaining();

  for (const item of order.items) {
    remaining[item.category] += lineTotalKopecks(item);
  }

  const tierPct = tierPercent(order);
  const tierDiscountKopecks = applyPercent(remaining, tierPct);

  const byCode = indexCatalog(catalog);
  const seen = new Set<string>();
  const appliedCoupons: AppliedCoupon[] = [];
  const rejectedCoupons: RejectedCoupon[] = [];

  for (const code of order.coupons) {
    if (seen.has(code)) {
      rejectedCoupons.push({ code, reason: "duplicate" });
      continue;
    }
    seen.add(code);

    const coupon = byCode.get(code);
    if (!coupon) {
      rejectedCoupons.push({ code, reason: "unknown" });
      continue;
    }

    if (isExpired(coupon, now)) {
      rejectedCoupons.push({ code, reason: "expired" });
      continue;
    }

    if (
      coupon.minSubtotalKopecks !== undefined &&
      subtotal < coupon.minSubtotalKopecks
    ) {
      rejectedCoupons.push({ code, reason: "below-minimum" });
      continue;
    }

    const discount =
      coupon.kind === "percent"
        ? applyPercent(remaining, coupon.value, coupon.category)
        : applyFixed(remaining, coupon.value, coupon.category, categoryOrder(order));

    if (discount <= 0) {
      rejectedCoupons.push({ code, reason: "no-eligible-remaining" });
      continue;
    }

    appliedCoupons.push({ code, discountKopecks: discount });
  }

  const couponDiscountKopecks = appliedCoupons.reduce(
    (sum, c) => sum + c.discountKopecks,
    0,
  );
  const merchandiseKopecks = remainingTotal(remaining);

  return {
    subtotalKopecks: subtotal,
    shippingKopecks: shipping,
    tierDiscountKopecks,
    couponDiscountKopecks,
    merchandiseKopecks,
    totalKopecks: merchandiseKopecks + shipping,
    appliedCoupons,
    rejectedCoupons,
  };
}

function emptyRemaining(): Record<Category, number> {
  return { standard: 0, fresh: 0, digital: 0 };
}

function remainingTotal(remaining: Record<Category, number>): number {
  return remaining.standard + remaining.fresh + remaining.digital;
}

function indexCatalog(catalog: readonly Coupon[]): Map<string, Coupon> {
  const map = new Map<string, Coupon>();
  for (const coupon of catalog) {
    if (!map.has(coupon.code)) map.set(coupon.code, coupon);
  }
  return map;
}

function isExpired(coupon: Coupon, now: Date): boolean {
  const expires = Date.parse(coupon.expiresAt);
  if (Number.isNaN(expires)) return true;
  return now.getTime() >= expires;
}

function categoryOrder(order: Order): Category[] {
  const seen = new Set<Category>();
  const orderSeen: Category[] = [];
  for (const item of order.items) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      orderSeen.push(item.category);
    }
  }
  for (const cat of CATEGORIES) {
    if (!seen.has(cat)) orderSeen.push(cat);
  }
  return orderSeen;
}

function applyPercent(
  remaining: Record<Category, number>,
  percent: number,
  category?: Category,
): number {
  if (category !== undefined) {
    const discount = percentOfKopecks(remaining[category], percent);
    remaining[category] -= discount;
    return discount;
  }

  let total = 0;
  for (const cat of CATEGORIES) {
    const discount = percentOfKopecks(remaining[cat], percent);
    remaining[cat] -= discount;
    total += discount;
  }
  return total;
}

function applyFixed(
  remaining: Record<Category, number>,
  amountKopecks: number,
  category: Category | undefined,
  drainOrder: readonly Category[],
): number {
  if (amountKopecks <= 0) return 0;

  if (category !== undefined) {
    const discount = Math.min(amountKopecks, remaining[category]);
    remaining[category] -= discount;
    return discount;
  }

  let left = amountKopecks;
  let total = 0;
  for (const cat of drainOrder) {
    const take = Math.min(left, remaining[cat]);
    remaining[cat] -= take;
    left -= take;
    total += take;
    if (left === 0) break;
  }
  return total;
}
