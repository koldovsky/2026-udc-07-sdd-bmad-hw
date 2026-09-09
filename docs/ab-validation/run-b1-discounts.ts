// ============================================================================
// Task D — Run B1 ARTIFACT, preserved verbatim. NOT production code.
//
// Produced by an agent given only materials/feature-request.md (no spec),
// in an isolated worktree at commit c339625. Kept as evidence for the
// comparison table in docs/ab-validation.md. Nothing in app/ imports this,
// and docs/ is outside app/tsconfig.json's include, so it never compiles
// or runs as part of the project.
//
// PROVENANCE CAVEAT: this run read the main repo's app/src/index.ts through
// an absolute path, which already carried Task C's export names. Its
// contract shape is therefore NOT independent evidence; its resolution of
// the business forks is (it never read the spec or the implementation).
// See docs/ab-validation.md § Provenance. Run B2 repeats it under tighter
// isolation.
// ============================================================================

// Discount engine: loyalty tiers + coupons.
//
// All money is whole kopecks (1 грн = 100 копійок). No floating-point amounts:
// every intermediate value below is an integer number of kopecks.
//
// The feature request left a number of forks open. The decisions taken here are
// listed explicitly so each one is testable (AC ids match `discounts.test.ts`):
//
// AC-1  Tier discount base .... the ITEMS subtotal only. Shipping is never
//       discounted, by tier or by coupon.
// AC-2  Stacking .............. SEQUENTIAL, not additive. Tier applies first to
//       the items subtotal; every coupon then applies to what is LEFT. Gold
//       (10%) + a 15% coupon on 1000 грн is 235 грн off, not 250 грн. This
//       keeps the combined discount inside 0..100% by construction.
// AC-3  Coupon order .......... every valid coupon applies, in the order the
//       customer typed them (`order.coupons`). Not "the best one only".
// AC-4  One coupon per scope .. a coupon is either order-wide or scoped to one
//       category. At most ONE coupon may apply per scope: the first typed one
//       wins, later ones for the same scope are rejected
//       (`scope_already_discounted`). Repeating the same code is
//       `duplicate_code`.
// AC-5  Category coupon base .. the remaining amount of THAT category (its line
//       totals minus the share of the tier discount allocated to it), never the
//       whole order.
// AC-6  Tier allocation ....... the single rounded tier discount is split
//       across categories in proportion to their line totals using
//       largest-remainder allocation, so the parts always sum back to the whole
//       — no kopeck is created or lost.
// AC-7  minSubtotalKopecks .... checked against the RAW items subtotal, BEFORE
//       any discount. Order-independent: a coupon's eligibility never depends
//       on which other coupons were typed.
// AC-8  Rounding .............. half-up to a whole kopeck, applied ONCE per
//       discount on that discount's aggregated base — never per line. Half a
//       kopeck rounds up (in the customer's favour).
// AC-9  Expiry ................ a coupon is invalid ON or AFTER `expiresAt`.
//       Expiry is an EXPLICIT rejection (`expired`) surfaced in
//       `rejectedCoupons`, not a silent no-op, so checkout can tell the user.
//       An unparsable `expiresAt` fails closed as `expired`.
// AC-10 Lower bound ........... nothing can go negative. Each discount is
//       capped at the base it applies to, so discounted items >= 0 and the
//       total is never below the shipping fee.
// AC-11 Unknown codes ........ a code that is not in the catalog is reported as
//       `unknown_code`; codes match EXACTLY (case-sensitive).
// AC-12 Empty category ....... a category coupon on an order with no items of
//       that category is `no_matching_items`.
// AC-13 Breakdown ............ an itemised, internally consistent breakdown is
//       returned (parts always sum back to the total), and the input order is
//       never mutated.
//
// Coupons are looked up by EXACT code match against the catalog passed in;
// checkout owns the catalog, this module stays pure.

import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

/** What a coupon discounts: one product category, or the whole order. */
export type CouponScope = LineItem["category"] | "order";

