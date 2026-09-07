// One test per acceptance criterion of docs/spec/pricing-discounts.md, named
// after the criterion id so the spec link shows in the test output.
//
// Two rules from section 5 of the specification shape every assertion:
//   - every criterion checks all seven breakdown fields, so unnamed fields must
//     hold their neutral values;
//   - every rejection is compared as a whole object, so `minSubtotalKopecks` is
//     absent rather than present-and-undefined.
// Both need `toStrictEqual`: `toEqual` ignores a property whose value is
// undefined, which is exactly the distinction AC-40 and AC-57 pin down.

import { describe, it, expect } from "vitest";
import { priceOrder } from "./discounts.js";
import type { PriceBreakdown } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

/** Section 5 default: the instant every criterion is evaluated at. */
const NOW = new Date("2026-09-05T12:00:00Z");
/** Section 5 default: the expiry of any coupon a criterion calls "valid". */
const VALID_UNTIL = "2027-01-01T00:00:00Z";

const item = (over: Partial<LineItem> = {}): LineItem => ({
  sku: "AA-1",
  name: "Thing",
  unitPriceKopecks: 100_000,
  quantity: 1,
  category: "standard",
  ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: "o1",
  items: [item()],
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...over,
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "SAVE10",
  kind: "percent",
  value: 10,
  expiresAt: VALID_UNTIL,
  ...over,
});

/**
 * The neutral breakdown of section 5. `subtotalKopecks` and `totalKopecks` have
 * no neutral value and are named by every criterion.
 */
const breakdown = (over: Partial<PriceBreakdown> = {}): PriceBreakdown => ({
  subtotalKopecks: 0,
  tierDiscountKopecks: 0,
  couponDiscountKopecks: 0,
  appliedCouponCode: null,
  rejectedCoupons: [],
  shippingKopecks: 4_900,
  totalKopecks: 0,
  ...over,
});

const amounts = (b: PriceBreakdown): number[] => [
  b.subtotalKopecks,
  b.tierDiscountKopecks,
  b.couponDiscountKopecks,
  b.shippingKopecks,
  b.totalKopecks,
];

// Several criteria feed values the compile-time contract forbids, which is the
// whole point of them. The cast keeps that intent local and visible.
const malformed = <T>(value: unknown): T => value as T;

describe("tier and coupon interaction", () => {
  it("AC-1: gold tier discounts the items and nothing else", () => {
    const result = priceOrder(order({ customerTier: "gold" }), [], NOW);
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 10_000,
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-2: the coupon applies to what the tier discount left", () => {
    const result = priceOrder(
      order({ customerTier: "gold", coupons: ["SAVE15"] }),
      [coupon({ code: "SAVE15", value: 15 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 10_000,
        couponDiscountKopecks: 13_500,
        appliedCouponCode: "SAVE15",
        totalKopecks: 81_400,
      }),
    );
  });

  it("AC-7: an international order keeps full shipping and discounts only items", () => {
    const result = priceOrder(
      order({ customerTier: "gold", country: "DE" }),
      [],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 10_000,
        shippingKopecks: 19_900,
        totalKopecks: 109_900,
      }),
    );
  });

  it("AC-23: silver tier takes 5% before the coupon", () => {
    const result = priceOrder(
      order({ customerTier: "silver", coupons: ["SAVE20"] }),
      [coupon({ code: "SAVE20", value: 20 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 5_000,
        couponDiscountKopecks: 19_000,
        appliedCouponCode: "SAVE20",
        totalKopecks: 80_900,
      }),
    );
  });

  it("AC-34: a fully digital order pays no shipping", () => {
    const result = priceOrder(
      order({ items: [item({ category: "digital" })], coupons: ["SAVE10"] }),
      [coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        shippingKopecks: 0,
        totalKopecks: 90_000,
      }),
    );
  });
});

