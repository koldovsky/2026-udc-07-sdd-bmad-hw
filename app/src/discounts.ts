// Discount engine — loyalty tier + coupons.
//
// Normative source: docs/spec/pricing-discounts.md (decisions D-1..D-22).
// Behaviour contract: openspec/changes/add-pricing-discount-engine/specs/pricing/discounts/spec.md
//
// Every branch below cites the decision that put it there. If you find code
// here that cites nothing, it is unspecified behaviour and should be removed
// or promoted to a decision — see the reverse check in docs/traceability.md.
//
// MONEY: whole kopecks (integers) end to end. 1 грн = 100 копійок.

import type { Order, LineItem, Coupon } from "./types.js";
import { lineTotalKopecks, subtotalKopecks, shippingKopecks, tierPercent } from "./pricing.js";

/** Why a coupon the customer typed did not turn into money off. Order matches D-17. */
export type CouponRejectionReason =
  | "unknown" // no such code in the catalogue (D-10)
  | "duplicate_code" // the same code was entered more than once (D-11)
  | "invalid_value" // percent outside 0–100, fixed <= 0, unparseable expiresAt (D-13, D-21)
  | "expired" // now >= expiresAt (D-8, D-9)
  | "below_min_subtotal" // pre-discount subtotal below the coupon threshold (D-6)
  | "duplicate_scope" // a coupon already applied to this scope (D-3)
  | "no_matching_items"; // the discount base came out as 0 (D-12, D-14)

export interface AppliedCoupon {
  code: string;
  /** Money actually taken off, in whole kopecks, after capping to the remaining amount. */
  discountKopecks: number;
}

export interface RejectedCoupon {
  code: string;
  reason: CouponRejectionReason;
}

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierPercent: number;
  tierDiscountKopecks: number;
  /** Sum of discountKopecks across appliedCoupons. */
  couponDiscountKopecks: number;
  /** Goods after every discount. Never negative (D-7). */
  discountedGoodsKopecks: number;
  shippingKopecks: number;
  /** discountedGoodsKopecks + shippingKopecks. Never negative (D-7). */
  totalKopecks: number;
  /** In the order the customer typed them. */
  appliedCoupons: AppliedCoupon[];
  /** In the order the customer typed them. */
  rejectedCoupons: RejectedCoupon[];
}

/**
 * Half-up away from zero (D-4): 202.5 → 203, 202.4 → 202.
 *
 * Math.round would send -0.5 toward zero rather than away from it. Every
 * intermediate here is non-negative so the difference never bites, but the
 * code should say what the rule says instead of relying on that.
 */
export function roundKopecks(value: number): number {
  return Math.floor(value + 0.5);
}

/** A coupon's target: its category, or the whole order (D-3, design D-H). */
type Scope = LineItem["category"] | "ORDER";

/**
 * "ORDER" cannot collide with a real category: LineItem["category"] is the
 * closed union "standard" | "fresh" | "digital", so this is a compile-time
 * guarantee rather than a naming convention.
 */
const ORDER_SCOPE = "ORDER" as const;

function scopeOf(coupon: Coupon): Scope {
  return coupon.category ?? ORDER_SCOPE;
}

function categorySubtotalKopecks(order: Order, category: LineItem["category"]): number {
  return order.items
    .filter((i) => i.category === category)
    .reduce((sum, i) => sum + lineTotalKopecks(i), 0);
}

/**
 * Malformed catalogue data (D-13, D-21, D-23).
 *
 * The finiteness and integrality guards are not decoration. A NaN `value`
 * passes every ordinary range comparison, and a fractional `fixed` value is
 * subtracted verbatim — either one propagates into the returned amounts and
 * breaks the "every field is a non-negative integer" invariant of AC-20.
 * `percent` may legitimately be fractional (7.5%): roundKopecks absorbs it.
 */
function isInvalid(coupon: Coupon): boolean {
  if (!Number.isFinite(coupon.value)) return true; // D-23
  if (coupon.kind === "percent" && (coupon.value < 0 || coupon.value > 100)) return true; // D-13
  if (coupon.kind === "fixed" && coupon.value <= 0) return true; // D-13
  if (coupon.kind === "fixed" && !Number.isInteger(coupon.value)) return true; // D-23
  // D-21: an unparseable expiresAt is a data defect, not an expiry. Checked
  // here so it reports as invalid_value rather than silently reading as expired
  // (every comparison against NaN is false).
  if (Number.isNaN(Date.parse(coupon.expiresAt))) return true;
  return false;
}