/** Why a typed coupon code did not produce a discount. */
export type CouponRejectionReason =
  /** No coupon with this code in the catalog. */
  | "unknown_code"
  /** The same code was typed more than once. */
  | "duplicate_code"
  /** Valid-until instant has passed (or `expiresAt` is unparsable). */
  | "expired"
  /** Raw items subtotal is below the coupon's `minSubtotalKopecks`. */
  | "min_subtotal_not_met"
  /** An earlier coupon already discounted this scope. */
  | "scope_already_discounted"
  /** Category coupon, but the order has no items of that category. */
  | "no_matching_items"
  /** The scope is already fully discounted — there is nothing left to take off. */
  | "nothing_left_to_discount";

export interface AppliedCoupon {
  code: string;
  kind: Coupon["kind"];
  /** Scope the coupon was applied to. */
  scope: CouponScope;
  /** Amount the discount was computed from, whole kopecks. */
  baseKopecks: number;
  /** Discount granted, whole kopecks. */
  discountKopecks: number;
}

export interface RejectedCoupon {
  code: string;
  reason: CouponRejectionReason;
}

export interface PriceBreakdown {
  /** Items only, before any discount. */
  subtotalKopecks: number;
  /** Headline tier percentage that was used (0 / 5 / 10). */
  tierPercent: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  /** tierDiscountKopecks + couponDiscountKopecks. */
  totalDiscountKopecks: number;
  /** subtotalKopecks - totalDiscountKopecks, never negative. */
  discountedItemsKopecks: number;
  /** Never discounted. */
  shippingKopecks: number;
  /** discountedItemsKopecks + shippingKopecks. */
  totalKopecks: number;
  appliedCoupons: AppliedCoupon[];
  rejectedCoupons: RejectedCoupon[];
}

/** Categories in a fixed order, so allocation is deterministic. */
const CATEGORIES: readonly LineItem["category"][] = ["standard", "fresh", "digital"];

/**
 * `percent` of `baseKopecks`, rounded half-up to a whole kopeck (AC-8).
 * Integer arithmetic only: floor((2·base·percent + 100) / 200).
 */
function percentOfKopecks(baseKopecks: number, percent: number): number {
  const safePercent = Math.min(100, Math.max(0, percent));
  return Math.floor((baseKopecks * safePercent * 2 + 100) / 200);
}

/**
 * Split `total` across `weights` proportionally, in whole kopecks, so the parts
 * sum back to `total` exactly (largest remainder; ties go to the earlier
 * bucket). AC-6.
 */
function allocateProportionally(total: number, weights: readonly number[]): number[] {
  const parts = weights.map(() => 0);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0 || weightSum <= 0) return parts;

  const remainders: { index: number; remainder: number }[] = [];
  let assigned = 0;
  weights.forEach((weight, index) => {
    const scaled = total * weight;
    const floored = Math.floor(scaled / weightSum);
    parts[index] = floored;
    assigned += floored;
    remainders.push({ index, remainder: scaled - floored * weightSum });
  });

  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let left = total - assigned;
  for (const { index } of remainders) {
    if (left <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    left -= 1;
  }
  return parts;
}

/** Is the coupon still usable at `now`? Invalid ON or after `expiresAt` (AC-9). */
function isExpired(coupon: Coupon, now: Date): boolean {
  const expiresAt = Date.parse(coupon.expiresAt);
  if (Number.isNaN(expiresAt)) return true; // fail closed
  return now.getTime() >= expiresAt;
}

interface Bucket {
  category: LineItem["category"];
  /** Line totals of this category, before any discount. */
  grossKopecks: number;
  /** What is still discountable in this category. */
  remainingKopecks: number;
}

/**
 * Price an order: loyalty tier discount, then coupons, then shipping.
 *
 * Pure. `catalog` is the coupon definitions checkout knows about; codes on the
 * order that are not in it are reported as `unknown_code`. `now` is injectable
 * so expiry is testable.
 */
