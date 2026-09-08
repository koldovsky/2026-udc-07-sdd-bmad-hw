// Discount engine. Built on top of pricing.ts without changing it — see
// docs/spec/pricing-discounts.md for the decisions (D-1..D-13) this encodes.

import type { Order, Coupon, LineItem } from "./types.js";
import { subtotalKopecks, shippingKopecks, tierPercent } from "./pricing.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

export interface CouponError {
  code: string;
  message: string;
}

export interface PriceResult {
  breakdown: PriceBreakdown;
  couponErrors: CouponError[];
}

// AC-9: every intermediate step is floored to a whole kopeck immediately,
// not just the final total — otherwise fractional kopecks would silently
// carry through the next step's math.
function percentOf(amountKopecks: number, percent: number): number {
  return Math.floor((amountKopecks * percent) / 100);
}

function formatHryvnia(kopecks: number): string {
  const hryvnia = Math.floor(kopecks / 100);
  const kop = kopecks % 100;
  return kop === 0 ? `${hryvnia} грн` : `${hryvnia} грн ${kop} коп`;
}

// D-9: the calendar day of expiresAt is still valid; the coupon expires at
// the start of the following day, not at expiresAt's own timestamp.
function isCouponExpired(coupon: Coupon, now: Date): boolean {
  const expiry = new Date(coupon.expiresAt);
  const startOfDayAfterExpiry = Date.UTC(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth(),
    expiry.getUTCDate() + 1,
  );
  return now.getTime() >= startOfDayAfterExpiry;
}

function categorySubtotalKopecks(order: Order, category: LineItem["category"]): number {
  return order.items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.unitPriceKopecks * item.quantity, 0);
}

export function priceOrder(order: Order, coupons: Coupon[]): PriceResult {
  const base = subtotalKopecks(order);

  // D-1: tier discount applies to the full subtotal first, coupons apply to
  // the remainder — percentages never simply add up.
  const tierDiscountKopecks = percentOf(base, tierPercent(order));
  let remaining = base - tierDiscountKopecks;

  const now = new Date();
  const couponErrors: CouponError[] = [];
  const validCoupons: Coupon[] = [];

  // D-6/D-8/D-13: minSubtotal, expiry and unknown codes are checked against
  // the order's own coupon list up front; a failure on one code never blocks
  // the others in the same request (D-10).
  for (const code of order.coupons) {
    const coupon = coupons.find((c) => c.code === code);
    if (!coupon) {
      couponErrors.push({ code, message: `Промокод ${code} не знайдено` });
      continue;
    }
    if (isCouponExpired(coupon, now)) {
      couponErrors.push({ code, message: `Промокод ${code} прострочено` });
      continue;
    }
    if (coupon.minSubtotalKopecks !== undefined && base < coupon.minSubtotalKopecks) {
      couponErrors.push({
        code,
        message: `Сума товару у кошику менша за мінімальну суму (${formatHryvnia(
          coupon.minSubtotalKopecks,
        )}) для цього промокоду`,
      });
      continue;
    }
    validCoupons.push(coupon);
  }

  // D-3: fixed coupons apply before percent ones, regardless of entry order;
  // within a kind, entry order (order.coupons) is preserved.
  let couponDiscountKopecks = 0;
  const categoryRemaining = new Map<LineItem["category"], number>();

  for (const kind of ["fixed", "percent"] as const) {
    for (const coupon of validCoupons.filter((c) => c.kind === kind)) {
      let availableBase: number;
      if (coupon.category) {
        // D-12: the category base is the category's own subtotal minus only
        // previously-applied same-category coupons — the tier discount is
        // never redistributed across categories.
        if (!categoryRemaining.has(coupon.category)) {
          categoryRemaining.set(coupon.category, categorySubtotalKopecks(order, coupon.category));
        }
        availableBase = categoryRemaining.get(coupon.category)!;
      } else {
        availableBase = remaining;
      }

      const discount =
        coupon.kind === "fixed"
          ? Math.min(coupon.value, availableBase)
          : percentOf(availableBase, coupon.value);

      if (coupon.category) {
        categoryRemaining.set(coupon.category, availableBase - discount);
      }
      remaining -= discount;
      couponDiscountKopecks += discount;
    }
  }

  // D-7: the amount owed for items has a floor of 0.
  const itemsTotalKopecks = Math.max(0, remaining);
  const shipping = shippingKopecks(order);

  return {
    breakdown: {
      subtotalKopecks: base,
      tierDiscountKopecks,
      couponDiscountKopecks,
      shippingKopecks: shipping,
      totalKopecks: itemsTotalKopecks + shipping,
    },
    couponErrors,
  };
}
