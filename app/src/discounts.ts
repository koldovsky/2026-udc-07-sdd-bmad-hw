// Loyalty-tier and coupon discounts. Implements docs/spec/pricing-discounts.md:
// section 6 fixes the contract and the twelve calculation steps, section 4 holds
// the decisions D-1…D-33 referenced by id in the comments below.
//
// Each numbered step of section 6 that can stand on its own is a named function
// here, so `docs/traceability.md` can point a criterion at the symbol that
// decides it rather than at the whole calculation. `priceOrder` keeps the steps
// that are one line of arithmetic each (1-3, 9, 10, 12) and reads as the
// ordered list the specification gives.
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
 *
 * Section 6 of the specification writes this as `idiv(x, 100)`. The divisor is
 * 100 at every call site the specification makes, so it is not a parameter
 * here: a second argument that only ever takes one value would be generality
 * nothing asked for. The arity is the only difference, and it carries no
 * behaviour.
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
 * becomes the empty string, which is then dropped as untyped (D-21, D-29) on the
 * typed side, and makes the entry unreachable rather than fatal on the catalog
 * side (D-33).
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
 * Step 4. Normalise, drop the blanks, collapse repeats keeping the order and
 * the raw spelling of each code's first occurrence — that raw string is what a
 * rejection with reason "unknown" has to echo back (D-11, D-15, D-19, D-21).
 */
function typedCodes(coupons: Order["coupons"]): TypedCode[] {
  const typed: TypedCode[] = [];
  const seen = new Set<string>();
  for (const entry of coupons) {
    const normalised = normaliseCode(entry);
    if (normalised === "" || seen.has(normalised)) continue;
    seen.add(normalised);
    typed.push({ normalised, raw: entry });
  }
  return typed;
}

/**
 * Step 5, lookup. The catalog is indexed once rather than searched per code;
 * the first entry for a normalised code wins, which makes any later duplicate
 * unreachable (D-18).
 */
function indexCatalog(catalog: Coupon[]): Map<string, Coupon> {
  const byCode = new Map<string, Coupon>();
  for (const coupon of catalog) {
    const key = normaliseCode(coupon.code);
    if (!byCode.has(key)) byCode.set(key, coupon);
  }
  return byCode;
}

/**
 * Step 5, the validity gate, in the order the specification fixes: an unusable
 * clock, then expiry, then the threshold. Returns the rejection that closes the
 * coupon, or null when it survives to step 6.
 *
 * The catalog lookup is not here: it stands even earlier, in `priceOrder`, so
 * an unknown code is reported as unknown even when `now` itself is unusable
 * (D-10, D-25).
 */
function availabilityRejection(
  coupon: Coupon,
  subtotal: number,
  nowIsInvalid: boolean,
  now: Date,
): Outcome | null {
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

  return null;
}

/**
 * Step 6, the base. A category counts as set if and only if it is not
 * `undefined` — `if (coupon.category)` would put null in the no-category branch
 * and discount the whole order (D-32).
 *
 * `scopeTotal` is the volume the code covers and is returned alongside the base
 * because step 7 picks the rejection reason from the scope, not from the base
 * (D-16).
 */
function couponScope(
  coupon: Coupon,
  totals: Map<string, number>,
  remainder: number,
  tierPct: number,
): { scopeTotal: number; base: number } {
  const category = coupon.category;
  if (category === undefined) return { scopeTotal: remainder, base: remainder };

  const scopeTotal = totals.get(category) ?? 0;
  return { scopeTotal, base: idiv(scopeTotal * (100 - tierPct)) }; // D-5
}

/**
 * Step 8. The largest discount wins; a tie goes to the code typed earlier,
 * which strict `>` gives us (D-3, D-12). Returns the index into `outcomes`, or
 * -1 when no code survived to be a candidate.
 */