/**
 * Prices an order: loyalty tier first, then coupons in the order the customer
 * typed them, each against what is left (D-1).
 *
 * Never throws, for any input (D-8). Unusable coupons come back in
 * `rejectedCoupons` with a reason.
 *
 * @param order the order being priced; `order.coupons` is in entry order.
 * @param catalog every coupon the system knows. Matched by exact code; on
 *   duplicate codes the first entry wins (D-22).
 * @param now the instant to evaluate expiry against (D-9). Explicit so the
 *   expiresAt boundary is testable without faking the clock.
 */
export function priceOrder(order: Order, catalog: Coupon[], now: Date = new Date()): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const percent = tierPercent(order);

  // Single accumulator: monotonically non-increasing, so "never negative"
  // (D-7) and the AC-20 balance hold by construction rather than by cleanup.
  let remaining = subtotal;

  // Step 1 — loyalty tier, against the full subtotal (D-1, D-2, D-15).
  // The Math.min cap is unreachable while the tier ceiling is 10%, but D-7
  // states the cap over *every* discount, not just coupons. Kept so the code
  // says the rule rather than relying on tierPercent staying below 100.
  const tierDiscount = Math.min(remaining, roundKopecks((subtotal * percent) / 100));
  remaining -= tierDiscount;

  const applied: AppliedCoupon[] = [];
  const rejected: RejectedCoupon[] = [];
  const seenCodes = new Set<string>();
  const usedScopes = new Set<Scope>();

  const nowMs = now.getTime();

  // Step 2 — coupons, in entry order, each against what is left (D-1, D-18).
  for (const code of order.coupons) {
    // Checks run in the fixed order of D-17: a coupon can fail more than one,
    // and without a fixed order the reported reason would be an accident.

    const coupon = catalog.find((c) => c.code === code); // D-22: first match wins
    if (coupon === undefined) {
      rejected.push({ code, reason: "unknown" }); // D-10
      continue;
    }

    if (seenCodes.has(code)) {
      rejected.push({ code, reason: "duplicate_code" }); // D-11
      continue;
    }
    seenCodes.add(code);

    if (isInvalid(coupon)) {
      rejected.push({ code, reason: "invalid_value" }); // D-13, D-21
      continue;
    }

    if (nowMs >= Date.parse(coupon.expiresAt)) {
      rejected.push({ code, reason: "expired" }); // D-8, D-9
      continue;
    }

    // D-6: threshold is measured against the PRE-discount subtotal, inclusively.
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      rejected.push({ code, reason: "below_min_subtotal" });
      continue;
    }

    const scope = scopeOf(coupon);
    if (usedScopes.has(scope)) {
      rejected.push({ code, reason: "duplicate_scope" }); // D-3
      continue;
    }

    // D-5: a category coupon discounts that category's share of what is left.
    // Scaling rather than a per-line ledger keeps the result independent of
    // line ordering (design D-G).
    const base =
      coupon.category === undefined
        ? remaining
        : subtotal === 0
          ? 0
          : roundKopecks((categorySubtotalKopecks(order, coupon.category) * remaining) / subtotal);

    if (base === 0) {
      rejected.push({ code, reason: "no_matching_items" }); // D-12, D-14
      continue;
    }

    const raw = coupon.kind === "percent" ? roundKopecks((base * coupon.value) / 100) : coupon.value;

    // Capped at the base and at what is left, so the goods total floors at 0
    // and shipping is never eaten into (D-7).
    const discount = Math.min(raw, base, remaining);

    remaining -= discount;
    usedScopes.add(scope);
    // Note the deliberate asymmetry with the base === 0 branch above: a
    // non-zero base that rounds down to a 0 discount still counts as applied
    // and still consumes the scope, because the coupon did match (design D-I).
    applied.push({ code, discountKopecks: discount });
  }

  // Step 3 — shipping, from the ORIGINAL order, added after everything (D-2, D-16).
  const shipping = shippingKopecks(order);

  return {
    subtotalKopecks: subtotal,
    tierPercent: percent,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: applied.reduce((sum, a) => sum + a.discountKopecks, 0),
    discountedGoodsKopecks: remaining,
    shippingKopecks: shipping,
    totalKopecks: remaining + shipping,
    appliedCoupons: applied,
    rejectedCoupons: rejected,
  };
}



