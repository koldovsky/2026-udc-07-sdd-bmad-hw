// ============================================================================
// Task D — Run B2 ARTIFACT, preserved verbatim. NOT production code.
//
// Produced by a second agent given only materials/feature-request.md (no
// spec), in an isolated worktree at commit c339625, under stricter path
// confinement than Run B1 (relative paths only). It read nothing outside
// its own tree, so its choices are independent of Task A-C entirely.
//
// Kept as evidence for the comparison table in docs/ab-validation.md.
// Nothing in app/ imports this, and docs/ is outside app/tsconfig.json's
// include, so it never compiles or runs as part of the project.
// ============================================================================

// Discount engine.
//
// The feature request (materials/feature-request.md) is deliberately ambiguous.
// Every fork it leaves open is closed here by an explicit, testable decision.
// The decisions are listed once, up front, so the rules are readable without
// reading the code. Each decision id (D-n) is referenced by the tests.
//
// MONEY: every amount is whole kopecks (1 грн = 100 копійок). No floats are
// ever stored or returned; the only division is the rounding helper below,
// which is exact integer arithmetic.
//
// ---------------------------------------------------------------------------
// DECISIONS
// ---------------------------------------------------------------------------
// D-1  Discount base = items subtotal only. Shipping is never discounted; it is
//      added after all discounts. (Request: "від суми товарів чи разом з
//      доставкою?" -> items only.)
// D-2  Stacking is SEQUENTIAL (cascading), not additive. Tier runs first on the
//      full items subtotal; each coupon then runs on what is left after the
//      previous step. Gold + 15% on 1 000 грн therefore yields 235 грн off, not
//      250 грн. Rationale: a cascade can never exceed 100% of the order, so the
//      total is monotone and the customer still visibly benefits from both.
// D-3  Rounding is HALF-UP, applied ONCE PER DISCOUNT STEP on that step's whole
//      amount (never per line). Exactly half a kopeck rounds away from zero, in
//      the customer's favour. The rounded step amount is then split across the
//      affected categories by largest remainder, so per-category remainders stay
//      whole kopecks and the parts always sum back to the step total.
// D-4  Multiple coupons: ALL valid coupons apply, in the order the customer
//      typed them (`order.coupons`). Not "the best one only" — the request says
//      the customer may enter several, and typed order is the only ordering the
//      data gives us.
// D-5  At most ONE coupon per scope. A scope is a category for a
//      category-restricted coupon, and "order" for an unrestricted one. A second
//      coupon hitting an already-discounted scope is rejected
//      ("scope-already-discounted"). This answers "два промокоди на одну
//      категорію" without banning an order-wide + category-wide combination.
//      The same code typed twice is rejected earlier as "duplicate-code".
// D-6  A category coupon acts only on that category: a percent coupon takes its
//      percentage of that category's remaining amount, and a fixed coupon is
//      capped by that category's remaining amount. Not of the whole order.
// D-7  `minSubtotalKopecks` is checked against the ORIGINAL items subtotal,
//      BEFORE any tier or coupon discount. Rationale: the threshold is a
//      property of the basket the customer built, so eligibility must not depend
//      on which other coupons happen to be in the list, or on their order.
// D-8  Expiry: a coupon is dead once `now >= expiresAt` (the type says "not
//      valid on or after this instant"), so the boundary instant itself is
//      already expired. An unparseable `expiresAt` is treated as expired.
// D-9  A rejected coupon is NOT an exception. Pricing always succeeds and
//      returns every rejection with a machine-readable reason in
//      `rejectedCoupons`, so checkout can show the customer why a code did not
//      work. Unknown codes are reported the same way.
// D-10 Nothing can go negative and nothing overshoots: total item discount is
//      capped at the items subtotal, each category's remainder is floored at 0,
//      and the order total is therefore always >= shipping >= 0. A 100%-off
//      order still pays shipping (D-1).
// D-11 Coupon codes are matched case-insensitively and trimmed, because a human
//      types them. The code echoed back in the breakdown is the catalogue's
//      canonical spelling; the code echoed in a rejection is what was typed.
// D-12 A category coupon on an order containing none of that category is
//      rejected ("no-items-in-category") rather than silently contributing 0.
// D-13 Tier produces a discount line only when it is non-zero, so a `none`-tier
//      order has an empty `discounts` list rather than a 0 грн line.

import type { Coupon, LineItem, Order } from "./types.js";
import { lineTotalKopecks, shippingKopecks, subtotalKopecks, tierPercent } from "./pricing.js";

export type Category = LineItem["category"];

/** Deterministic iteration order for category buckets (D-3 tie-breaking). */
const CATEGORY_ORDER: readonly Category[] = ["standard", "fresh", "digital"];

/** Scope a coupon competes for (D-5). */
export type CouponScope = Category | "order";

