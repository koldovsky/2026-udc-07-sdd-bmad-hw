import { describe, it, expect } from "vitest";
import type { Coupon, LineItem, Order } from "../types.js";
import { percentOfKopecks, priceOrder } from "./discounts.js";

const NOW = new Date("2026-09-01T12:00:00.000Z");

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
  expiresAt: "2026-12-31T23:59:59.000Z",
  ...over,
});

describe("percentOfKopecks", () => {
  it("truncates a half-kopeck instead of rounding up", () => {
    // 1 kop × 50% = 0.5 → 0
    expect(percentOfKopecks(1, 50)).toBe(0);
    // 3 kop × 50% = 1.5 → 1
    expect(percentOfKopecks(3, 50)).toBe(1);
  });

  it("uses integer arithmetic for typical percents", () => {
    expect(percentOfKopecks(100_000, 10)).toBe(10_000);
    expect(percentOfKopecks(100_000, 5)).toBe(5_000);
    expect(percentOfKopecks(15, 10)).toBe(1);
  });
});

describe("loyalty tiers", () => {
  it("applies silver 5 percent to merchandise not shipping", () => {
    const priced = priceOrder(
      order({ customerTier: "silver", items: [item({ unitPriceKopecks: 100_000 })] }),
      [],
      NOW,
    );
    expect(priced.subtotalKopecks).toBe(100_000);
    expect(priced.tierDiscountKopecks).toBe(5_000);
    expect(priced.shippingKopecks).toBe(4_900);
    expect(priced.merchandiseKopecks).toBe(95_000);
    expect(priced.totalKopecks).toBe(99_900);
  });

  it("applies gold 10 percent to merchandise", () => {
    const priced = priceOrder(
      order({ customerTier: "gold", items: [item({ unitPriceKopecks: 100_000 })] }),
      [],
      NOW,
    );
    expect(priced.tierDiscountKopecks).toBe(10_000);
    expect(priced.totalKopecks).toBe(90_000 + 4_900);
  });

  it("applies no tier discount for none", () => {
    const priced = priceOrder(order({ customerTier: "none" }), [], NOW);
    expect(priced.tierDiscountKopecks).toBe(0);
  });
});

describe("promo codes with loyalty", () => {
  it("stacks a percent coupon sequentially after the tier discount", () => {
    // 1000 грн gold (10%) then SAVE15 (15%) on the remainder — not 25% of original
    const catalog = [coupon({ code: "SAVE15", kind: "percent", value: 15 })];
    const priced = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["SAVE15"],
      }),
      catalog,
      NOW,
    );
    expect(priced.tierDiscountKopecks).toBe(10_000);
    expect(priced.couponDiscountKopecks).toBe(13_500);
    expect(priced.merchandiseKopecks).toBe(76_500);
    expect(priced.appliedCoupons).toEqual([{ code: "SAVE15", discountKopecks: 13_500 }]);
  });

  it("stacks a fixed coupon on top of the remaining merchandise after tier", () => {
    const catalog = [coupon({ code: "UAH50", kind: "fixed", value: 5_000 })];
    const priced = priceOrder(
      order({
        customerTier: "silver",
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["UAH50"],
      }),
      catalog,
      NOW,
    );
    expect(priced.tierDiscountKopecks).toBe(5_000);
    expect(priced.couponDiscountKopecks).toBe(5_000);
    expect(priced.merchandiseKopecks).toBe(90_000);
  });
});

describe("category coupons", () => {
  it("applies a category percent only to that category remaining", () => {
    const catalog = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
    ];
    const priced = priceOrder(
      order({
        items: [
          item({ sku: "S", unitPriceKopecks: 80_000, category: "standard" }),
          item({ sku: "F", unitPriceKopecks: 20_000, category: "fresh" }),
        ],
        coupons: ["FRESH10"],
      }),
      catalog,
      NOW,
    );
    expect(priced.couponDiscountKopecks).toBe(2_000);
    expect(priced.merchandiseKopecks).toBe(98_000);
  });

  it("applies two coupons on the same category sequentially", () => {
    const catalog = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
      coupon({ code: "FRESH5", kind: "percent", value: 5, category: "fresh" }),
    ];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000, category: "fresh" })],
        coupons: ["FRESH10", "FRESH5"],
      }),
      catalog,
      NOW,
    );
    // 10% of 100_000 = 10_000, then 5% of 90_000 = 4_500
    expect(priced.appliedCoupons).toEqual([
      { code: "FRESH10", discountKopecks: 10_000 },
      { code: "FRESH5", discountKopecks: 4_500 },
    ]);
    expect(priced.couponDiscountKopecks).toBe(14_500);
  });
});

describe("minimum order amount", () => {
  it("rejects a coupon when original subtotal is below the minimum", () => {
    const catalog = [
      coupon({ code: "BIG", kind: "percent", value: 20, minSubtotalKopecks: 200_000 }),
    ];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["BIG"],
      }),
      catalog,
      NOW,
    );
    expect(priced.couponDiscountKopecks).toBe(0);
    expect(priced.rejectedCoupons).toEqual([{ code: "BIG", reason: "below-minimum" }]);
  });

  it("checks the minimum against the original subtotal not the post-tier remainder", () => {
    const catalog = [
      coupon({ code: "MIN95", kind: "fixed", value: 1_000, minSubtotalKopecks: 100_000 }),
    ];
    const priced = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["MIN95"],
      }),
      catalog,
      NOW,
    );
    // After gold remaining is 90_000, but original subtotal is 100_000 so it still applies
    expect(priced.appliedCoupons).toEqual([{ code: "MIN95", discountKopecks: 1_000 }]);
  });
});