export function priceOrder(
  order: Order,
  catalog: readonly Coupon[] = [],
  now: Date = new Date(),
): PriceBreakdown {
  const subtotal = subtotalKopecks(order);

  // Per-category gross amounts, in a fixed category order.
  const buckets: Bucket[] = CATEGORIES.map((category) => {
    const grossKopecks = order.items
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + lineTotalKopecks(item), 0);
    return { category, grossKopecks, remainingKopecks: grossKopecks };
  });

  // --- Tier: one rounding on the items subtotal (AC-1, AC-8), then split
  // across categories so the parts sum back exactly (AC-6).
  const percentForTier = tierPercent(order);
  const tierDiscount = Math.min(percentOfKopecks(subtotal, percentForTier), subtotal);
  const tierParts = allocateProportionally(
    tierDiscount,
    buckets.map((b) => b.grossKopecks),
  );
  buckets.forEach((bucket, index) => {
    bucket.remainingKopecks -= tierParts[index] ?? 0;
  });

  // --- Coupons: typed order, sequential, one per scope.
  const appliedCoupons: AppliedCoupon[] = [];
  const rejectedCoupons: RejectedCoupon[] = [];
  const seenCodes = new Set<string>();
  const discountedScopes = new Set<CouponScope>();

  const reject = (code: string, reason: CouponRejectionReason): void => {
    rejectedCoupons.push({ code, reason });
  };

  for (const code of order.coupons) {
    if (seenCodes.has(code)) {
      reject(code, "duplicate_code");
      continue;
    }
    seenCodes.add(code);

    const coupon = catalog.find((candidate) => candidate.code === code);
    if (!coupon) {
      reject(code, "unknown_code");
      continue;
    }
    if (isExpired(coupon, now)) {
      reject(code, "expired");
      continue;
    }
    // Eligibility is judged on the RAW subtotal, before any discount (AC-7).
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      reject(code, "min_subtotal_not_met");
      continue;
    }

    const scope: CouponScope = coupon.category ?? "order";
    if (discountedScopes.has(scope)) {
      reject(code, "scope_already_discounted");
      continue;
    }

    const scopedBuckets =
      scope === "order" ? buckets : buckets.filter((b) => b.category === scope);

    if (scope !== "order" && scopedBuckets.every((b) => b.grossKopecks === 0)) {
      reject(code, "no_matching_items");
      continue;
    }

    const baseKopecks = scopedBuckets.reduce((sum, b) => sum + b.remainingKopecks, 0);
    if (baseKopecks <= 0) {
      reject(code, "nothing_left_to_discount");
      continue;
    }

    // Capped at its own base, so nothing can go negative (AC-10).
    const rawDiscount =
      coupon.kind === "percent"
        ? percentOfKopecks(baseKopecks, coupon.value)
        : Math.max(0, Math.trunc(coupon.value));
    const discountKopecks = Math.min(rawDiscount, baseKopecks);

    const discountParts = allocateProportionally(
      discountKopecks,
      scopedBuckets.map((b) => b.remainingKopecks),
    );
    scopedBuckets.forEach((bucket, index) => {
      bucket.remainingKopecks -= discountParts[index] ?? 0;
    });

    discountedScopes.add(scope);
    appliedCoupons.push({
      code: coupon.code,
      kind: coupon.kind,
      scope,
      baseKopecks,
      discountKopecks,
    });
  }

  const couponDiscount = appliedCoupons.reduce((sum, a) => sum + a.discountKopecks, 0);
  const totalDiscount = tierDiscount + couponDiscount;
  const discountedItems = subtotal - totalDiscount;
  const shipping = shippingKopecks(order);

  return {
    subtotalKopecks: subtotal,
    tierPercent: percentForTier,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    totalDiscountKopecks: totalDiscount,
    discountedItemsKopecks: discountedItems,
    shippingKopecks: shipping,
    totalKopecks: discountedItems + shipping,
    appliedCoupons,
    rejectedCoupons,
  };
}