export type CouponRejectionReason =
  | "unknown-code"
  | "duplicate-code"
  | "expired"
  | "min-subtotal-not-met"
  | "no-items-in-category"
  | "scope-already-discounted";

export interface RejectedCoupon {
  /** The code exactly as the customer typed it. */
  code: string;
  reason: CouponRejectionReason;
}

export interface DiscountLine {
  source: "tier" | "coupon";
  /** Canonical coupon code, for `source: "coupon"` only. */
  code?: string;
  /** Human-readable explanation, e.g. `gold tier -10%`. */
  label: string;
  /** Amount taken off, in whole kopecks. Always > 0. */
  amountKopecks: number;
  /** Scope the step applied to (D-6). */
  scope: CouponScope;
}

export interface PriceBreakdown {
  /** Items only, before discounts. */
  subtotalKopecks: number;
  /** Applied steps, in the order they were applied (D-2, D-4). */
  discounts: DiscountLine[];
  totalDiscountKopecks: number;
  /** `subtotalKopecks - totalDiscountKopecks`, never negative (D-10). */
  discountedSubtotalKopecks: number;
  /** Never discounted (D-1). */
  shippingKopecks: number;
  /** `discountedSubtotalKopecks + shippingKopecks`. */
  totalKopecks: number;
  /** Coupons that did not apply, and why (D-9). */
  rejectedCoupons: RejectedCoupon[];
}

/**
 * Divide two non-negative integers, rounding half away from zero (D-3).
 * Pure integer arithmetic: `floor((2n + d) / 2d)`.
 */
function divRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * `percent` of `baseKopecks`, rounded half-up to whole kopecks (D-3).
 * Exported because the rounding rule is a specification decision worth
 * asserting directly.
 */
export function percentOfKopecks(baseKopecks: number, percent: number): number {
  if (baseKopecks <= 0 || percent <= 0) return 0;
  return Math.min(baseKopecks, divRoundHalfUp(baseKopecks * percent, 100));
}

/** Normalise a typed coupon code for lookup (D-11). */
function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Items subtotal per category, only for categories the order actually has. */
function categorySubtotals(order: Order): Map<Category, number> {
  const buckets = new Map<Category, number>();
  for (const item of order.items) {
    buckets.set(item.category, (buckets.get(item.category) ?? 0) + lineTotalKopecks(item));
  }
  return buckets;
}

/** Categories of a scope, in deterministic order, restricted to what the order has. */
function scopeCategories(scope: CouponScope, remaining: Map<Category, number>): Category[] {
  if (scope === "order") return CATEGORY_ORDER.filter((c) => remaining.has(c));
  return remaining.has(scope) ? [scope] : [];
}

function sumRemaining(categories: readonly Category[], remaining: Map<Category, number>): number {
  return categories.reduce((sum, c) => sum + (remaining.get(c) ?? 0), 0);
}

/**
 * Take `amountKopecks` off the given categories, splitting it proportionally to
 * what each still has left and settling the leftover kopecks by largest
 * remainder (D-3). Mutates `remaining`. Returns what was actually taken, which
 * is capped by the scope's remaining amount (D-10).
 */
function takeFromScope(
  amountKopecks: number,
  categories: readonly Category[],
  remaining: Map<Category, number>,
): number {
  const scopeBase = sumRemaining(categories, remaining);
  const taken = Math.min(Math.max(amountKopecks, 0), scopeBase);
  if (taken === 0) return 0;

  // Proportional floor share per category, plus the numerator of its remainder.
  const parts = categories.map((category) => {
    const bucket = remaining.get(category) ?? 0;
    const exactNumerator = taken * bucket;
    return {
      category,
      share: Math.floor(exactNumerator / scopeBase),
      remainderNumerator: exactNumerator % scopeBase,
    };
  });

  let leftover = taken - parts.reduce((sum, p) => sum + p.share, 0);
  // Largest remainder first; ties fall back to CATEGORY_ORDER (parts order).
  const byRemainder = [...parts].sort((a, b) => b.remainderNumerator - a.remainderNumerator);
  for (const part of byRemainder) {
    if (leftover <= 0) break;
    part.share += 1;
    leftover -= 1;
  }

  for (const part of parts) {
    remaining.set(part.category, (remaining.get(part.category) ?? 0) - part.share);
  }
  return taken;
}

/** True once `now` has reached `expiresAt` (D-8). */
function isExpired(coupon: Coupon, now: Date): boolean {
  const expiresAt = Date.parse(coupon.expiresAt);
  if (Number.isNaN(expiresAt)) return true;
  return now.getTime() >= expiresAt;
}

/**
 * Resolve the codes the customer typed against the catalogue, keeping only the
 * coupons that may be applied and reporting every rejection with its reason
 * (D-4, D-5, D-8, D-9, D-11, D-12).
 */