describe("expired and unknown coupons", () => {
  it("skips an expired coupon without applying it", () => {
    const catalog = [
      coupon({
        code: "OLD",
        kind: "percent",
        value: 50,
        expiresAt: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["OLD"],
      }),
      catalog,
      NOW,
    );
    expect(priced.couponDiscountKopecks).toBe(0);
    expect(priced.rejectedCoupons).toEqual([{ code: "OLD", reason: "expired" }]);
    expect(priced.merchandiseKopecks).toBe(100_000);
  });

  it("treats a coupon as expired on the expiry instant itself", () => {
    const expiresAt = "2026-09-01T12:00:00.000Z";
    const catalog = [coupon({ code: "NOW", kind: "percent", value: 10, expiresAt })];
    const priced = priceOrder(
      order({ coupons: ["NOW"] }),
      catalog,
      new Date(expiresAt),
    );
    expect(priced.rejectedCoupons).toEqual([{ code: "NOW", reason: "expired" }]);
  });

  it("skips an unknown code so the rest of the order still prices", () => {
    const priced = priceOrder(order({ coupons: ["NOPE"] }), [], NOW);
    expect(priced.rejectedCoupons).toEqual([{ code: "NOPE", reason: "unknown" }]);
    expect(priced.totalKopecks).toBe(25_000 + 4_900);
  });
});

describe("multiple coupons", () => {
  it("applies several valid coupons in the order they were typed", () => {
    const catalog = [
      coupon({ code: "PCT10", kind: "percent", value: 10 }),
      coupon({ code: "UAH20", kind: "fixed", value: 2_000 }),
    ];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["PCT10", "UAH20"],
      }),
      catalog,
      NOW,
    );
    expect(priced.appliedCoupons).toEqual([
      { code: "PCT10", discountKopecks: 10_000 },
      { code: "UAH20", discountKopecks: 2_000 },
    ]);
    expect(priced.merchandiseKopecks).toBe(88_000);
  });

  it("applies a later coupon to the remainder after an earlier one", () => {
    const catalog = [
      coupon({ code: "UAH20", kind: "fixed", value: 2_000 }),
      coupon({ code: "PCT10", kind: "percent", value: 10 }),
    ];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["UAH20", "PCT10"],
      }),
      catalog,
      NOW,
    );
    expect(priced.appliedCoupons).toEqual([
      { code: "UAH20", discountKopecks: 2_000 },
      { code: "PCT10", discountKopecks: 9_800 },
    ]);
  });

  it("ignores a duplicate code after the first use", () => {
    const catalog = [coupon({ code: "PCT10", kind: "percent", value: 10 })];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["PCT10", "PCT10"],
      }),
      catalog,
      NOW,
    );
    expect(priced.appliedCoupons).toHaveLength(1);
    expect(priced.rejectedCoupons).toEqual([{ code: "PCT10", reason: "duplicate" }]);
    expect(priced.couponDiscountKopecks).toBe(10_000);
  });
});

describe("empty cart", () => {
  it("prices an empty cart as zero merchandise with existing shipping rules", () => {
    const catalog = [coupon({ code: "SAVE15", kind: "percent", value: 15 })];
    const priced = priceOrder(
      order({ items: [], coupons: ["SAVE15"] }),
      catalog,
      NOW,
    );
    expect(priced.subtotalKopecks).toBe(0);
    expect(priced.tierDiscountKopecks).toBe(0);
    expect(priced.couponDiscountKopecks).toBe(0);
    expect(priced.merchandiseKopecks).toBe(0);
    expect(priced.shippingKopecks).toBe(0); // shippingKopecks: empty every() is vacuously all-digital
    expect(priced.totalKopecks).toBe(0);
    expect(priced.rejectedCoupons).toEqual([
      { code: "SAVE15", reason: "no-eligible-remaining" },
    ]);
  });
});

describe("discount larger than remaining merchandise", () => {
  it("caps a fixed coupon at remaining merchandise and never goes negative", () => {
    const catalog = [coupon({ code: "HUGE", kind: "fixed", value: 500_000 })];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 10_000 })],
        coupons: ["HUGE"],
      }),
      catalog,
      NOW,
    );
    expect(priced.couponDiscountKopecks).toBe(10_000);
    expect(priced.merchandiseKopecks).toBe(0);
    expect(priced.shippingKopecks).toBe(4_900);
    expect(priced.totalKopecks).toBe(4_900);
  });

  it("rejects a later coupon once merchandise is already zero", () => {
    const catalog = [
      coupon({ code: "HUGE", kind: "fixed", value: 500_000 }),
      coupon({ code: "MORE", kind: "percent", value: 10 }),
    ];
    const priced = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 10_000 })],
        coupons: ["HUGE", "MORE"],
      }),
      catalog,
      NOW,
    );
    expect(priced.appliedCoupons).toEqual([{ code: "HUGE", discountKopecks: 10_000 }]);
    expect(priced.rejectedCoupons).toEqual([{ code: "MORE", reason: "no-eligible-remaining" }]);
  });
});

describe("shipping stays full price", () => {
  it("does not let coupons eat the shipping fee", () => {
    const catalog = [coupon({ code: "ALL", kind: "percent", value: 100 })];
    const priced = priceOrder(
      order({
        country: "PL",
        items: [item({ unitPriceKopecks: 10_000 })],
        coupons: ["ALL"],
      }),
      catalog,
      NOW,
    );
    expect(priced.merchandiseKopecks).toBe(0);
    expect(priced.shippingKopecks).toBe(19_900);
    expect(priced.totalKopecks).toBe(19_900);
  });
});
