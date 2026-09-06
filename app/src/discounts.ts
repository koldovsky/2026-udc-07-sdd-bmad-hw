// Loyalty-tier and coupon discounts. Implements docs/spec/pricing-discounts.md:
// section 6 fixes the contract and the twelve calculation steps, section 4 holds
// the decisions D-1…D-32 referenced by id in the comments below.
//
// All amounts are whole kopecks. The only division here is `idiv` (D-4); no
// floating-point arithmetic touches an amount.

import type { Coupon, LineItem, Order } from "./types.js";
import {
  lineTotalKopecks,
  shippingKopecks,
  subtotalKopecks,
  tierPercent,
} from "./pricing.js";

export type RejectionReason =
  | "unknown"
  | "expired"
  | "min-subtotal"
  | "no-effect"
  | "too-small"
  | "superseded";

export interface RejectedCoupon {
  /**
   * The catalog entry's own `code` string, verbatim and un-normalised — or the
   * raw typed string, verbatim including surrounding whitespace, when reason
   * is "unknown".
   */
  code: string;
  reason: RejectionReason;
  /**
   * The threshold the order failed to reach, so the checkout page can name it
   * without the catalog. The property is ABSENT — not present-and-undefined —
   * unless reason is "min-subtotal" AND the catalog threshold is a finite
   * non-negative integer. See D-30.
   */
  minSubtotalKopecks?: number;
}

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  /**
   * The applied coupon's catalog `code` string, verbatim and un-normalised,
   * or null if none applied.
   */
  appliedCouponCode: string | null;
  /** Every typed code that did not apply, in the order typed. */
  rejectedCoupons: RejectedCoupon[];
  shippingKopecks: number;
  totalKopecks: number;
}

/**
 * Integer division by 100 for a non-negative integer (D-4). Used everywhere in
 * place of `Math.floor(x / 100)` so no floating-point value enters the
 * calculation.
 */
function idiv(x: number): number {
  return (x - (x % 100)) / 100;
}

/** The categories the seeded `LineItem` contract allows. */
const KNOWN_CATEGORIES: readonly LineItem["category"][] = [
  "standard",
  "fresh",
  "digital",
];

function isKnownCategory(value: unknown): value is LineItem["category"] {
  return KNOWN_CATEGORIES.some((known) => known === value);
}

/**
 * Item totals per category, in one pass over `order.items`. An item whose
 * category is outside the union counts towards the subtotal but towards no
 * category total (D-31), and a category outside the union reads as 0 (D-32).
 */
function categoryTotals(order: Order): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of order.items) {
    if (!isKnownCategory(item.category)) continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + lineTotalKopecks(item));
  }
  return totals;
}

/**
 * Codes are compared after trimming and upper-casing (D-15). A non-string
 * becomes the empty string, which is then dropped as untyped (D-21, D-29).
 */
function normaliseCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

/** The two `expiresAt` forms the catalog may use, ranges included (D-24). */
const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATE_TIME =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{3})?)?(Z|[+-]((0\d|1[0-3]):[0-5]\d|14:00))$/;

/**
 * True when `expiresAt` is a string `Date.parse` is obliged to read the same way
 * on every engine: one of the two accepted forms (D-24) naming a calendar day
 * that exists (D-20). The day is verified by rebuilding it, because
 * `Date.parse("2026-02-30")` does not return NaN in V8 — it rolls silently
 * forward to 2 March and would extend a campaign at the shop's expense.
 */