function resolveCoupons(
  order: Order,
  catalog: readonly Coupon[],
  now: Date,
  subtotal: number,
  presentCategories: ReadonlySet<Category>,
): { applicable: Coupon[]; rejected: RejectedCoupon[] } {
  const byCode = new Map<string, Coupon>();
  for (const coupon of catalog) {
    // First entry wins, so a duplicated catalogue does not change behaviour.
    if (!byCode.has(normaliseCode(coupon.code))) byCode.set(normaliseCode(coupon.code), coupon);
  }

  const applicable: Coupon[] = [];
  const rejected: RejectedCoupon[] = [];
  const seenCodes = new Set<string>();
  const usedScopes = new Set<CouponScope>();

  for (const typed of order.coupons) {
    const key = normaliseCode(typed);
    const coupon = byCode.get(key);

    if (coupon === undefined) {
      rejected.push({ code: typed, reason: "unknown-code" });
      continue;
    }
    if (seenCodes.has(key)) {
      rejected.push({ code: typed, reason: "duplicate-code" });
      continue;
    }
    seenCodes.add(key);

    if (isExpired(coupon, now)) {
      rejected.push({ code: typed, reason: "expired" });
      continue;
    }
    if (coupon.minSubtotalKopecks !== undefined && subtotal < coupon.minSubtotalKopecks) {
      rejected.push({ code: typed, reason: "min-subtotal-not-met" });
      continue;
    }
    if (coupon.category !== undefined && !presentCategories.has(coupon.category)) {
      rejected.push({ code: typed, reason: "no-items-in-category" });
      continue;
    }

    const scope: CouponScope = coupon.category ?? "order";
    if (usedScopes.has(scope)) {
      rejected.push({ code: typed, reason: "scope-already-discounted" });
      continue;
    }
    usedScopes.add(scope);
    applicable.push(coupon);
  }

  return { applicable, rejected };
}

/**
 * Price an order: tier discount, then every applicable coupon, then shipping.
 *
 * @param order    the order, including the coupon codes as typed
 * @param catalog  the known coupons; codes not in here are rejected (D-9)
 * @param now      the instant to judge expiry against (D-8), defaults to now
 */
export function priceOrder(
  order: Order,
  catalog: readonly Coupon[] = [],
  now: Date = new Date(),
): PriceBreakdown {
  const subtotal = subtotalKopecks(order);
  const remaining = categorySubtotals(order);
  const presentCategories = new Set<Category>(remaining.keys());

  const discounts: DiscountLine[] = [];

  // Step 1 — loyalty tier, on the full items subtotal (D-1, D-2).
  const percent = tierPercent(order);
  if (percent > 0) {
    const all = scopeCategories("order", remaining);
    const wanted = percentOfKopecks(sumRemaining(all, remaining), percent);
    const taken = takeFromScope(wanted, all, remaining);
    if (taken > 0) {
      discounts.push({
        source: "tier",
        label: `${order.customerTier} tier -${percent}%`,
        amountKopecks: taken,
        scope: "order",
      });
    }
  }

  // Step 2 — coupons, in typed order, each on what is left (D-2, D-4, D-6).
  const { applicable, rejected } = resolveCoupons(
    order,
    catalog,
    now,
    subtotal,
    presentCategories,
  );

  for (const coupon of applicable) {
    const scope: CouponScope = coupon.category ?? "order";
    const categories = scopeCategories(scope, remaining);
    const scopeBase = sumRemaining(categories, remaining);
    const wanted =
      coupon.kind === "percent"
        ? percentOfKopecks(scopeBase, coupon.value)
        : Math.min(Math.max(coupon.value, 0), scopeBase);
    const taken = takeFromScope(wanted, categories, remaining);
    if (taken > 0) {
      discounts.push({
        source: "coupon",
        code: coupon.code,
        label:
          coupon.kind === "percent"
            ? `coupon ${coupon.code} -${coupon.value}%${scope === "order" ? "" : ` (${scope})`}`
            : `coupon ${coupon.code} -${coupon.value} kopecks${scope === "order" ? "" : ` (${scope})`}`,
        amountKopecks: taken,
        scope,
      });
    }
  }

  const totalDiscount = discounts.reduce((sum, d) => sum + d.amountKopecks, 0);
  const discountedSubtotal = subtotal - totalDiscount;
  const shipping = shippingKopecks(order);

  return {
    subtotalKopecks: subtotal,
    discounts,
    totalDiscountKopecks: totalDiscount,
    discountedSubtotalKopecks: discountedSubtotal,
    shippingKopecks: shipping,
    totalKopecks: discountedSubtotal + shipping,
    rejectedCoupons: rejected,
  };
}
