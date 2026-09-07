import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

export interface PriceBreakdown {
  /** Original merchandise, === subtotalKopecks(order). */
  subtotalKopecks: number;
  /** Sum of per-line tier discounts. */
  tierDiscountKopecks: number;
  /** Sum of all applied coupons (skipped codes contribute 0). */
  couponDiscountKopecks: number;
  /** === shippingKopecks(order). */
  shippingKopecks: number;
  /** Sum of line remainders + shippingKopecks. Always ≥ shippingKopecks. */
  totalKopecks: number;
}

function percentOffKopecks(remaining: number, percent: number): number {
  const d = Math.floor((remaining * percent + 50) / 100);
  return Math.min(d, remaining);
}

function isEligible(line: LineItem, coupon: Coupon): boolean {
  return coupon.category === undefined || line.category === coupon.category;
}

export function priceOrder(
  order: Order,
  catalog: Coupon[],
  nowIso: string,
): PriceBreakdown {
  const remaining = order.items.map((item) => lineTotalKopecks(item));
  const subtotal = subtotalKopecks(order);
  const percent = tierPercent(order);
  let tierDiscount = 0;

  if (percent > 0) {
    for (const [i, lineRemaining] of remaining.entries()) {
      const d = percentOffKopecks(lineRemaining, percent);
      remaining[i] = lineRemaining - d;
      tierDiscount += d;
    }
  }

  let couponDiscount = 0;
  const seen = new Set<string>();

  for (const code of order.coupons) {
    if (seen.has(code)) continue;
    seen.add(code);

    const coupon = catalog.find((c) => c.code === code);
    if (!coupon) continue;

    const tNow = Date.parse(nowIso);
    const tExp = Date.parse(coupon.expiresAt);
    if (Number.isNaN(tNow) || Number.isNaN(tExp) || tNow >= tExp) continue;

    if (
      coupon.minSubtotalKopecks !== undefined &&
      subtotal < coupon.minSubtotalKopecks
    ) {
      continue;
    }

    if (coupon.kind === "percent") {
      if (!Number.isInteger(coupon.value) || coupon.value < 0 || coupon.value > 100) {
        continue;
      }
      for (const [i, line] of order.items.entries()) {
        if (!isEligible(line, coupon)) continue;
        const lineRemaining = remaining[i];
        if (lineRemaining === undefined) continue;
        const d = percentOffKopecks(lineRemaining, coupon.value);
        remaining[i] = lineRemaining - d;
        couponDiscount += d;
      }
      continue;
    }

    if (coupon.kind === "fixed") {
      if (!Number.isInteger(coupon.value) || coupon.value < 0) continue;
      let need = coupon.value;
      for (const [i, line] of order.items.entries()) {
        if (!isEligible(line, coupon)) continue;
        const lineRemaining = remaining[i];
        if (lineRemaining === undefined) continue;
        const take = Math.min(lineRemaining, need);
        remaining[i] = lineRemaining - take;
        need -= take;
        couponDiscount += take;
        if (need === 0) break;
      }
    }
  }

  const shipping = shippingKopecks(order);
  const merchandiseAfter = remaining.reduce((sum, line) => sum + line, 0);

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    shippingKopecks: shipping,
    totalKopecks: merchandiseAfter + shipping,
  };
}