function selectWinner(outcomes: readonly Outcome[]): number {
  let winnerIndex = -1;
  let winnerDiscount = 0;
  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.kind !== "candidate") continue;
    if (winnerIndex === -1 || outcome.discount > winnerDiscount) {
      winnerIndex = index;
      winnerDiscount = outcome.discount;
    }
  }
  return winnerIndex;
}

/**
 * Step 11. Rejections come out in the order the codes were typed, not in the
 * order the reasons arose (D-19). Every candidate that is not the winner is a
 * rejection with reason "superseded".
 */
function orderedRejections(
  outcomes: readonly Outcome[],
  winnerIndex: number,
): RejectedCoupon[] {
  const rejected: RejectedCoupon[] = [];
  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.kind === "rejected") {
      rejected.push(
        outcome.minSubtotalKopecks === undefined
          ? { code: outcome.code, reason: outcome.reason }
          : {
              code: outcome.code,
              reason: outcome.reason,
              minSubtotalKopecks: outcome.minSubtotalKopecks,
            },
      );
    } else if (index !== winnerIndex) {
      rejected.push({ code: outcome.code, reason: "superseded" });
    }
  }
  return rejected;
}

/**
 * Pure function. Never reads the clock: `now` is the instant coupon expiry is
 * checked against.
 *
 * Never throws PROVIDED the argument shapes match this signature at runtime —
 * `order.items` and `order.coupons` are real arrays, `catalog` is a real array
 * of objects, `now` is a Date instance (section 3, level 1). Bad VALUES inside
 * those shapes never throw: they are turned into a rejected coupon, or into an
 * unreachable catalog entry (D-25, D-27, D-28, D-29, D-30, D-31, D-32, D-33).
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
  const tierPct = tierPercent(order);
  const tierDiscount = idiv(subtotal * tierPct);
  const remainder = subtotal - tierDiscount;

  const totals = categoryTotals(order);
  const typed = typedCodes(order.coupons);
  const byCode = indexCatalog(catalog);
  const nowIsInvalid = Number.isNaN(now.getTime());

  const outcomes: Outcome[] = typed.map(({ normalised, raw }): Outcome => {
    // Step 5. The catalog lookup stands first, so an unknown code is reported
    // as unknown even when `now` itself is unusable (D-10, D-25).
    const coupon = byCode.get(normalised);
    if (coupon === undefined) return { kind: "rejected", code: raw, reason: "unknown" };

    const rejection = availabilityRejection(coupon, subtotal, nowIsInvalid, now);
    if (rejection !== null) return rejection;

    // Step 6.
    const { scopeTotal, base } = couponScope(coupon, totals, remainder, tierPct);
    const discount = discountFor(coupon, base);

    // Step 7: a coupon worth nothing is not applied. The reason follows the
    // scope the code covers, not its base (D-16).
    if (discount === 0) {
      return {
        kind: "rejected",
        code: coupon.code,
        reason: scopeTotal === 0 ? "no-effect" : "too-small",
      };
    }

    return { kind: "candidate", code: coupon.code, discount };
  });

  // Step 8.
  const winnerIndex = selectWinner(outcomes);
  const winner = winnerIndex === -1 ? undefined : outcomes[winnerIndex];

  // Steps 9 and 10: the winner's discount and catalog spelling, or the neutral
  // values when no code survived (D-7, D-19).
  const couponDiscount = winner?.kind === "candidate" ? winner.discount : 0;
  const appliedCouponCode = winner?.kind === "candidate" ? winner.code : null;

  // Steps 11 and 12.
  const shipping = shippingKopecks(order);
  return {
    subtotalKopecks: subtotal,
    tierDiscountKopecks: tierDiscount,
    couponDiscountKopecks: couponDiscount,
    appliedCouponCode,
    rejectedCoupons: orderedRejections(outcomes, winnerIndex),
    shippingKopecks: shipping,
    totalKopecks: subtotal - tierDiscount - couponDiscount + shipping,
  };
}
