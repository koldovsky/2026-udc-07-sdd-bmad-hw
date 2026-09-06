// Discount engine. Implements docs/discount-spec.md — every decision the
// feature request left open is closed there, and the D-numbers in the comments
// below point at the clause that justifies the code.
//
// All amounts are whole kopecks (1 грн = 100 копійок). No floats for money.

import type { Coupon, LineItem, Order } from "./types.js";
import { lineTotalKopecks, subtotalKopecks, shippingKopecks, tierPercent } from "./pricing.js";

/** Why a typed coupon did not apply. Order of evaluation is fixed by D10. */
export type CouponRejectionReason =
  | "unknown-code"
  | "duplicate-code"
  | "expired"
  | "below-min-subtotal"
  | "scope-conflict"
  | "no-effect";

export interface RejectedCoupon {
  code: string;
  reason: CouponRejectionReason;
}

export interface AppliedDiscount {
  source: "tier" | "coupon";
  /** Coupon code, absent for the tier discount. */
  code?: string;
  /** Human-readable label for the receipt line. */
  label: string;
  /** The remaining goods value this discount was computed from, in kopecks. */
  baseKopecks: number;
  /** The discount itself, in kopecks. Always > 0 — see D10 `no-effect`. */
  amountKopecks: number;
}

export interface PriceBreakdown {
  subtotalKopecks: number;
  discounts: AppliedDiscount[];
  totalDiscountKopecks: number;
  /** Goods after discounts. Never negative (D9). */
  discountedSubtotalKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
  /** Every coupon that did not apply, with its reason (D8). Never thrown. */
  rejectedCoupons: RejectedCoupon[];
}

/** A coupon's scope: its category, or the whole order. One coupon each (D4). */
export type CouponScope = LineItem["category"] | "order";

export function couponScope(coupon: Coupon): CouponScope {
  return coupon.category ?? "order";
}

/**
 * Round half-up to whole kopecks (D3). Inputs here are non-negative money, so
 * "half up" and "half away from zero" coincide.
 */
