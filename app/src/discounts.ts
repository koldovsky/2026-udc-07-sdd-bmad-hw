// Discount engine — loyalty tiers and promo codes.
//
// Every behaviour here is specified in docs/spec/pricing-discounts.md, with the
// reason it was chosen. The D-n markers below point at that decision table; the
// AC-n ids live in discounts.test.ts. Nothing in this file decides anything the
// specification did not.
//
// MONEY: whole kopecks (integers). No floating-point arithmetic on amounts.

import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

/** Why a code the customer typed did not reduce the total. */
export type CouponRejectionReason =
  /** D-9: the catalog has no such code. */
  | "unknown"
  /** D-8, D-11: the evaluation instant is at or after `expiresAt`. */
  | "expired"
  /** D-6: the gross item subtotal has not reached `minSubtotalKopecks`. */
  | "below-min-subtotal"
  /** D-14: the same code was already entered. */
  | "duplicate-code"
  /** D-3: another coupon already discounted this scope. */
  | "duplicate-scope"
  /** D-15: the coupon's scope carries no amount to discount. */
  | "no-eligible-items";

export interface AppliedCoupon {
  code: string;
  /** D-12: the discount actually granted, after clamping — not the face value. */
  discountKopecks: number;
}

export interface RejectedCoupon {
  code: string;
  reason: CouponRejectionReason;
}

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  /** D-18: the sum of `appliedCoupons[].discountKopecks`. */
  couponDiscountKopecks: number;
  appliedCoupons: AppliedCoupon[];
  rejectedCoupons: RejectedCoupon[];
  shippingKopecks: number;
  totalKopecks: number;
}

type Category = LineItem["category"];

/** The scope a coupon competes for: the whole order, or one category (D-3). */
type Scope = Category | "order";

/**
 * D-4: round a percentage of `base` to whole kopecks, half away from zero.
 * Integer arithmetic only — `base` and `percent` are integers, so
 * `base * percent + 50` is exact and the division is the only inexact step,
 * which `Math.floor` then resolves.
 */
function roundHalfUp(base: number, percent: number): number {
  return Math.floor((base * percent + 50) / 100);
}

/** D-5: item totals per category. */
function categorySubtotals(order: Order): Map<Category, number> {
  const totals = new Map<Category, number>();
  for (const item of order.items) {
    totals.set(item.category, (totals.get(item.category) ?? 0) + lineTotalKopecks(item));
  }
  return totals;
}

/**
 * Price an order: loyalty tier first, then the coupons the customer typed.
 *
 * Pure (D-17) — it does not modify `order` or `catalog`, read a clock, or throw
 * (D-8). `catalog` resolves the codes in `order.coupons`, which are strings;
 * `now` decides expiry (D-11).
 */
export function priceOrder(order: Order, catalog: Coupon[], now: Date): PriceBreakdown {
  // Reused from pricing.ts — a protected contract, not reimplemented here.
  const subtotal = subtotalKopecks(order);
  const shipping = shippingKopecks(order);
  const percent = tierPercent(order);

  // D-2, D-16: the tier applies to the whole item subtotal, every category
  // included, and never to shipping.
  const tierDiscount = roundHalfUp(subtotal, percent);

  // D-1: coupons work on what the tier left, not on the original subtotal.
  let remaining = subtotal - tierDiscount;

  // D-5a: each category's base comes from its own subtotal, independently —
  // NOT allocated out of `tierDiscount`, which would need an arbitrary order
  // and leave a stray kopeck in whichever category went last. These figures are
  // only ever bases and caps; they are never reported.
  const categoryBase = new Map<Category, number>();
  for (const [category, categoryTotal] of categorySubtotals(order)) {
    categoryBase.set(category, categoryTotal - roundHalfUp(categoryTotal, percent));
  }

  const appliedCoupons: AppliedCoupon[] = [];
  const rejectedCoupons: RejectedCoupon[] = [];
  const seenCodes = new Set<string>();
  const usedScopes = new Set<Scope>();

  // D-13: in the order the customer typed them, which types.ts guarantees.
  for (const code of order.coupons) {
    if (seenCodes.has(code)) {
      rejectedCoupons.push({ code, reason: "duplicate-code" }); // D-14
      continue;
    }
    seenCodes.add(code);

    // D-10: exact, case-sensitive match — normalization belongs to the input
    // layer. D-9: an unresolvable code is a named refusal, not silence.
    const coupon = catalog.find((candidate) => candidate.code === code);
    if (coupon === undefined) {
      rejectedCoupons.push({ code, reason: "unknown" });
      continue;
    }

    // D-8, D-11: not valid on or after `expiresAt`.
    if (now.getTime() >= Date.parse(coupon.expiresAt)) {
      rejectedCoupons.push({ code, reason: "expired" });
      continue;
    }

    // D-6: judged on the gross subtotal, before any discount, inclusively.
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      rejectedCoupons.push({ code, reason: "below-min-subtotal" });
      continue;
    }

    // D-3: at most one coupon per scope.
    const scope: Scope = coupon.category ?? "order";
    if (usedScopes.has(scope)) {
      rejectedCoupons.push({ code, reason: "duplicate-scope" });
      continue;
    }

    const base =
      coupon.category === undefined ? remaining : (categoryBase.get(coupon.category) ?? 0);

    // D-15: nothing to discount is a refusal, not an "applied" 0 грн.
    if (base <= 0) {
      rejectedCoupons.push({ code, reason: "no-eligible-items" });
      continue;
    }

    // D-12: a fixed coupon clamps to its scope; D-7: nothing exceeds what is
    // left of the order.
    const raw =
      coupon.kind === "percent" ? roundHalfUp(base, coupon.value) : Math.min(coupon.value, base);
    const discount = Math.min(raw, remaining);

    remaining -= discount;
    if (coupon.category !== undefined) {
      categoryBase.set(coupon.category, base - discount);
    }
    usedScopes.add(scope);
    appliedCoupons.push({ code, discountKopecks: discount });
  }

  const couponDiscount = appliedCoupons.reduce((sum, applied) => sum + applied.discountKopecks, 0);

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    appliedCoupons,
    rejectedCoupons,
    shippingKopecks: shipping,
    // D-7: the item amount floors at 0, and shipping is still charged.
    totalKopecks: Math.max(0, subtotal - tierDiscount - couponDiscount) + shipping,
  };
}
