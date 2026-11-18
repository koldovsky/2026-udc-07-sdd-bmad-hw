// Order discount engine. Amounts are whole kopecks. Rules live in
// docs/spec/pricing-discounts.md — tier, then coupons, shipping never discounted.

import type { Coupon, LineItem, Order } from "./types.js";
import { shippingKopecks, subtotalKopecks, tierPercent } from "./pricing.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

/** D-4: floor(amount * percent / 100) for non-negative integers. */
function floorPercent(amountKopecks: number, percent: number): number {
  const product = amountKopecks * percent;
  return (product - (product % 100)) / 100;
}

function foldCode(code: string): string {
  return code.trim().toLowerCase();
}

function categorySubtotalKopecks(order: Order, category: LineItem["category"]): number {
  return subtotalKopecks({
    ...order,
    items: order.items.filter((item) => item.category === category),
  });
}

interface Competitor {
  discountKopecks: number;
  expiresAtMs: number;
  typedIndex: number;
}

function prefers(candidate: Competitor, current: Competitor): boolean {
  if (candidate.discountKopecks !== current.discountKopecks) {
    return candidate.discountKopecks > current.discountKopecks;
  }
  if (candidate.expiresAtMs !== current.expiresAtMs) {
    return candidate.expiresAtMs < current.expiresAtMs;
  }
  return candidate.typedIndex < current.typedIndex;
}

function couponBaseKopecks(
  order: Order,
  coupon: Coupon,
  tier: number,
  afterTierKopecks: number,
): number {
  if (coupon.category === undefined) return afterTierKopecks;
  const categorySubtotal = categorySubtotalKopecks(order, coupon.category);
  return categorySubtotal - floorPercent(categorySubtotal, tier);
}

function couponAmountKopecks(coupon: Coupon, baseKopecks: number): number {
  if (coupon.kind === "fixed") return Math.min(coupon.value, baseKopecks);
  return floorPercent(baseKopecks, coupon.value);
}

export function priceOrder(order: Order, coupons: Coupon[], now?: Date): PriceBreakdown {
  const clock = now ?? new Date();
  const subtotal = subtotalKopecks(order);
  const tier = tierPercent(order);
  const tierDiscount = floorPercent(subtotal, tier);
  const afterTier = subtotal - tierDiscount;
  const shipping = shippingKopecks(order);

  const catalog = new Map<string, Coupon>();
  for (const coupon of coupons) {
    const key = foldCode(coupon.code);
    if (!catalog.has(key)) catalog.set(key, coupon);
  }

  const seen = new Set<string>();
  const winners = new Map<string, Competitor>();

  order.coupons.forEach((typed, typedIndex) => {
    const key = foldCode(typed);
    if (seen.has(key)) return;
    seen.add(key);

    const coupon = catalog.get(key);
    if (coupon === undefined) return;

    const expiresAtMs = new Date(coupon.expiresAt).getTime();
    if (!(clock.getTime() < expiresAtMs)) return;

    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      return;
    }

    const base = couponBaseKopecks(order, coupon, tier, afterTier);
    const candidate: Competitor = {
      discountKopecks: couponAmountKopecks(coupon, base),
      expiresAtMs,
      typedIndex,
    };
    const scope = coupon.category === undefined ? "order" : `category:${coupon.category}`;
    const current = winners.get(scope);
    if (current === undefined || prefers(candidate, current)) winners.set(scope, candidate);
  });

  let couponDiscount = 0;
  for (const winner of winners.values()) couponDiscount += winner.discountKopecks;
  if (couponDiscount > afterTier) couponDiscount = afterTier;

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    shippingKopecks: shipping,
    totalKopecks: subtotal - tierDiscount - couponDiscount + shipping,
  };
}