export function roundHalfUpKopecks(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Split `amount` across `weights` so the parts sum to exactly `amount` (D3).
 * Largest-remainder: floor each share, then hand the leftover kopecks to the
 * largest fractional remainders, ties broken by position.
 */
export function allocateByLargestRemainder(amount: number, weights: readonly number[]): number[] {
  const shares = new Array<number>(weights.length).fill(0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (amount <= 0 || totalWeight <= 0) return shares;

  const remainders: { index: number; remainder: number }[] = [];
  let assigned = 0;
  for (let i = 0; i < weights.length; i++) {
    const weight = weights[i] ?? 0;
    const exactNumerator = amount * weight;
    const share = Math.floor(exactNumerator / totalWeight);
    shares[i] = share;
    assigned += share;
    remainders.push({ index: i, remainder: exactNumerator - share * totalWeight });
  }

  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let leftover = amount - assigned;
  for (let k = 0; k < remainders.length && leftover > 0; k++, leftover--) {
    const index = remainders[k]?.index ?? 0;
    shares[index] = (shares[index] ?? 0) + 1;
  }
  return shares;
}

/** A line and how much of its value is still discountable (D2 — sequential). */
interface RemainingLine {
  category: LineItem["category"];
  remainingKopecks: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0; // D11
  return Math.min(100, Math.max(0, value));
}

function clampFixed(value: number): number {
  if (!Number.isFinite(value)) return 0; // D11
  return Math.max(0, value);
}

function isExpired(coupon: Coupon, now: Date): boolean {
  const expiresAt = Date.parse(coupon.expiresAt);
  if (Number.isNaN(expiresAt)) return true; // fail closed (D8)
  return now.getTime() >= expiresAt;
}

/**
 * Charge `amount` against the eligible lines, capped at what they have left,
 * and return what was actually taken (D6, D9).
 */
function chargeLines(lines: RemainingLine[], eligible: number[], amount: number): number {
  const weights = eligible.map((i) => lines[i]?.remainingKopecks ?? 0);
  const base = weights.reduce((sum, w) => sum + w, 0);
  const charged = Math.min(amount, base);
  const shares = allocateByLargestRemainder(charged, weights);
  for (let k = 0; k < eligible.length; k++) {
    const index = eligible[k] ?? 0;
    const line = lines[index];
    if (line) line.remainingKopecks -= shares[k] ?? 0;
  }
  return charged;
}

function eligibleIndexes(lines: RemainingLine[], scope: CouponScope): number[] {
  const indexes: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (scope === "order" || line.category === scope) indexes.push(i);
  }
  return indexes;
}

function baseOf(lines: RemainingLine[], indexes: readonly number[]): number {
  return indexes.reduce((sum, i) => sum + (lines[i]?.remainingKopecks ?? 0), 0);
}

/**
 * Price an order: tier discount, then coupons, then shipping.
 *
 * Pure and total — it never throws on bad customer input. Coupons that do not
 * apply come back in `rejectedCoupons` so checkout can tell the customer why
 * (D8).
 *
 * @param catalog every coupon the system knows about; codes typed by the
 *   customer are looked up here, and anything missing is `unknown-code`.
 * @param now the instant expiry is judged against (D8). Defaults to real time.
 */
export function quoteOrder(
  order: Order,
  catalog: readonly Coupon[] = [],
  now: Date = new Date(),
): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const lines: RemainingLine[] = order.items.map((item) => ({
    category: item.category,
    remainingKopecks: lineTotalKopecks(item),
  }));

  const discounts: AppliedDiscount[] = [];
  const rejectedCoupons: RejectedCoupon[] = [];

  // --- Tier first (D2), against goods only (D1) -----------------------------
  const percent = tierPercent(order);
  if (percent > 0) {
    const allLines = eligibleIndexes(lines, "order");
    const base = baseOf(lines, allLines);
    const amount = chargeLines(lines, allLines, roundHalfUpKopecks((base * percent) / 100));
    if (amount > 0) {
      discounts.push({
        source: "tier",
        label: `${order.customerTier} tier −${percent}%`,
        baseKopecks: base,
        amountKopecks: amount,
      });
    }
  }

  // --- Then coupons, in the order the customer typed them (D2) --------------
  const byCode = new Map(catalog.map((c) => [c.code, c]));
  const seenCodes = new Set<string>();
  const claimedScopes = new Set<CouponScope>();

  for (const code of order.coupons) {
    const coupon = byCode.get(code);

    // D10 — first matching reason wins.
    if (!coupon) {
      rejectedCoupons.push({ code, reason: "unknown-code" });
      continue;
    }
    if (seenCodes.has(code)) {
      rejectedCoupons.push({ code, reason: "duplicate-code" });
      continue;
    }
    seenCodes.add(code);

    if (isExpired(coupon, now)) {
      rejectedCoupons.push({ code, reason: "expired" });
      continue;
    }
    // D7 — measured against the untouched items subtotal.
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      rejectedCoupons.push({ code, reason: "below-min-subtotal" });
      continue;
    }
    const scope = couponScope(coupon);
    if (claimedScopes.has(scope)) {
      rejectedCoupons.push({ code, reason: "scope-conflict" });
      continue;
    }

    // D5 — a category coupon sees only its own category's remaining value.
    const eligible = eligibleIndexes(lines, scope);
    const base = baseOf(lines, eligible);
    const requested =
      coupon.kind === "percent"
        ? roundHalfUpKopecks((base * clampPercent(coupon.value)) / 100)
        : clampFixed(coupon.value);
    const amount = chargeLines(lines, eligible, requested);

    if (amount <= 0) {
      // Nothing changed, so the scope stays free for a later coupon (D4, D10).
      rejectedCoupons.push({ code, reason: "no-effect" });
      continue;
    }

    claimedScopes.add(scope);
    discounts.push({
      source: "coupon",
      code: coupon.code,
      label:
        coupon.kind === "percent"
          ? `${coupon.code} −${clampPercent(coupon.value)}%`
          : `${coupon.code} −${clampFixed(coupon.value)} kopecks`,
      baseKopecks: base,
      amountKopecks: amount,
    });
  }

  const totalDiscount = discounts.reduce((sum, d) => sum + d.amountKopecks, 0);
  const discountedSubtotal = lines.reduce((sum, l) => sum + l.remainingKopecks, 0);
  const shipping = shippingKopecks(order); // D1 — never discounted

  return {
    subtotalKopecks: subtotal,
    discounts,
    totalDiscountKopecks: totalDiscount,
    discountedSubtotalKopecks: discountedSubtotal,
    shippingKopecks: shipping,
    totalKopecks: discountedSubtotal + shipping,
    rejectedCoupons,
  };
}
