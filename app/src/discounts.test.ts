import { describe, expect, it } from "vitest";
import {
  ExpiredCouponError,
  priceOrder,
  type PriceBreakdown,
} from "./discounts.js";
import {
  ExpiredCouponError as ExportedExpiredCouponError,
  priceOrder as exportedPriceOrder,
  type PriceBreakdown as ExportedPriceBreakdown,
} from "./index.js";
import { subtotalKopecks } from "./pricing.js";
import type { Coupon, LineItem, Order } from "./types.js";

const VALID_EXPIRY = "2099-12-31T23:59:59.999Z";
const EXPIRED = "2020-01-01T00:00:00.000Z";

const item = (over: Partial<LineItem> = {}): LineItem => ({
  sku: "AA-1",
  name: "Thing",
  unitPriceKopecks: 25_000,
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
  expiresAt: VALID_EXPIRY,
  ...over,
});

describe("percentOfCeil rounding", () => {
  it("rounds an exact percentage up to whole kopecks", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 10_000 })],
      }),
      [],
    );
    expect(result.tierDiscountKopecks).toBe(1_000);
  });

  it("rounds a fractional percentage up to whole kopecks", () => {
    const result = priceOrder(
      order({
        customerTier: "silver",
        items: [item({ unitPriceKopecks: 3_333 })],
        coupons: ["SAVE10"],
      }),
      [coupon({ code: "SAVE10", value: 10 })],
    );
    expect(result.tierDiscountKopecks).toBe(167);
  });
});

describe("category bucket ledger", () => {
  it("covers a mixed standard/fresh subtotal before discounts", () => {
    const mixed = order({
      items: [
        item({ category: "standard", unitPriceKopecks: 30_000, quantity: 2 }),
        item({ category: "fresh", unitPriceKopecks: 20_000 }),
      ],
    });
    const result = priceOrder(mixed, []);
    expect(subtotalKopecks(mixed)).toBe(80_000);
    expect(result.subtotalKopecks).toBe(80_000);
    expect(
      result.subtotalKopecks - result.tierDiscountKopecks - result.couponDiscountKopecks,
    ).toBe(80_000);
  });
});

describe("ExpiredCouponError", () => {
  it("exposes the offending code on the error instance", () => {
    try {
      priceOrder(order({ coupons: ["OLD"] }), [
        coupon({ code: "OLD", expiresAt: EXPIRED }),
      ]);
      expect.fail("expected ExpiredCouponError");
    } catch (error) {
      expect(error).toBeInstanceOf(ExpiredCouponError);
      expect((error as ExpiredCouponError).code).toBe("OLD");
    }
  });
});

describe("package entry point", () => {
  it("re-exports priceOrder, PriceBreakdown and ExpiredCouponError", () => {
    const breakdown: ExportedPriceBreakdown = exportedPriceOrder(order(), []);
    expect(breakdown.subtotalKopecks).toBe(25_000);
    expect(ExportedExpiredCouponError).toBe(ExpiredCouponError);
  });
});

describe("AC-1: gold customer, no coupons", () => {
  it("applies 10% tier discount to goods only and charges shipping separately", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 100_000 })],
      }),
      [],
    );

    expect(result).toEqual<PriceBreakdown>({
      subtotalKopecks: 100_000,
      tierDiscountKopecks: 10_000,
      couponDiscountKopecks: 0,
      shippingKopecks: 4_900,
      totalKopecks: 94_900,
    });
  });
});

describe("AC-2: expired coupon", () => {
  it("throws ExpiredCouponError before producing a breakdown", () => {
    expect(() =>
      priceOrder(order({ coupons: ["OLD"], items: [item({ unitPriceKopecks: 10_000 })] }), [
        coupon({ code: "OLD", expiresAt: EXPIRED }),
      ]),
    ).toThrow(ExpiredCouponError);

    try {
      priceOrder(order({ coupons: ["OLD"], items: [item({ unitPriceKopecks: 10_000 })] }), [
        coupon({ code: "OLD", expiresAt: EXPIRED }),
      ]);
    } catch (error) {
      expect((error as ExpiredCouponError).code).toBe("OLD");
      expect((error as Error).message).toContain("OLD");
    }
  });

  it("throws even when the coupon would fail minSubtotalKopecks", () => {
    expect(() =>
      priceOrder(order({ coupons: ["OLD"], items: [item({ unitPriceKopecks: 10_000 })] }), [
        coupon({
          code: "OLD",
          expiresAt: EXPIRED,
          minSubtotalKopecks: 50_000,
        }),
      ]),
    ).toThrow(ExpiredCouponError);
  });
});

describe("AC-3: two coupons on the same category", () => {
  it("applies both fresh coupons sequentially on the remaining fresh amount", () => {
    const result = priceOrder(
      order({
        items: [
          item({ category: "fresh", unitPriceKopecks: 50_000 }),
          item({ category: "standard", unitPriceKopecks: 50_000 }),
        ],
        coupons: ["FRESH20", "FRESH10"],
      }),
      [
        coupon({ code: "FRESH20", value: 20, category: "fresh" }),
        coupon({ code: "FRESH10", value: 10, category: "fresh" }),
      ],
    );

    expect(result.couponDiscountKopecks).toBe(14_000);
    expect(result.totalKopecks).toBe(90_900);
  });
});

