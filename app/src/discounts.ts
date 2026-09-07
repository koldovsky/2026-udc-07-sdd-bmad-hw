import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

/** All fields are whole kopecks, >= 0. */
export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  /** Sum of every applied coupon; not a per-code split. */
  couponDiscountKopecks: number;
  /** Goods after tier and coupons. */
  remainingGoodsKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

function percentToKopecks(amount: number, percent: number): number {
  const product = amount * percent;
  const q = Math.trunc(product / 100);
  const r = product % 100;
  return r >= 50 ? q + 1 : q;
}

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

function categorySubtotal(order: Order, category: LineItem["category"]): number {
  return order.items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + lineTotalKopecks(item), 0);
}

function resolveTypedCoupons(order: Order, catalog: Coupon[]): Coupon[] {
  const seen = new Set<string>();
  const resolved: Coupon[] = [];
  for (const typed of order.coupons) {
    const key = normalizeCode(typed);
    if (key === "") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const match = catalog.find((c) => normalizeCode(c.code) === key);
    if (match) resolved.push(match);
  }
  return resolved;
}

function isExpired(coupon: Coupon, asOf: Date): boolean {
  const expiresMs = Date.parse(coupon.expiresAt);
  if (Number.isNaN(expiresMs)) return true;
  return asOf.getTime() >= expiresMs;
}

/**
 * Prices an order using the algorithm in docs/spec/pricing-discounts.md §3.
 * `order.coupons` are codes the customer typed. `catalog` is what exists.
 * `asOf` is the expiry clock; this function does not call Date.now().
 * Never throws because of coupons.
 */
export function priceOrder(
  order: Order,
  catalog: Coupon[],
  asOf: Date,
): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const shipping = shippingKopecks(order);

  let remaining = subtotal;
  const tierDiscount = percentToKopecks(remaining, tierPercent(order));
  remaining -= tierDiscount;

  let couponDiscount = 0;
  for (const coupon of resolveTypedCoupons(order, catalog)) {
    if (isExpired(coupon, asOf)) continue;
    if (
      coupon.minSubtotalKopecks !== undefined &&
      subtotal < coupon.minSubtotalKopecks
    ) {
      continue;
    }
    if (
      coupon.category !== undefined &&
      !order.items.some((item) => item.category === coupon.category)
    ) {
      continue;
    }

    const categoryBase =
      coupon.category !== undefined
        ? categorySubtotal(order, coupon.category)
        : remaining;
    const raw =
      coupon.kind === "percent"
        ? percentToKopecks(categoryBase, coupon.value)
        : coupon.value;
    const applied = Math.min(raw, categoryBase, remaining);
    couponDiscount += applied;
    remaining -= applied;
  }

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    remainingGoodsKopecks: remaining,
    shippingKopecks: shipping,
    totalKopecks: remaining + shipping,
  };
}
