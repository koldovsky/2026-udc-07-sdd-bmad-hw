import { describe, it, expect } from "vitest";
import { priceOrder } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

const NOW = "2026-09-06T12:00:00.000Z";
const VALID_UNTIL = "2026-12-31T00:00:00.000Z";

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

const coupon = (over: Partial<Coupon> & Pick<Coupon, "code" | "kind" | "value">): Coupon => ({
  expiresAt: VALID_UNTIL,
  ...over,
});

describe("priceOrder", () => {
  it("AC-1: Gold order without coupons", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "gold",
      }),
      [],
      NOW,
    );
    expect(result).toEqual({
      subtotalKopecks: 100_000,
      tierDiscountKopecks: 10_000,
      couponDiscountKopecks: 0,
      shippingKopecks: 4_900,
      totalKopecks: 94_900,
    });
  });

  it("AC-2: expired coupon does not apply", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "gold",
        coupons: ["OLD20"],
      }),
      [
        coupon({
          code: "OLD20",
          kind: "percent",
          value: 20,
          expiresAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(10_000);
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.totalKopecks).toBe(94_900);
  });

  it("AC-3: two coupons on the same category", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000, category: "fresh" })],
        coupons: ["FRESH10", "FRESH5"],
      }),
      [
        coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
        coupon({ code: "FRESH5", kind: "percent", value: 5, category: "fresh" }),
      ],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(0);
    expect(result.couponDiscountKopecks).toBe(14_500);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(90_400);
  });

  it("AC-4: discount exceeds merchandise", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000 })],
        coupons: ["BIG500"],
      }),
      [coupon({ code: "BIG500", kind: "fixed", value: 50_000 })],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(0);
    expect(result.couponDiscountKopecks).toBe(20_000);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(4_900);
  });

  it("AC-5: half-kopeck rounds up", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 15 })],
        customerTier: "gold",
      }),
      [],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(2);
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(4_913);
  });

  it("AC-6: empty order", () => {
    expect(() =>
      priceOrder(
        order({
          items: [],
          customerTier: "gold",
          coupons: ["SAVE10"],
        }),
        [coupon({ code: "SAVE10", kind: "percent", value: 10 })],
        NOW,
      ),
    ).not.toThrow();

    const result = priceOrder(
      order({
        items: [],
        customerTier: "gold",
        coupons: ["SAVE10"],
      }),
      [coupon({ code: "SAVE10", kind: "percent", value: 10 })],
      NOW,
    );
    expect(result).toEqual({
      subtotalKopecks: 0,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      shippingKopecks: 0,
      totalKopecks: 0,
    });
  });

  it("AC-7: category coupon on fresh only", () => {
    const result = priceOrder(
      order({
        items: [
          item({ sku: "F-1", unitPriceKopecks: 60_000, category: "fresh" }),
          item({ sku: "S-1", unitPriceKopecks: 40_000, category: "standard" }),
        ],
        coupons: ["FRESH20"],
      }),
      [coupon({ code: "FRESH20", kind: "percent", value: 20, category: "fresh" })],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(0);
    expect(result.couponDiscountKopecks).toBe(12_000);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(92_900);
  });

  it("AC-8: minSubtotal on original not post-tier", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 60_000 })],
        customerTier: "gold",
        coupons: ["SAVE10"],
      }),
      [coupon({ code: "SAVE10", kind: "percent", value: 10, minSubtotalKopecks: 56_000 })],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(6_000);
    expect(result.couponDiscountKopecks).toBe(5_400);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(53_500);
  });

  it("AC-9: sequential Gold then 15 percent", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "gold",
        coupons: ["SAVE15"],
      }),
      [coupon({ code: "SAVE15", kind: "percent", value: 15 })],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(10_000);
    expect(result.couponDiscountKopecks).toBe(13_500);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(81_400);
  });

  it("AC-10: two lines round separately", () => {
    const result = priceOrder(
      order({
        items: [
          item({ sku: "A", unitPriceKopecks: 15 }),
          item({ sku: "B", unitPriceKopecks: 15 }),
        ],
        customerTier: "gold",
      }),
      [],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(4);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(4_926);
  });

  it("AC-11: minSubtotal not met", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 40_000 })],
        coupons: ["SAVE10"],
      }),
      [coupon({ code: "SAVE10", kind: "percent", value: 10, minSubtotalKopecks: 50_000 })],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(0);
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(44_900);
  });

  it("AC-12: duplicate and unknown codes", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["SAVE10", "SAVE10", "UNKNOWN"],
      }),
      [coupon({ code: "SAVE10", kind: "percent", value: 10 })],
      NOW,
    );
    expect(result.couponDiscountKopecks).toBe(10_000);
    expect(result.totalKopecks).toBe(94_900);
  });

  it("AC-13: Silver order without coupons", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "silver",
      }),
      [],
      NOW,
    );
    expect(result.tierDiscountKopecks).toBe(5_000);
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(99_900);
  });

  it("AC-14: percent outside 0-100 is skipped", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["TOO_MUCH"],
      }),
      [coupon({ code: "TOO_MUCH", kind: "percent", value: 150 })],
      NOW,
    );
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(104_900);
  });

  it("AC-15: coupon codes are case-sensitive", () => {
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["save10"],
      }),
      [coupon({ code: "SAVE10", kind: "percent", value: 10 })],
      NOW,
    );
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.totalKopecks).toBe(104_900);
  });

  it("AC-16: fixed coupon consumes items in array order", () => {
    const result = priceOrder(
      order({
        items: [
          item({ sku: "S-1", unitPriceKopecks: 10_000, category: "standard" }),
          item({ sku: "F-1", unitPriceKopecks: 10_000, category: "fresh" }),
        ],
        coupons: ["FIX15000", "FRESH50"],
      }),
      [
        coupon({ code: "FIX15000", kind: "fixed", value: 15_000 }),
        coupon({ code: "FRESH50", kind: "percent", value: 50, category: "fresh" }),
      ],
      NOW,
    );
    // FIX15000 eats standard then 5000 of fresh; FRESH50 is 2500 of the leftover 5000.
    expect(result.couponDiscountKopecks).toBe(17_500);
  });
});