function expiresAtIsUsable(expiresAt: unknown): boolean {
  if (typeof expiresAt !== "string") return false;
  if (!DATE_ONLY.test(expiresAt) && !DATE_TIME.test(expiresAt)) return false;

  const year = Number(expiresAt.slice(0, 4));
  const month = Number(expiresAt.slice(5, 7));
  const day = Number(expiresAt.slice(8, 10));

  // `Date.UTC` cannot be used: it maps years 0-99 onto 1900 + year.
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  probe.setUTCHours(0, 0, 0, 0);

  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * The discount a coupon yields on `base`, always an integer in `[0, base]`
 * (step 6). The integer test comes first: `NaN <= 0` is false, so a NaN value
 * would otherwise reach the total (D-27).
 */
function discountFor(coupon: Coupon, base: number): number {
  if (!Number.isInteger(coupon.value)) return 0; // D-27
  if (coupon.value <= 0) return 0; // D-23
  if (coupon.kind === "percent") return Math.min(idiv(base * coupon.value), base);
  if (coupon.kind === "fixed") return Math.min(coupon.value, base);
  return 0; // D-28: an unrecognised kind is not a guess
}

/** A typed code after normalisation, with the raw string of its first occurrence. */
interface TypedCode {
  normalised: string;
  raw: string;
}

/** What the coupon pass concluded about one typed code, before selection. */
type Outcome =
  | {
      kind: "rejected";
      code: string;
      reason: RejectionReason;
      minSubtotalKopecks?: number;
    }
  | { kind: "candidate"; code: string; discount: number };

/**
 * Pure function. Never reads the clock: `now` is the instant coupon expiry is
 * checked against.
 *
 * Never throws PROVIDED the argument shapes match this signature at runtime —
 * `order.items` and `order.coupons` are real arrays, `catalog` is a real array
 * of objects, `now` is a Date instance (section 3, level 1). Bad VALUES inside
 * those shapes never throw: they are turned into a rejected coupon (D-25, D-27,
 * D-28, D-29, D-30, D-31, D-32).
 *
 * Returns a freshly built object on every call: neither the breakdown, nor
 * `rejectedCoupons`, nor its elements share references with `order` or
 * `catalog`, and no argument is mutated (I-5).
 *
 * Caller obligations are listed in section 3 of the specification.
 */
export function priceOrder(
  order: Order,
  catalog: Coupon[],
  now: Date,
): PriceBreakdown {
  // Steps 1-3: the tier discount comes off the items first, and the coupon then
  // works on what is left (D-1, D-2).
  const subtotal = subtotalKopecks(order);
  const tierDiscount = idiv(subtotal * tierPercent(order));
  const remainder = subtotal - tierDiscount;
  const totals = categoryTotals(order);

  // Step 4: normalise, drop the blanks, collapse repeats keeping the order and
  // the raw spelling of each code's first occurrence (D-11, D-15, D-19, D-21).
  const typed: TypedCode[] = [];
  const seen = new Set<string>();
  for (const entry of order.coupons) {
    const normalised = normaliseCode(entry);
    if (normalised === "" || seen.has(normalised)) continue;
    seen.add(normalised);
    typed.push({ normalised, raw: entry });
  }

  // The catalog is indexed once rather than searched per code; the first entry
  // for a normalised code wins, which makes any later duplicate unreachable
  // (D-18).
  const byCode = new Map<string, Coupon>();
  for (const coupon of catalog) {
    const key = normaliseCode(coupon.code);
    if (!byCode.has(key)) byCode.set(key, coupon);
  }

  const nowIsInvalid = Number.isNaN(now.getTime());

  const outcomes: Outcome[] = typed.map(({ normalised, raw }): Outcome => {
    // Step 5, in this order. Catalog lookup stands first, so an unknown code is
    // reported as unknown even when `now` itself is unusable (D-10, D-25).
    const coupon = byCode.get(normalised);
    if (coupon === undefined) return { kind: "rejected", code: raw, reason: "unknown" };

    const code = coupon.code;
    if (nowIsInvalid) return { kind: "rejected", code, reason: "expired" }; // D-25
    if (!expiresAtIsUsable(coupon.expiresAt)) {
      return { kind: "rejected", code, reason: "expired" }; // D-20, D-24
    }
    if (now.getTime() >= Date.parse(coupon.expiresAt)) {
      return { kind: "rejected", code, reason: "expired" }; // D-8, D-17
    }

    // A threshold counts as set when it is not `undefined`, so a threshold of 0
    // stays set (D-6, D-30).
    const threshold = coupon.minSubtotalKopecks;
    if (threshold !== undefined) {
      if (!Number.isInteger(threshold) || threshold < 0) {
        // Unreadable: unreachable rather than open, and not echoed to the
        // customer (D-30).
        return { kind: "rejected", code, reason: "min-subtotal" };
      }
      if (subtotal < threshold) {
        return {
          kind: "rejected",
          code,
          reason: "min-subtotal",
          minSubtotalKopecks: threshold,
        };
      }
    }

    // Step 6: the base. A category counts as set if and only if it is not
    // `undefined` — `if (coupon.category)` would put null in the no-category
    // branch and discount the whole order (D-32).
    const category = coupon.category;
    const scopeTotal =
      category !== undefined ? (totals.get(category) ?? 0) : remainder;
    const base =
      category !== undefined
        ? idiv(scopeTotal * (100 - tierPercent(order))) // D-5
        : remainder;

    const discount = discountFor(coupon, base);

    // Step 7: a coupon worth nothing is not applied. The reason follows the
    // scope the code covers, not its base (D-16).
    if (discount === 0) {
      return {
        kind: "rejected",
        code,
        reason: scopeTotal === 0 ? "no-effect" : "too-small",
      };
    }

    return { kind: "candidate", code, discount };
  });

  // Step 8: the largest discount wins; a tie goes to the code typed earlier,
  // which strict `>` gives us (D-3, D-12).
  let winnerIndex = -1;
  let winnerDiscount = 0;
  let winnerCode: string | null = null;
  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.kind !== "candidate") continue;
    if (winnerIndex === -1 || outcome.discount > winnerDiscount) {
      winnerIndex = index;
      winnerDiscount = outcome.discount;
      winnerCode = outcome.code;
    }
  }

  // Step 11: rejections come out in the order the codes were typed, not in the
  // order the reasons arose (D-19).
  const rejectedCoupons: RejectedCoupon[] = [];
  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.kind === "rejected") {
      rejectedCoupons.push(
        outcome.minSubtotalKopecks === undefined
          ? { code: outcome.code, reason: outcome.reason }
          : {
              code: outcome.code,
              reason: outcome.reason,
              minSubtotalKopecks: outcome.minSubtotalKopecks,
            },
      );
    } else if (index !== winnerIndex) {
      rejectedCoupons.push({ code: outcome.code, reason: "superseded" });
    }
  }

  // Steps 9, 10 and 12.
  const shipping = shippingKopecks(order);
  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: winnerDiscount,
    appliedCouponCode: winnerCode,
    rejectedCoupons,
    shippingKopecks: shipping,
    totalKopecks: subtotal - tierDiscount - winnerDiscount + shipping,
  };
}
