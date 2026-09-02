// Discount engine: loyalty tier + stackable promo codes.
//
// All money is whole kopecks. Every intermediate value stays an integer so no
// fractional kopeck can ever survive into a later step and drift.

import type { Coupon, LineItem, Order } from "../types.js";
import { lineTotalKopecks, shippingKopecks, subtotalKopecks, tierPercent } from "../pricing.js";

export type DiscountSource = "tier" | "coupon";

export interface AppliedDiscount {
  source: DiscountSource;
  /** Coupon code, or the tier name for the loyalty discount. */
  code: string;
  amountKopecks: number;
}

export type RejectionReason =
  | "unknown-code"
  | "expired"
  | "duplicate"
  | "below-minimum-subtotal"
  | "no-matching-items"
  | "nothing-left-to-discount"
  | "invalid-coupon";

export interface RejectedCoupon {
  code: string;
  reason: RejectionReason;
}

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  totalDiscountKopecks: number;
  /** Subtotal after every discount. Never negative. */
  discountedSubtotalKopecks: number;
  shippingKopecks: number;
  /** discountedSubtotal + shipping. */
  totalKopecks: number;
  appliedDiscounts: AppliedDiscount[];
  rejectedCoupons: RejectedCoupon[];
}

export type CouponCatalog = readonly Coupon[] | ReadonlyMap<string, Coupon>;

/** Rounds a non-negative rational to the nearest kopeck, halves away from zero. */
export function roundKopecks(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

function lookup(catalog: CouponCatalog, code: string): Coupon | undefined {
  const key = code.trim().toUpperCase();
  if (catalog instanceof Map) {
    return (catalog as ReadonlyMap<string, Coupon>).get(key);
  }
  return (catalog as readonly Coupon[]).find((c) => c.code.trim().toUpperCase() === key);
}

function isExpired(coupon: Coupon, now: Date): boolean {
  const expiry = Date.parse(coupon.expiresAt);
  if (Number.isNaN(expiry)) return true;
  // "not valid on or after this instant"
  return now.getTime() >= expiry;
}

function isStructurallyValid(coupon: Coupon): boolean {
  if (!Number.isFinite(coupon.value) || coupon.value < 0) return false;
  if (coupon.kind === "percent" && coupon.value > 100) return false;
  if (coupon.kind === "fixed" && !Number.isInteger(coupon.value)) return false;
  return true;
}

/**
 * Splits `amount` across `weights` so the parts are integers that sum exactly to
 * `amount`. Largest-remainder method: no kopeck is created or lost.
 */
function allocate(amount: number, weights: readonly number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  const parts = weights.map(() => 0);
  if (total <= 0 || amount <= 0) return parts;

  const remainders: { index: number; frac: number }[] = [];
  let assigned = 0;
  weights.forEach((w, i) => {
    const exact = (amount * w) / total;
    const floored = Math.floor(exact);
    parts[i] = floored;
    assigned += floored;
    remainders.push({ index: i, frac: exact - floored });
  });

  remainders.sort((a, b) => b.frac - a.frac || a.index - b.index);
  let leftover = amount - assigned;
  for (const r of remainders) {
    if (leftover <= 0) break;
    if ((parts[r.index] ?? 0) >= (weights[r.index] ?? 0)) continue;
    parts[r.index] = (parts[r.index] ?? 0) + 1;
    leftover -= 1;
  }
  return parts;
}

interface Charge {
  item: LineItem;
  /** How much of this line is still discountable. */
  remaining: number;
}

function eligibleIndexes(charges: readonly Charge[], category?: LineItem["category"]): number[] {
  const out: number[] = [];
  charges.forEach((c, i) => {
    if (category !== undefined && c.item.category !== category) return;
    out.push(i);
  });
  return out;
}

function remainingOf(charges: readonly Charge[], indexes: readonly number[]): number {
  return indexes.reduce((s, i) => s + (charges[i]?.remaining ?? 0), 0);
}

/**
 * Consumes `amount` from the given lines and returns what was actually taken.
 * Never drives a line below zero.
 */
function consume(charges: Charge[], indexes: readonly number[], amount: number): number {
  const pool = remainingOf(charges, indexes);
  const take = Math.min(Math.max(amount, 0), pool);
  if (take === 0) return 0;
  const parts = allocate(
    take,
    indexes.map((i) => charges[i]?.remaining ?? 0),
  );
  indexes.forEach((chargeIndex, k) => {
    const charge = charges[chargeIndex];
    if (!charge) return;
    charge.remaining -= parts[k] ?? 0;
  });
  return take;
}

/**
 * Prices an order: loyalty tier first, then every valid coupon in the order the
 * customer typed it, each applied to what is left of the goods.
 *
 * @param now Evaluation instant for coupon expiry. Defaults to the current time.
 */
export function priceOrder(
  order: Order,
  catalog: CouponCatalog = [],
  now: Date = new Date(),
): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const shipping = shippingKopecks(order);
  const charges: Charge[] = order.items.map((item) => ({
    item,
    remaining: lineTotalKopecks(item),
  }));

  const applied: AppliedDiscount[] = [];
  const rejected: RejectedCoupon[] = [];

  // 1. Loyalty tier — applies to the whole goods subtotal, before any coupon.
  const percent = tierPercent(order);
  let tierDiscount = 0;
  if (percent > 0 && subtotal > 0) {
    const all = eligibleIndexes(charges);
    tierDiscount = consume(charges, all, roundKopecks((subtotal * percent) / 100));
    if (tierDiscount > 0) {
      applied.push({ source: "tier", code: order.customerTier, amountKopecks: tierDiscount });
    }
  }

  // 2. Coupons — sequential, each on the remaining value of the eligible lines.
  const seen = new Set<string>();
  let couponDiscount = 0;

  for (const raw of order.coupons) {
    const code = raw.trim().toUpperCase();
    const coupon = lookup(catalog, raw);

    if (!coupon) {
      rejected.push({ code, reason: "unknown-code" });
      continue;
    }
    if (seen.has(code)) {
      rejected.push({ code, reason: "duplicate" });
      continue;
    }
    if (!isStructurallyValid(coupon)) {
      rejected.push({ code, reason: "invalid-coupon" });
      continue;
    }
    if (isExpired(coupon, now)) {
      rejected.push({ code, reason: "expired" });
      continue;
    }
    // Minimum is a gate on the order the customer placed, so it is checked
    // against the undiscounted subtotal and never moves as discounts stack.
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      rejected.push({ code, reason: "below-minimum-subtotal" });
      continue;
    }

    const indexes = eligibleIndexes(charges, coupon.category);
    if (indexes.length === 0) {
      rejected.push({ code, reason: "no-matching-items" });
      continue;
    }

    const base = remainingOf(charges, indexes);
    if (base <= 0) {
      rejected.push({ code, reason: "nothing-left-to-discount" });
      continue;
    }

    const wanted =
      coupon.kind === "percent" ? roundKopecks((base * coupon.value) / 100) : coupon.value;
    const taken = consume(charges, indexes, wanted);

    seen.add(code);
    if (taken > 0) {
      couponDiscount += taken;
      applied.push({ source: "coupon", code: coupon.code, amountKopecks: taken });
    }
  }

  const totalDiscount = tierDiscount + couponDiscount;
  const discountedSubtotal = subtotal - totalDiscount;

  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    totalDiscountKopecks: totalDiscount,
    discountedSubtotalKopecks: discountedSubtotal,
    shippingKopecks: shipping,
    totalKopecks: discountedSubtotal + shipping,
    appliedDiscounts: applied,
    rejectedCoupons: rejected,
  };
}