describe("typed-code normalisation", () => {
  it("AC-9: the same code typed twice is applied once and reported never", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10", "SAVE10"] }),
      [coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-10: matching ignores case and surrounding whitespace", () => {
    const result = priceOrder(
      order({ coupons: ["  save10  "] }),
      [coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-22: a blank entry is not a typed code at all", () => {
    const result = priceOrder(
      order({ coupons: ["   ", "SAVE10"] }),
      [coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-41: a non-string entry is ignored like a blank one and never throws", () => {
    const result = priceOrder(
      order({ coupons: [malformed<string>(null), "SAVE10"] }),
      [coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });
});

describe("catalog lookup", () => {
  it("AC-8: a code absent from the catalog is rejected as unknown", () => {
    const result = priceOrder(order({ coupons: ["NOPE"] }), [coupon()], NOW);
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "NOPE", reason: "unknown" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-28: the applied code is the catalog spelling, not the typed one", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ code: "save10" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "save10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-29: an unknown code is echoed exactly as typed, whitespace included", () => {
    const result = priceOrder(
      order({ coupons: ["  bogus  "] }),
      [coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "  bogus  ", reason: "unknown" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-33: two catalog entries with the same code resolve to the first", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon(), coupon({ value: 50 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-61: a non-string catalog code is unreachable, not fatal", () => {
    const corrupt = coupon({ code: malformed<string>(null) });

    // In front of a valid entry: the bad key must not stop the lookup finding
    // the good one, and must not throw on the way past it.
    const withValid = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [corrupt, coupon()],
      NOW,
    );
    expect(withValid).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );

    // Alone in the catalog: the entry matches nothing, so the typed code is
    // reported as unknown rather than swallowed (D-33, I-1).
    const alone = priceOrder(order({ coupons: ["SAVE10"] }), [corrupt], NOW);
    expect(alone).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "unknown" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-44: an empty catalog rejects every code and still prices the order", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10", "MINUS50"] }),
      [],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [
          { code: "SAVE10", reason: "unknown" },
          { code: "MINUS50", reason: "unknown" },
        ],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-45: lookup runs before the clock, so an unknown code stays unknown", () => {
    const result = priceOrder(
      order({ coupons: ["BOGUS"] }),
      [coupon()],
      new Date("not a date"),
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "BOGUS", reason: "unknown" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-54: a catalog entry differing only in case is unreachable", () => {
    const result = priceOrder(
      order({ coupons: ["save10"] }),
      [coupon(), coupon({ code: "save10", value: 50 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });
});

describe("expiry", () => {
  it("AC-4: a coupon is invalid on the instant it expires", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2026-09-01" })],
      new Date("2026-09-01T00:00:00Z"),
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-17: an out-of-range date is rejected by the regex, not by the engine's parser", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2026-13-45" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-26: a time without an explicit offset is refused", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2027-01-01T00:00:00" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-27: an Invalid Date in `now` expires every coupon instead of honouring it", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon()],
      new Date("not a date"),
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-32: one expired code does not block the others", () => {
    const result = priceOrder(
      order({ coupons: ["OLD10", "SAVE10"] }),
      [coupon({ code: "OLD10", expiresAt: "2020-01-01" }), coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        rejectedCoupons: [{ code: "OLD10", reason: "expired" }],
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-46: a calendar day that does not exist expires the coupon", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2026-02-30" })],
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-49: a real leap day survives the calendar check", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2028-02-29" })],
      new Date("2028-01-01T00:00:00Z"),
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-58: an offset beyond +14:00 is refused, +14:00 itself is accepted", () => {
    const rejected = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2027-01-01T00:00:00+14:30" })],
      NOW,
    );
    expect(rejected).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 104_900,
      }),
    );

    const accepted = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2027-01-01T00:00:00+14:00" })],
      NOW,
    );
    expect(accepted).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-59: a missing expiry date does not mean the coupon never expires", () => {
    const undated = coupon();
    delete (undated as Partial<Coupon>).expiresAt;

    const result = priceOrder(order({ coupons: ["SAVE10"] }), [undated], NOW);
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 104_900,
      }),
    );
  });
});

