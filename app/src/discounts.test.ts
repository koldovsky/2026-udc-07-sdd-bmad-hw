import { describe, it, expect } from "vitest";
import { priceOrder } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

const AS_OF = new Date("2026-06-01T12:00:00.000Z");
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
  it("AC-1: Gold 1000 грн без промокодів", () => {
    const o = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 100_000 })],
    });
    const price = priceOrder(o, [], AS_OF);
    expect(price.tierDiscountKopecks).toBe(10_000);
    expect(price.couponDiscountKopecks).toBe(0);
    expect(price.shippingKopecks).toBe(4_900);
    expect(price.totalKopecks).toBe(94_900);
  });

  it("AC-2: прострочений промокод — тиха відмова", () => {
    const instant = new Date("2026-01-01T00:00:00.000Z");
    const o = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["SAVE15"],
    });
    const catalog = [
      coupon({
        code: "SAVE15",
        kind: "percent",
        value: 15,
        expiresAt: "2026-01-01T00:00:00.000Z",
      }),
    ];
    expect(() => priceOrder(o, catalog, instant)).not.toThrow();
    const price = priceOrder(o, catalog, instant);
    expect(price.couponDiscountKopecks).toBe(0);
    expect(price.tierDiscountKopecks).toBe(10_000);
    expect(price.totalKopecks).toBe(94_900);
  });

  it("AC-3: два промокоди на одну категорію", () => {
    const o = order({
      items: [
        item({ sku: "F-1", unitPriceKopecks: 50_000, category: "fresh" }),
        item({ sku: "S-1", unitPriceKopecks: 50_000, category: "standard" }),
      ],
      coupons: ["FRESH10", "FRESH20"],
    });
    const catalog = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
      coupon({ code: "FRESH20", kind: "percent", value: 20, category: "fresh" }),
    ];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(15_000);
    expect(price.tierDiscountKopecks).toBe(0);
    expect(price.totalKopecks).toBe(89_900);
  });

  it("AC-4: знижка більша за суму товарів", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 10_000 })],
      coupons: ["HUGE"],
    });
    const catalog = [coupon({ code: "HUGE", kind: "fixed", value: 50_000 })];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(10_000);
    expect(price.remainingGoodsKopecks).toBe(0);
    expect(price.shippingKopecks).toBe(4_900);
    expect(price.totalKopecks).toBe(4_900);
    expect(price.subtotalKopecks).toBeGreaterThanOrEqual(0);
    expect(price.tierDiscountKopecks).toBeGreaterThanOrEqual(0);
    expect(price.couponDiscountKopecks).toBeGreaterThanOrEqual(0);
    expect(price.remainingGoodsKopecks).toBeGreaterThanOrEqual(0);
    expect(price.shippingKopecks).toBeGreaterThanOrEqual(0);
    expect(price.totalKopecks).toBeGreaterThanOrEqual(0);
  });

  it("AC-5: Gold потім 15% від залишку, не 25%", () => {
    const o = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["SAVE15"],
    });
    const catalog = [coupon({ code: "SAVE15", kind: "percent", value: 15 })];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.tierDiscountKopecks).toBe(10_000);
    expect(price.couponDiscountKopecks).toBe(13_500);
    expect(price.totalKopecks).toBe(81_400);
    expect(price.totalKopecks).not.toBe(79_900);
    expect(price.couponDiscountKopecks).not.toBe(15_000);
  });

  it("AC-6: категорійний промокод від суми категорії", () => {
    const o = order({
      items: [
        item({ sku: "S-1", unitPriceKopecks: 80_000, category: "standard" }),
        item({ sku: "F-1", unitPriceKopecks: 20_000, category: "fresh" }),
      ],
      coupons: ["FRESH10"],
    });
    const catalog = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
    ];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(2_000);
    expect(price.totalKopecks).toBe(102_900);
  });

  it("AC-7: minSubtotal по початковому кошику до знижки рівня", () => {
    const o = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 40_000 })],
      coupons: ["SAVE10"],
    });
    const catalog = [
      coupon({ code: "SAVE10", kind: "percent", value: 10, minSubtotalKopecks: 38_000 }),
    ];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.tierDiscountKopecks).toBe(4_000);
    expect(price.couponDiscountKopecks).toBe(3_600);
    expect(price.totalKopecks).toBe(37_300);
  });

  it("AC-8: порожнє замовлення — усе 0", () => {
    const o = order({
      items: [],
      customerTier: "gold",
      country: "UA",
      coupons: ["SAVE50"],
    });
    const catalog = [coupon({ code: "SAVE50", kind: "percent", value: 50 })];
    expect(() => priceOrder(o, catalog, AS_OF)).not.toThrow();
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.subtotalKopecks).toBe(0);
    expect(price.tierDiscountKopecks).toBe(0);
    expect(price.couponDiscountKopecks).toBe(0);
    expect(price.shippingKopecks).toBe(0);
    expect(price.totalKopecks).toBe(0);
  });

  it("AC-9: пів копійки при округленні half-up", () => {
    const o = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 125, category: "digital" })],
    });
    const price = priceOrder(o, [], AS_OF);
    expect(price.tierDiscountKopecks).toBe(13);
    expect(price.shippingKopecks).toBe(0);
    expect(price.totalKopecks).toBe(112);
  });

  it("AC-10: доставка не входить у базу знижки рівня", () => {
    const o = order({
      customerTier: "gold",
      country: "PL",
      items: [item({ unitPriceKopecks: 100_000 })],
    });
    const price = priceOrder(o, [], AS_OF);
    expect(price.tierDiscountKopecks).toBe(10_000);
    expect(price.tierDiscountKopecks).not.toBe(11_990);
    expect(price.shippingKopecks).toBe(19_900);
    expect(price.totalKopecks).toBe(109_900);
  });

  it("AC-11: percent потім fixed у порядку введення", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["SAVE10", "OFF50"],
    });
    const catalog = [
      coupon({ code: "SAVE10", kind: "percent", value: 10 }),
      coupon({ code: "OFF50", kind: "fixed", value: 5_000 }),
    ];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(15_000);
    expect(price.totalKopecks).toBe(89_900);
  });

  it("AC-12: той самий код двічі — один раз", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["OFF100", "OFF100"],
    });
    const catalog = [coupon({ code: "OFF100", kind: "fixed", value: 10_000 })];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(10_000);
    expect(price.totalKopecks).toBe(94_900);
  });

  it("AC-13: невідомий код тихо пропускається", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["NOSUCH", "SAVE10"],
    });
    const catalog = [coupon({ code: "SAVE10", kind: "percent", value: 10 })];
    expect(() => priceOrder(o, catalog, AS_OF)).not.toThrow();
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(10_000);
    expect(price.totalKopecks).toBe(94_900);
  });

  it("AC-14: minSubtotal не досягнуто — код не діє", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 30_000 })],
      coupons: ["SAVE10"],
    });
    const catalog = [
      coupon({ code: "SAVE10", kind: "percent", value: 10, minSubtotalKopecks: 40_000 }),
    ];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(0);
    expect(price.totalKopecks).toBe(34_900);
  });

  it("AC-15: trim і регістр коду", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: [" save10 "],
    });
    const catalog = [coupon({ code: "SAVE10", kind: "percent", value: 10 })];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(10_000);
    expect(price.totalKopecks).toBe(94_900);
  });

  it("AC-16: категорійний код без товарів цієї категорії", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000, category: "standard" })],
      coupons: ["FRESH10"],
    });
    const catalog = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
    ];
    const price = priceOrder(o, catalog, AS_OF);
    expect(price.couponDiscountKopecks).toBe(0);
    expect(price.totalKopecks).toBe(104_900);
  });

  it("AC-17: Silver 5% від товарів без промокодів", () => {
    const o = order({
      customerTier: "silver",
      items: [item({ unitPriceKopecks: 100_000 })],
    });
    const price = priceOrder(o, [], AS_OF);
    expect(price.tierDiscountKopecks).toBe(5_000);
    expect(price.couponDiscountKopecks).toBe(0);
    expect(price.shippingKopecks).toBe(4_900);
    expect(price.totalKopecks).toBe(99_900);
  });
});
