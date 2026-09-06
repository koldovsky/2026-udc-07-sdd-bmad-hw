import { describe, it, expect } from "vitest";
import { priceOrder } from "./discounts.js";
import type { Order, LineItem, Coupon } from "./types.js";

// Amounts are whole kopecks. 25_000 = 250 грн.
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
  code: "C",
  kind: "percent",
  value: 10,
  expiresAt: "2099-01-01T00:00:00Z",
  ...over,
});

describe("priceOrder", () => {
  it("AC-1: gold tier 10% applied to the items subtotal, no coupons", () => {
    const o = order({ customerTier: "gold", items: [item({ unitPriceKopecks: 100_000 })] });
    const b = priceOrder(o, []);
    expect(b).toEqual({
      subtotalKopecks: 100_000,
      tierDiscountKopecks: 10_000,
      couponDiscountKopecks: 0,
      shippingKopecks: 4_900,
      totalKopecks: 94_900,
    });
  });

  it("AC-2: expired coupon is a silent skip, no throw", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 50_000 })],
      coupons: ["EXP"],
    });
    const catalogue = [coupon({ code: "EXP", expiresAt: "2026-08-01T00:00:00Z" })];
    const now = new Date("2026-09-01T00:00:00Z");
    expect(() => priceOrder(o, catalogue, now)).not.toThrow();
    const b = priceOrder(o, catalogue, now);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(54_900);
  });

  it("AC-3: two coupons on the same category apply sequentially", () => {
    const o = order({
      items: [item({ category: "fresh", unitPriceKopecks: 40_000 })],
      coupons: ["A", "B"],
    });
    const catalogue = [
      coupon({ code: "A", value: 10, category: "fresh" }),
      coupon({ code: "B", value: 10, category: "fresh" }),
    ];
    // A: 10% of 40_000 = 4_000; B: 10% of the remaining 36_000 = 3_600
    expect(priceOrder(o, catalogue).couponDiscountKopecks).toBe(7_600);
  });

  it("AC-4: a fixed coupon larger than the base is capped, total never negative", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 20_000 })],
      coupons: ["BIG"],
    });
    const catalogue = [coupon({ code: "BIG", kind: "fixed", value: 50_000 })];
    const b = priceOrder(o, catalogue);
    expect(b.couponDiscountKopecks).toBe(20_000);
    expect(b.subtotalKopecks - b.tierDiscountKopecks - b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(b.shippingKopecks);
    expect(b.totalKopecks).toBe(4_900);
  });

  it("AC-5: empty order is all zeros", () => {
    const b = priceOrder(order({ items: [] }), []);
    expect(b).toEqual({
      subtotalKopecks: 0,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      shippingKopecks: 0,
      totalKopecks: 0,
    });
  });

  it("AC-6: half a kopeck in tier rounding rounds down", () => {
    const o = order({ customerTier: "silver", items: [item({ unitPriceKopecks: 2_510 })] });
    // 5% of 2_510 = 125.5 → 125, not 126
    expect(priceOrder(o, []).tierDiscountKopecks).toBe(125);
  });

  it("AC-7: minSubtotal is checked against the original subtotal, inclusive", () => {
    const o = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["MIN"],
    });
    const catalogue = [coupon({ code: "MIN", value: 10, minSubtotalKopecks: 100_000 })];
    // threshold met by the original 100_000 (not the 90_000 left after the tier);
    // coupon applies against the 90_000 remainder → 9_000
    expect(priceOrder(o, catalogue).couponDiscountKopecks).toBe(9_000);
  });

  it("AC-8: the same code entered twice is applied once", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["SAVE10", "SAVE10"],
    });
    const catalogue = [coupon({ code: "SAVE10", value: 10 })];
    expect(priceOrder(o, catalogue).couponDiscountKopecks).toBe(10_000);
  });

  it("AC-9: a code missing from the catalogue is a silent skip, no throw", () => {
    const o = order({ items: [item({ unitPriceKopecks: 30_000 })], coupons: ["FAKE1"] });
    expect(() => priceOrder(o, [])).not.toThrow();
    expect(priceOrder(o, []).couponDiscountKopecks).toBe(0);
  });

  it("AC-10: a category coupon is a percentage of that category's subtotal", () => {
    const o = order({
      items: [
        item({ category: "fresh", unitPriceKopecks: 30_000 }),
        item({ category: "standard", unitPriceKopecks: 70_000 }),
      ],
      coupons: ["FR"],
    });
    const catalogue = [coupon({ code: "FR", value: 20, category: "fresh" })];
    // 20% of the 30_000 fresh subtotal, not of the 100_000 order
    expect(priceOrder(o, catalogue).couponDiscountKopecks).toBe(6_000);
  });

  it("AC-11: tier and a percentage coupon stack sequentially, not additively", () => {
    const o = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["P15"],
    });
    const catalogue = [coupon({ code: "P15", value: 15 })];
    const b = priceOrder(o, catalogue);
    expect(b.tierDiscountKopecks).toBe(10_000);
    // 15% of the 90_000 left after the tier = 13_500 (not 15_000)
    expect(b.couponDiscountKopecks).toBe(13_500);
    expect(b.tierDiscountKopecks + b.couponDiscountKopecks).toBe(23_500);
  });

  it("AC-12: an order-wide discount does not shrink the category base", () => {
    const o = order({
      items: [
        item({ category: "fresh", unitPriceKopecks: 30_000 }),
        item({ category: "standard", unitPriceKopecks: 70_000 }),
      ],
      coupons: ["OW", "FR"],
    });
    const catalogue = [
      coupon({ code: "OW", kind: "fixed", value: 10_000 }),
      coupon({ code: "FR", value: 20, category: "fresh" }),
    ];
    // OW: 10_000 off the order; FR: still 20% of the original 30_000 fresh = 6_000
    expect(priceOrder(o, catalogue).couponDiscountKopecks).toBe(16_000);
  });

  it("AC-13: now exactly equal to expiresAt counts as expired", () => {
    const o = order({ items: [item({ unitPriceKopecks: 50_000 })], coupons: ["EDGE"] });
    const at = "2026-09-01T00:00:00.000Z";
    const catalogue = [coupon({ code: "EDGE", expiresAt: at })];
    expect(priceOrder(o, catalogue, new Date(at)).couponDiscountKopecks).toBe(0);
  });

  it("AC-14: a category coupon is also capped by the order remainder", () => {
    const o = order({
      items: [
        item({ category: "fresh", unitPriceKopecks: 30_000 }),
        item({ category: "standard", unitPriceKopecks: 70_000 }),
      ],
      coupons: ["OW95", "FR"],
    });
    const catalogue = [
      coupon({ code: "OW95", kind: "fixed", value: 95_000 }),
      coupon({ code: "FR", value: 20, category: "fresh" }),
    ];
    const b = priceOrder(o, catalogue);
    // FR nominal is 6_000 but only 5_000 is left in the order → capped at 5_000
    expect(b.couponDiscountKopecks).toBe(100_000);
    expect(b.subtotalKopecks - b.tierDiscountKopecks - b.couponDiscountKopecks).toBe(0);
  });
});