describe("minimum-subtotal threshold", () => {
  it("AC-6: the threshold is measured against the subtotal before the tier discount", () => {
    const result = priceOrder(
      order({ customerTier: "gold", coupons: ["SAVE10"] }),
      [coupon({ minSubtotalKopecks: 100_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 10_000,
        couponDiscountKopecks: 9_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 85_900,
      }),
    );
  });

  it("AC-15: an unmet threshold is reported with the threshold itself", () => {
    const result = priceOrder(
      order({ items: [item({ unitPriceKopecks: 50_000 })], coupons: ["SAVE10"] }),
      [coupon({ minSubtotalKopecks: 100_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 50_000,
        rejectedCoupons: [
          { code: "SAVE10", reason: "min-subtotal", minSubtotalKopecks: 100_000 },
        ],
        totalKopecks: 54_900,
      }),
    );
  });

  it("AC-35: a category coupon's threshold still measures the whole subtotal", () => {
    const result = priceOrder(
      order({
        items: [
          item({ sku: "F-1", unitPriceKopecks: 30_000, category: "fresh" }),
          item({ unitPriceKopecks: 70_000 }),
        ],
        coupons: ["FRESH10"],
      }),
      [
        coupon({
          code: "FRESH10",
          category: "fresh",
          minSubtotalKopecks: 100_000,
        }),
      ],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 3_000,
        appliedCouponCode: "FRESH10",
        totalKopecks: 101_900,
      }),
    );
  });

  it("AC-39: a threshold of 0 is set and met, not absent", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ minSubtotalKopecks: 0 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-40: an unreadable threshold closes the coupon and is not echoed", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ minSubtotalKopecks: NaN })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "min-subtotal" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-56: expiry is reported ahead of the threshold", () => {
    const result = priceOrder(
      order({ items: [item({ unitPriceKopecks: 50_000 })], coupons: ["SAVE10"] }),
      [coupon({ expiresAt: "2020-01-01", minSubtotalKopecks: 100_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 50_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "expired" }],
        totalKopecks: 54_900,
      }),
    );
  });

  it("AC-57: a negative threshold closes the coupon rather than opening it", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ minSubtotalKopecks: -1 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "min-subtotal" }],
        totalKopecks: 104_900,
      }),
    );
  });
});

