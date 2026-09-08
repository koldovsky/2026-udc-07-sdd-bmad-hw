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
  items: [item({ unitPriceKopecks: 100_000 })], // 1 000 грн
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...over,
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "CODE",
  kind: "percent",
  value: 10,
  expiresAt: "2099-01-01", // far future, never expired in tests
  ...over,
});

describe("priceOrder", () => {
  it("AC-1: Gold tier discount without coupons", () => {
    const result = priceOrder(order({ customerTier: "gold" }), []);
    expect(result.breakdown.tierDiscountKopecks).toBe(10_000); // 100 грн
    expect(result.breakdown.totalKopecks - result.breakdown.shippingKopecks).toBe(90_000); // 900 грн
    expect(result.couponErrors).toEqual([]);
  });

  it("AC-2: two coupons entered, one expired", () => {
    const coupons: Coupon[] = [
      coupon({ code: "OLD", expiresAt: "2020-01-01" }),
      coupon({ code: "OK", value: 10 }),
    ];
    const result = priceOrder(order({ coupons: ["OLD", "OK"] }), coupons);
    expect(result.couponErrors).toEqual([{ code: "OLD", message: "Промокод OLD прострочено" }]);
    // valid coupon still applied: 10% of 100 000
    expect(result.breakdown.couponDiscountKopecks).toBe(10_000);
  });

  it("AC-3: two coupons on the same category", () => {
    const o = order({
      items: [item({ category: "fresh", unitPriceKopecks: 50_000 })], // 500 грн
      coupons: ["FRESH10", "FRESH20"],
    });
    const coupons: Coupon[] = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
      coupon({ code: "FRESH20", kind: "percent", value: 20, category: "fresh" }),
    ];
    const result = priceOrder(o, coupons);
    // 10% of 500 грн = 50 грн, then 20% of remaining 450 грн = 90 грн
    expect(result.breakdown.couponDiscountKopecks).toBe(14_000); // 140 грн
  });

  it("AC-4: category coupon discount exceeds the order (floors at 0)", () => {
    const o = order({
      customerTier: "gold",
      items: [item({ category: "fresh", unitPriceKopecks: 50_000 })], // 500 грн
      coupons: ["BIGFRESH"],
    });
    const coupons: Coupon[] = [
      coupon({ code: "BIGFRESH", kind: "fixed", value: 48_000, category: "fresh" }), // 480 грн
    ];
    const result = priceOrder(o, coupons);
    // tier: 10% of 500 = 50 грн -> remaining 450 грн; category coupon base is
    // the category's raw 500 грн (D-12), so 480 грн discount overshoots the
    // 450 грн actually remaining.
    expect(result.breakdown.totalKopecks).toBe(result.breakdown.shippingKopecks);
  });

  it("AC-5: Gold tier and a percent coupon combine sequentially", () => {
    const result = priceOrder(order({ customerTier: "gold", coupons: ["P15"] }), [
      coupon({ code: "P15", kind: "percent", value: 15 }),
    ]);
    expect(result.breakdown.tierDiscountKopecks).toBe(10_000); // 100 грн
    expect(result.breakdown.couponDiscountKopecks).toBe(13_500); // 135 грн
    expect(result.breakdown.totalKopecks - result.breakdown.shippingKopecks).toBe(76_500); // 765 грн
  });

  it("AC-6: Silver tier discount without coupons", () => {
    const result = priceOrder(order({ customerTier: "silver" }), []);
    expect(result.breakdown.tierDiscountKopecks).toBe(5_000); // 50 грн
    expect(result.breakdown.totalKopecks - result.breakdown.shippingKopecks).toBe(95_000); // 950 грн
  });

  it("AC-7: Silver tier and a percent coupon combine sequentially", () => {
    const result = priceOrder(order({ customerTier: "silver", coupons: ["P15"] }), [
      coupon({ code: "P15", kind: "percent", value: 15 }),
    ]);
    expect(result.breakdown.tierDiscountKopecks).toBe(5_000); // 50 грн
    expect(result.breakdown.couponDiscountKopecks).toBe(14_250); // 142.50 грн
    expect(result.breakdown.totalKopecks - result.breakdown.shippingKopecks).toBe(80_750); // 807.50 грн
  });

  it("AC-8: order subtotal below the coupon's minimum", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 5_000 })], // 50 грн
      coupons: ["MIN100"],
    });
    const coupons: Coupon[] = [coupon({ code: "MIN100", minSubtotalKopecks: 10_000 })]; // 100 грн
    const result = priceOrder(o, coupons);
    expect(result.couponErrors).toEqual([
      {
        code: "MIN100",
        message: "Сума товару у кошику менша за мінімальну суму (100 грн) для цього промокоду",
      },
    ]);
    expect(result.breakdown.couponDiscountKopecks).toBe(0);
  });

  it("AC-9: fractional kopeck from tier discount rounds down", () => {
    const o = order({
      customerTier: "silver",
      items: [item({ unitPriceKopecks: 1_010 })], // 10 грн 10 коп
    });
    const result = priceOrder(o, []);
    // 5% of 1010 = 50.5 -> floors to 50
    expect(result.breakdown.tierDiscountKopecks).toBe(50);
    expect(result.breakdown.totalKopecks - result.breakdown.shippingKopecks).toBe(960);
  });

  it("AC-10: a valid coupon without any loyalty tier", () => {
    const result = priceOrder(order({ customerTier: "none", coupons: ["P10"] }), [
      coupon({ code: "P10", kind: "percent", value: 10 }),
    ]);
    expect(result.breakdown.tierDiscountKopecks).toBe(0);
    expect(result.breakdown.couponDiscountKopecks).toBe(10_000); // 10% of the full 1000 грн
  });

  it("AC-11: a fixed coupon applies before a percent coupon", () => {
    const result = priceOrder(order({ coupons: ["PCT10", "FIX50"] }), [
      coupon({ code: "PCT10", kind: "percent", value: 10 }),
      coupon({ code: "FIX50", kind: "fixed", value: 5_000 }), // 50 грн
    ]);
    // fixed runs first regardless of entry order: 1000 - 50 = 950, then 10% of 950 = 95
    expect(result.breakdown.couponDiscountKopecks).toBe(14_500); // 145 грн
    expect(result.breakdown.totalKopecks - result.breakdown.shippingKopecks).toBe(85_500); // 855 грн
  });

  it("boundary: empty order has no discounts and no items to charge for", () => {
    const result = priceOrder(order({ items: [] }), []);
    expect(result.breakdown.subtotalKopecks).toBe(0);
    expect(result.breakdown.tierDiscountKopecks).toBe(0);
    expect(result.breakdown.couponDiscountKopecks).toBe(0);
    expect(result.breakdown.totalKopecks).toBe(0);
    expect(result.couponErrors).toEqual([]);
  });

  it("D-13 (no matching AC): an unknown coupon code is reported without blocking valid ones", () => {
    const result = priceOrder(order({ coupons: ["GHOST", "P10"] }), [
      coupon({ code: "P10", kind: "percent", value: 10 }),
    ]);
    expect(result.couponErrors).toEqual([{ code: "GHOST", message: "Промокод GHOST не знайдено" }]);
    expect(result.breakdown.couponDiscountKopecks).toBe(10_000);
  });
});