describe("AC-4: discount larger than the order", () => {
  it("skips the oversized coupon and still applies later coupons", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 5_000 })],
        coupons: ["BIG", "SMALL"],
      }),
      [
        coupon({ code: "BIG", kind: "fixed", value: 10_000 }),
        coupon({ code: "SMALL", kind: "fixed", value: 3_000 }),
      ],
    );

    expect(result.couponDiscountKopecks).toBe(3_000);
    expect(result.totalKopecks).toBe(6_900);
  });
});

describe("AC-5: empty order", () => {
  it("returns all zeros without error", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [],
        coupons: ["SAVE10"],
      }),
      [coupon({ code: "SAVE10", value: 10 })],
    );

    expect(result).toEqual<PriceBreakdown>({
      subtotalKopecks: 0,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      shippingKopecks: 0,
      totalKopecks: 0,
    });
  });
});

describe("AC-6: minSubtotalKopecks after earlier discounts", () => {
  it("skips VIP when the tier discount drops the remaining amount below the threshold", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["VIP"],
      }),
      [coupon({ code: "VIP", value: 10, minSubtotalKopecks: 95_000 })],
    );

    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.totalKopecks).toBe(94_900);
  });
});

describe("AC-7: category coupon base", () => {
  it("computes the discount from the fresh category amount only", () => {
    const result = priceOrder(
      order({
        items: [
          item({ category: "standard", unitPriceKopecks: 60_000 }),
          item({ category: "fresh", unitPriceKopecks: 40_000 }),
        ],
        coupons: ["FRESH25"],
      }),
      [coupon({ code: "FRESH25", value: 25, category: "fresh" })],
    );

    expect(result.couponDiscountKopecks).toBe(10_000);
  });
});

describe("AC-8: category coupon minSubtotal is order-wide", () => {
  it("checks minSubtotalKopecks against the order-wide remaining amount", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [
          item({ category: "standard", unitPriceKopecks: 60_000 }),
          item({ category: "fresh", unitPriceKopecks: 40_000 }),
        ],
        coupons: ["FRESH25"],
      }),
      [
        coupon({
          code: "FRESH25",
          value: 25,
          category: "fresh",
          minSubtotalKopecks: 85_000,
        }),
      ],
    );

    expect(result.couponDiscountKopecks).toBe(9_000);
  });
});

describe("AC-9: rounding up at each step", () => {
  it("ceil-rounds tier and coupon discounts separately", () => {
    const result = priceOrder(
      order({
        customerTier: "silver",
        items: [item({ unitPriceKopecks: 3_333 })],
        coupons: ["SAVE10"],
      }),
      [coupon({ code: "SAVE10", value: 10 })],
    );

    expect(result.tierDiscountKopecks).toBe(167);
    expect(result.couponDiscountKopecks).toBe(317);
    expect(result.totalKopecks).toBe(7_749);
  });
});

describe("AC-10: repeated coupon code", () => {
  it("applies the same code only once", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 10_000 })],
        coupons: ["SAVE10", "SAVE10"],
      }),
      [coupon({ code: "SAVE10", value: 10 })],
    );

    expect(result.couponDiscountKopecks).toBe(1_000);
  });
});

describe("AC-11: unknown coupon code", () => {
  it("ignores unknown codes and still applies known ones", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 10_000 })],
        coupons: ["NOPE", "SAVE10"],
      }),
      [coupon({ code: "SAVE10", value: 10 })],
    );

    expect(result.couponDiscountKopecks).toBe(1_000);
  });
});

describe("AC-12: order-wide fixed allocation", () => {
  it("allocates fixed cash across buckets before a fresh percent coupon", () => {
    const result = priceOrder(
      order({
        items: [
          item({ category: "standard", unitPriceKopecks: 60_000 }),
          item({ category: "fresh", unitPriceKopecks: 40_000 }),
        ],
        coupons: ["CASH", "FRESH50"],
      }),
      [
        coupon({ code: "CASH", kind: "fixed", value: 10_001 }),
        coupon({ code: "FRESH50", value: 50, category: "fresh" }),
      ],
    );

    expect(result.couponDiscountKopecks).toBe(28_001);
    expect(result.totalKopecks).toBe(76_899);
  });
});

describe("AC-13: tier discount reaches every category", () => {
  it("applies tier per bucket before a category coupon uses the fresh remainder", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [
          item({ category: "standard", unitPriceKopecks: 60_000 }),
          item({ category: "fresh", unitPriceKopecks: 40_000 }),
        ],
        coupons: ["FRESH25"],
      }),
      [coupon({ code: "FRESH25", value: 25, category: "fresh" })],
    );

    expect(result.tierDiscountKopecks).toBe(10_000);
    expect(result.couponDiscountKopecks).toBe(9_000);
  });
});