describe("discount base and amount", () => {
  it("AC-5: a category coupon's base is that category, less the tier percentage", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [
          item({ sku: "F-1", unitPriceKopecks: 40_000, category: "fresh" }),
          item({ unitPriceKopecks: 60_000 }),
        ],
        coupons: ["FRESH15"],
      }),
      [coupon({ code: "FRESH15", value: 15, category: "fresh" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 10_000,
        couponDiscountKopecks: 5_400,
        appliedCouponCode: "FRESH15",
        totalKopecks: 89_500,
      }),
    );
  });

  it("AC-12: a fixed coupon larger than the order clamps to the items", () => {
    const result = priceOrder(
      order({ items: [item({ unitPriceKopecks: 30_000 })], coupons: ["MINUS500"] }),
      [coupon({ code: "MINUS500", kind: "fixed", value: 50_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 30_000,
        couponDiscountKopecks: 30_000,
        appliedCouponCode: "MINUS500",
        totalKopecks: 4_900,
      }),
    );
  });

  it("AC-13: a percentage discount rounds down to the whole kopeck", () => {
    const result = priceOrder(
      order({ items: [item({ unitPriceKopecks: 1_234 })], coupons: ["SAVE7"] }),
      [coupon({ code: "SAVE7", value: 7 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 1_234,
        couponDiscountKopecks: 86,
        appliedCouponCode: "SAVE7",
        totalKopecks: 6_048,
      }),
    );
  });

  it("AC-19: a gold category base rounds down exactly once", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [
          item({ sku: "F-1", unitPriceKopecks: 1_111, category: "fresh" }),
          item({ unitPriceKopecks: 8_889 }),
        ],
        coupons: ["FRESH50"],
      }),
      [coupon({ code: "FRESH50", value: 50, category: "fresh" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 10_000,
        tierDiscountKopecks: 1_000,
        couponDiscountKopecks: 499,
        appliedCouponCode: "FRESH50",
        totalKopecks: 13_401,
      }),
    );
  });

  it("AC-20: a fixed category coupon clamps to the category base", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [
          item({ sku: "F-1", unitPriceKopecks: 40_000, category: "fresh" }),
          item({ unitPriceKopecks: 60_000 }),
        ],
        coupons: ["FRESH500"],
      }),
      [
        coupon({
          code: "FRESH500",
          kind: "fixed",
          value: 50_000,
          category: "fresh",
        }),
      ],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 10_000,
        couponDiscountKopecks: 36_000,
        appliedCouponCode: "FRESH500",
        totalKopecks: 58_900,
      }),
    );
  });

  it("AC-24: an over-100 percentage still cannot reach outside its category", () => {
    const result = priceOrder(
      order({
        items: [
          item({ sku: "F-1", unitPriceKopecks: 30_000, category: "fresh" }),
          item({ unitPriceKopecks: 70_000 }),
        ],
        coupons: ["FRESH200"],
      }),
      [coupon({ code: "FRESH200", value: 200, category: "fresh" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 30_000,
        appliedCouponCode: "FRESH200",
        totalKopecks: 74_900,
      }),
    );
  });

  it("AC-25: a negative value gives no discount instead of a surcharge", () => {
    const result = priceOrder(
      order({ coupons: ["BROKEN"] }),
      [coupon({ code: "BROKEN", kind: "fixed", value: -5_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "BROKEN", reason: "too-small" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-36: a silver category base rounds down where the rejected formula would not", () => {
    const result = priceOrder(
      order({
        customerTier: "silver",
        items: [
          item({ sku: "F-1", unitPriceKopecks: 10, category: "fresh" }),
          item({ unitPriceKopecks: 9_990 }),
        ],
        coupons: ["FRESH50"],
      }),
      [coupon({ code: "FRESH50", value: 50, category: "fresh" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 10_000,
        tierDiscountKopecks: 500,
        couponDiscountKopecks: 4,
        appliedCouponCode: "FRESH50",
        totalKopecks: 14_396,
      }),
    );
  });

  it("AC-37: a NaN value gives no discount and never reaches the total", () => {
    const result = priceOrder(
      order({ coupons: ["BROKEN"] }),
      [coupon({ code: "BROKEN", value: NaN })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "BROKEN", reason: "too-small" }],
        totalKopecks: 104_900,
      }),
    );
    expect(Number.isNaN(result.totalKopecks)).toBe(false);
  });

  it("AC-38: a fractional fixed value gives no discount and the fields stay integers", () => {
    const result = priceOrder(
      order({ coupons: ["BROKEN"] }),
      [coupon({ code: "BROKEN", kind: "fixed", value: 1_234.5 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "BROKEN", reason: "too-small" }],
        totalKopecks: 104_900,
      }),
    );
    expect(amounts(result).every(Number.isSafeInteger)).toBe(true);
  });

  it("AC-42: an unrecognised kind gives no discount and never throws", () => {
    const result = priceOrder(
      order({ coupons: ["BROKEN"] }),
      [coupon({ code: "BROKEN", kind: malformed<Coupon["kind"]>("bogus"), value: 10 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "BROKEN", reason: "too-small" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-60: an infinite value gives no discount rather than the whole order", () => {
    const result = priceOrder(
      order({ coupons: ["BROKEN"] }),
      [coupon({ code: "BROKEN", kind: "fixed", value: Infinity })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "BROKEN", reason: "too-small" }],
        totalKopecks: 104_900,
      }),
    );
    expect(amounts(result).every(Number.isSafeInteger)).toBe(true);
  });

  it("AC-50: an item category outside the union counts in the subtotal and no category total", () => {
    const result = priceOrder(
      order({
        items: [item({ category: malformed<LineItem["category"]>("bogus") })],
        coupons: ["FRESH10"],
      }),
      [coupon({ code: "FRESH10", category: "fresh" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "FRESH10", reason: "no-effect" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-51: a null category counts as set, so the coupon covers nothing", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10"] }),
      [coupon({ category: malformed<Coupon["category"]>(null) })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "no-effect" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-52: a category outside the union covers nothing rather than everything", () => {
    const result = priceOrder(
      order({
        items: [
          item({ sku: "F-1", unitPriceKopecks: 30_000, category: "fresh" }),
          item({ unitPriceKopecks: 70_000 }),
        ],
        coupons: ["SAVE10"],
      }),
      [coupon({ category: malformed<Coupon["category"]>("bogus") })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "SAVE10", reason: "no-effect" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-53: a percentage far past the capacity bound clamps to the base", () => {
    const result = priceOrder(
      order({ coupons: ["HUGE"] }),
      [coupon({ code: "HUGE", value: 1_000_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 100_000,
        appliedCouponCode: "HUGE",
        totalKopecks: 4_900,
      }),
    );
    expect(amounts(result).every(Number.isSafeInteger)).toBe(true);
  });

  it("AC-62: an out-of-range percentage cannot make the total NaN", () => {
    const result = priceOrder(
      order({ coupons: ["OVERFLOW"] }),
      [coupon({ code: "OVERFLOW", value: Number.MAX_VALUE })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 100_000,
        appliedCouponCode: "OVERFLOW",
        totalKopecks: 4_900,
      }),
    );
    expect(amounts(result).every(Number.isSafeInteger)).toBe(true);
  });
});

describe("selection and rejection reasons", () => {
  it("AC-3: only the best of two coupons applies", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE10", "MINUS50"] }),
      [coupon(), coupon({ code: "MINUS50", kind: "fixed", value: 5_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        rejectedCoupons: [{ code: "MINUS50", reason: "superseded" }],
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-11: a coupon for a category the cart lacks has no effect", () => {
    const result = priceOrder(
      order({ coupons: ["FRESH15"] }),
      [coupon({ code: "FRESH15", value: 15, category: "fresh" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        rejectedCoupons: [{ code: "FRESH15", reason: "no-effect" }],
        totalKopecks: 104_900,
      }),
    );
  });

  it("AC-16: a tie goes to the code typed earlier", () => {
    const result = priceOrder(
      order({ coupons: ["MINUS100", "SAVE10"] }),
      [coupon({ code: "MINUS100", kind: "fixed", value: 10_000 }), coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "MINUS100",
        rejectedCoupons: [{ code: "SAVE10", reason: "superseded" }],
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-18: a discount rounded away to nothing is too-small, not no-effect", () => {
    const result = priceOrder(
      order({ items: [item({ unitPriceKopecks: 10 })], coupons: ["SAVE7"] }),
      [coupon({ code: "SAVE7", value: 7 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 10,
        rejectedCoupons: [{ code: "SAVE7", reason: "too-small" }],
        totalKopecks: 4_910,
      }),
    );
  });

  it("AC-30: rejections come out in the order the codes were typed", () => {
    const result = priceOrder(
      order({ coupons: ["BADCODE", "SAVE10", "MINUS50"] }),
      [coupon(), coupon({ code: "MINUS50", kind: "fixed", value: 5_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        rejectedCoupons: [
          { code: "BADCODE", reason: "unknown" },
          { code: "MINUS50", reason: "superseded" },
        ],
        totalKopecks: 94_900,
      }),
    );
  });

  it("AC-31: an empty base with a non-empty scope is too-small, not no-effect", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [
          item({ sku: "F-1", unitPriceKopecks: 1, category: "fresh" }),
          item({ unitPriceKopecks: 9_999 }),
        ],
        coupons: ["FRESH90"],
      }),
      [coupon({ code: "FRESH90", value: 90, category: "fresh" })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 10_000,
        tierDiscountKopecks: 1_000,
        rejectedCoupons: [{ code: "FRESH90", reason: "too-small" }],
        totalKopecks: 13_900,
      }),
    );
  });

  it("AC-55: two coupons on the same category do not compound", () => {
    const result = priceOrder(
      order({
        items: [
          item({ sku: "F-1", unitPriceKopecks: 40_000, category: "fresh" }),
          item({ unitPriceKopecks: 60_000 }),
        ],
        coupons: ["FRESH10", "FRESH20"],
      }),
      [
        coupon({ code: "FRESH10", value: 10, category: "fresh" }),
        coupon({ code: "FRESH20", value: 20, category: "fresh" }),
      ],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 8_000,
        appliedCouponCode: "FRESH20",
        rejectedCoupons: [{ code: "FRESH10", reason: "superseded" }],
        totalKopecks: 96_900,
      }),
    );
  });
});

describe("breakdown assembly", () => {
  it("AC-14: an order with no items prices to zero", () => {
    const result = priceOrder(order({ items: [] }), [], NOW);
    expect(result).toStrictEqual(
      breakdown({ subtotalKopecks: 0, shippingKopecks: 0, totalKopecks: 0 }),
    );
  });

  it("AC-21: an empty order still resolves the codes that were typed", () => {
    const result = priceOrder(
      order({ items: [], coupons: ["SAVE10"] }),
      [coupon()],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 0,
        rejectedCoupons: [{ code: "SAVE10", reason: "no-effect" }],
        shippingKopecks: 0,
        totalKopecks: 0,
      }),
    );
  });

  it("AC-43: the stated upper bounds stay inside safe-integer arithmetic", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 100_000_000_000 })],
        coupons: ["HUGE"],
      }),
      [coupon({ code: "HUGE", value: 10_000 })],
      NOW,
    );
    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000_000_000,
        tierDiscountKopecks: 10_000_000_000,
        couponDiscountKopecks: 90_000_000_000,
        appliedCouponCode: "HUGE",
        totalKopecks: 4_900,
      }),
    );
    expect(amounts(result).every(Number.isSafeInteger)).toBe(true);
  });
});

