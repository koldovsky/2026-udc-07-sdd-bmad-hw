import { lineTotalKopecks, shippingKopecks, subtotalKopecks, tierPercent } from "./pricing.js";
import type { Coupon, Order } from "./types.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

function roundedPercent(base: number, percent: number): number {
  return Number((BigInt(base) * BigInt(percent) + 50n) / 100n);
}

function couponAmount(coupon: Coupon, order: Order, subtotal: number): number {
  const base = coupon.category === undefined
    ? subtotal
    : order.items
        .filter((item) => item.category === coupon.category)
        .reduce((sum, item) => sum + lineTotalKopecks(item), 0);
  const requested = coupon.kind === "fixed" ? coupon.value : roundedPercent(base, coupon.value);
  return Math.min(base, requested);
}

function bestCouponDiscount(order: Order, coupons: readonly Coupon[], subtotal: number, nowMs: number): number {
  const catalog = new Map(coupons.map((coupon) => [coupon.code, coupon]));
  let bestDiscount = 0;

  for (const code of order.coupons) {
    const coupon = catalog.get(code);
    if (!coupon || nowMs >= Date.parse(coupon.expiresAt) || subtotal < (coupon.minSubtotalKopecks ?? 0)) {
      continue;
    }

    const discount = couponAmount(coupon, order, subtotal);
    // Keep the earliest entered coupon when discounts tie.
    if (discount > bestDiscount) bestDiscount = discount;
  }

  return bestDiscount;
}

export function priceOrder(order: Order, coupons: readonly Coupon[], nowMs: number): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const couponDiscount = bestCouponDiscount(order, coupons, subtotal, nowMs);
  const remaining = subtotal - couponDiscount;
  const tierDiscount = roundedPercent(remaining, tierPercent(order));
  const shipping = shippingKopecks(order);

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    shippingKopecks: shipping,
    totalKopecks: remaining - tierDiscount + shipping,
  };
}
