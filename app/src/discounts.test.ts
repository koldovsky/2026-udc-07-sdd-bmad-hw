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
  code: "CODE",
  kind: "percent",
  value: 10,
  expiresAt: "2999-01-01T00:00:00Z",
  ...over,
});

const FAR_FUTURE = new Date("2500-01-01T00:00:00Z");

describe("priceOrder", () => {
  it("AC-1: Gold tier alone", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      customerTier: "gold",
      country: "UA",
    });
    const result = priceOrder(o, [], FAR_FUTURE);
    expect(result.subtotalKopecks).toBe(100_000);
    expect(result.discountKopecks).toBe(10_000); // 10% of 1000 грн
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(94_900); // 949 грн
  });

  it("AC-2: tier and coupon percentages add up", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000, category: "digital" })],
      customerTier: "gold",
      coupons: ["SAVE15"],
    });
    const coupons = [coupon({ code: "SAVE15", kind: "percent", value: 15 })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(25_000); // (10% + 15%) of 1000 грн
    expect(result.shippingKopecks).toBe(0); // all digital
    expect(result.totalKopecks).toBe(75_000); // 750 грн
  });

  it("AC-3: two coupons on the same category", () => {
    const o = order({
      items: [
        item({ unitPriceKopecks: 40_000, category: "fresh" }),
        item({ unitPriceKopecks: 60_000, category: "standard" }),
      ],
      coupons: ["FRESH10", "FRESH5"],
    });
    const coupons = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
      coupon({ code: "FRESH5", kind: "percent", value: 5, category: "fresh" }),
    ];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(6_000); // 15% of 400 грн fresh
    expect(result.totalKopecks).toBe(98_900); // 940 + 49 доставка
  });

  it("AC-4: expired coupon has no effect", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["OLD20"],
    });
    const coupons = [coupon({ code: "OLD20", kind: "percent", value: 20, expiresAt: "2000-01-01T00:00:00Z" })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(0);
    expect(result.appliedCoupons).toEqual([]);
    expect(result.totalKopecks).toBe(104_900); // 1000 + 49
  });

  it("AC-5: coupon below minSubtotalKopecks does not apply", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 90_000 })],
      coupons: ["MIN1000"],
    });
    const coupons = [
      coupon({ code: "MIN1000", kind: "fixed", value: 5_000, minSubtotalKopecks: 100_000 }),
    ];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(0);
    expect(result.totalKopecks).toBe(90_000 + 4_900);
  });

  it("AC-6 (boundary): discount larger than the order is capped, never negative", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 10_000 })],
      customerTier: "gold",
      coupons: ["HUGE"],
    });
    const coupons = [coupon({ code: "HUGE", kind: "fixed", value: 200_000 })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(10_000); // capped at subtotal
    expect(result.totalKopecks).toBe(4_900); // товари 0 + доставка 49 грн
  });

  it("AC-7 (boundary): empty order does not throw", () => {
    const o = order({ items: [], customerTier: "gold", coupons: ["ANY20"] });
    const coupons = [coupon({ code: "ANY20", kind: "percent", value: 20 })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.subtotalKopecks).toBe(0);
    expect(result.discountKopecks).toBe(0);
    expect(result.shippingKopecks).toBe(0);
    expect(result.totalKopecks).toBe(0);
  });

  it("AC-8 (boundary): exact half-kopeck rounds down", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 101, quantity: 1, category: "fresh" })],
      coupons: ["HALF"],
    });
    const coupons = [coupon({ code: "HALF", kind: "percent", value: 50, category: "fresh" })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(50); // floor(50.5)
  });

  it("AC-9: unknown coupon code has no effect", () => {
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], coupons: ["NOPE"] });
    const result = priceOrder(o, [], FAR_FUTURE);
    expect(result.discountKopecks).toBe(0);
    expect(result.appliedCoupons).toEqual([]);
  });

  it("AC-10: duplicate coupon code applies once", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["SAVE10", "SAVE10"],
    });
    const coupons = [coupon({ code: "SAVE10", kind: "percent", value: 10 })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(10_000); // 10%, not 20%
    expect(result.appliedCoupons).toEqual(["SAVE10"]);
  });

  it("AC-11: discount base excludes shipping", () => {
    const domestic = order({ items: [item({ unitPriceKopecks: 100_000 })], customerTier: "gold", country: "UA" });
    const international = order({ items: [item({ unitPriceKopecks: 100_000 })], customerTier: "gold", country: "PL" });
    const a = priceOrder(domestic, [], FAR_FUTURE);
    const b = priceOrder(international, [], FAR_FUTURE);
    expect(a.discountKopecks).toBe(10_000);
    expect(b.discountKopecks).toBe(10_000);
    expect(b.totalKopecks - a.totalKopecks).toBe(19_900 - 4_900);
  });

  it("AC-12: category coupon with no matching items is valid but contributes 0", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000, category: "standard" })],
      coupons: ["FRESH15"],
    });
    const coupons = [coupon({ code: "FRESH15", kind: "percent", value: 15, category: "fresh" })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(0);
    expect(result.appliedCoupons).toEqual(["FRESH15"]);
  });

  it("AC-13: combined percentage for one category is capped at 100%", () => {
    const o = order({
      items: [
        item({ unitPriceKopecks: 50_000, category: "fresh" }),
        item({ unitPriceKopecks: 50_000, category: "standard" }),
      ],
      coupons: ["F70", "F60"],
    });
    const coupons = [
      coupon({ code: "F70", kind: "percent", value: 70, category: "fresh" }),
      coupon({ code: "F60", kind: "percent", value: 60, category: "fresh" }),
    ];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(50_000); // capped at fresh's own 500 грн, not 650 грн
    expect(result.totalKopecks).toBe(50_000 + 4_900);
  });

  it("AC-14: expiry is checked against the explicit `now` parameter", () => {
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], coupons: ["SOON"] });
    const coupons = [coupon({ code: "SOON", kind: "percent", value: 10, expiresAt: "2030-06-01T00:00:00Z" })];
    const explicitNow = new Date("2030-01-01T00:00:00Z"); // before expiresAt, unlike the real current date
    const result = priceOrder(o, coupons, explicitNow);
    expect(result.appliedCoupons).toEqual(["SOON"]);
    expect(result.discountKopecks).toBe(10_000);
  });

  it("AC-15: coupon code matching is case-sensitive", () => {
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], coupons: ["save10"] });
    const coupons = [coupon({ code: "SAVE10", kind: "percent", value: 10 })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(result.discountKopecks).toBe(0);
    expect(result.appliedCoupons).toEqual([]);
  });

  it("AC-16: breakdown reports one combined discount, not split by source", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      customerTier: "gold",
      coupons: ["SAVE15"],
    });
    const coupons = [coupon({ code: "SAVE15", kind: "percent", value: 15 })];
    const result = priceOrder(o, coupons, FAR_FUTURE);
    expect(Object.keys(result).sort()).toEqual(
      ["appliedCoupons", "discountKopecks", "shippingKopecks", "subtotalKopecks", "totalKopecks"].sort(),
    );
  });
});