describe("invariants", () => {
  it("AC-47: every unique typed code is accounted for exactly once (I-1, I-4)", () => {
    const typed = [
      "BOGUS",
      "OLD10",
      "BIG",
      "FRESHONLY",
      "ZERO",
      "SAVE10",
      "MINUS50",
      "save10",
      "  ",
    ];
    const catalog = [
      coupon({ code: "OLD10", expiresAt: "2020-01-01" }),
      coupon({ code: "BIG", minSubtotalKopecks: 200_000 }),
      coupon({ code: "FRESHONLY", category: "fresh" }),
      coupon({ code: "ZERO", kind: "fixed", value: 0 }),
      coupon(),
      coupon({ code: "MINUS50", kind: "fixed", value: 5_000 }),
    ];

    const result = priceOrder(order({ coupons: typed }), catalog, NOW);

    expect(result).toStrictEqual(
      breakdown({
        subtotalKopecks: 100_000,
        couponDiscountKopecks: 10_000,
        appliedCouponCode: "SAVE10",
        rejectedCoupons: [
          { code: "BOGUS", reason: "unknown" },
          { code: "OLD10", reason: "expired" },
          { code: "BIG", reason: "min-subtotal", minSubtotalKopecks: 200_000 },
          { code: "FRESHONLY", reason: "no-effect" },
          { code: "ZERO", reason: "too-small" },
          { code: "MINUS50", reason: "superseded" },
        ],
        totalKopecks: 94_900,
      }),
    );

    // I-1: six rejections plus one applied code is the seven unique non-blank
    // codes typed — nothing vanished and nothing was counted twice.
    const applied = result.appliedCouponCode !== null ? 1 : 0;
    expect(result.rejectedCoupons.length + applied).toBe(7);
    // I-4: a superseded rejection implies there is a winner to name.
    expect(
      result.rejectedCoupons.some((r) => r.reason === "superseded"),
    ).toBe(true);
    expect(result.appliedCouponCode).not.toBeNull();
  });

  it("AC-48: the call is pure and the breakdown adds up in whole kopecks (I-2, I-3, I-5)", () => {
    const o = order({
      customerTier: "gold",
      items: [
        item({ sku: "F-1", unitPriceKopecks: 1_111, category: "fresh" }),
        item({ unitPriceKopecks: 8_889 }),
      ],
      coupons: ["FRESH50"],
    });
    const catalog = [coupon({ code: "FRESH50", value: 50, category: "fresh" })];
    const orderBefore = structuredClone(o);
    const catalogBefore = structuredClone(catalog);

    const first = priceOrder(o, catalog, NOW);
    const second = priceOrder(o, catalog, NOW);

    // I-5: same inputs, same output; neither argument is touched.
    expect(first).toStrictEqual(second);
    expect(o).toStrictEqual(orderBefore);
    expect(catalog).toStrictEqual(catalogBefore);

    // I-3: every amount is a whole kopeck inside the safe-integer range.
    expect(amounts(first).every(Number.isSafeInteger)).toBe(true);

    // I-2: the breakdown is an identity, and no part of it goes negative.
    expect(
      first.subtotalKopecks -
        first.tierDiscountKopecks -
        first.couponDiscountKopecks,
    ).toBeGreaterThanOrEqual(0);
    expect(first.totalKopecks).toBe(
      first.subtotalKopecks -
        first.tierDiscountKopecks -
        first.couponDiscountKopecks +
        first.shippingKopecks,
    );
  });
});
