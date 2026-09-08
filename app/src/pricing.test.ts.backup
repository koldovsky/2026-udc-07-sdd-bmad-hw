import { describe, it, expect } from "vitest";
import {
  lineTotalKopecks,
  subtotalKopecks,
  shippingKopecks,
  tierPercent,
} from "./pricing.js";
import { discountPrice } from "./discounts.js";
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

describe("lineTotalKopecks", () => {
  it("multiplies unit price by quantity", () => {
    // 62.50 грн × 4 = 250 грн
    expect(lineTotalKopecks(item({ unitPriceKopecks: 6_250, quantity: 4 }))).toBe(25_000);
  });
});

describe("subtotalKopecks", () => {
  it("sums every line", () => {
    // 500 грн + 2 × 250 грн = 1000 грн
    const o = order({
      items: [item({ unitPriceKopecks: 50_000 }), item({ unitPriceKopecks: 25_000, quantity: 2 })],
    });
    expect(subtotalKopecks(o)).toBe(100_000);
  });

  it("is 0 for an empty order", () => {
    expect(subtotalKopecks(order({ items: [] }))).toBe(0);
  });
});

describe("shippingKopecks", () => {
  it("charges the domestic fee for UA (49 грн)", () => {
    expect(shippingKopecks(order({ country: "UA" }))).toBe(4_900);
  });

  it("charges the international fee otherwise (199 грн)", () => {
    expect(shippingKopecks(order({ country: "PL" }))).toBe(19_900);
  });

  it("waives shipping when every line is digital", () => {
    expect(shippingKopecks(order({ items: [item({ category: "digital" })] }))).toBe(0);
  });

  it("still charges when the order mixes digital and physical", () => {
    const o = order({ items: [item({ category: "digital" }), item({ category: "fresh" })] });
    expect(shippingKopecks(o)).toBe(4_900);
  });
});

describe("tierPercent", () => {
  it("maps tiers to their headline percentage", () => {
    expect(tierPercent(order({ customerTier: "none" }))).toBe(0);
    expect(tierPercent(order({ customerTier: "silver" }))).toBe(5);
    expect(tierPercent(order({ customerTier: "gold" }))).toBe(10);
  });
});

describe("discountPrice - Acceptance Criteria", () => {
  const coupon = (over: Partial<Coupon> = {}): Coupon => ({
    code: "TEST",
    kind: "percent",
    value: 10,
    expiresAt: "2099-12-31",
    ...over,
  });

  describe("AC-1: Gold tier discount on 1000 грн", () => {
    it("Gold customer gets 10% discount = 100 грн (10,000 kopecks)", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })], // 1000 грн
        customerTier: "gold",
      });
      const breakdown = discountPrice(o, []);

      expect(breakdown.subtotalKopecks).toBe(100_000);
      expect(breakdown.tierDiscountKopecks).toBe(10_000);
      expect(breakdown.couponDiscountKopecks).toBe(0);
      expect(breakdown.shippingKopecks).toBe(4_900); // domestic
      expect(breakdown.totalKopecks).toBe(90_000 + 4_900); // 94,900
    });
  });

  describe("AC-2: Expired coupon ignored", () => {
    it("coupon with expiresAt = yesterday is ignored", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [coupon({ kind: "fixed", value: 10_000, expiresAt: "2026-09-07" })];

      const breakdown = discountPrice(o, coupons, "2026-09-08");

      expect(breakdown.couponDiscountKopecks).toBe(0);
      expect(breakdown.totalKopecks).toBe(100_000 + 4_900);
    });
  });

  describe("AC-3: Two sequential coupons on same category", () => {
    it("first -10%, second -20% on fresh category base 50,000 = -14,000 total", () => {
      const o = order({
        items: [
          item({ category: "fresh", unitPriceKopecks: 50_000 }),
          item({ category: "standard", unitPriceKopecks: 50_000 }),
        ],
      });
      const coupons = [
        coupon({ category: "fresh", kind: "percent", value: 10 }),
        coupon({ category: "fresh", kind: "percent", value: 20 }),
      ];

      const breakdown = discountPrice(o, coupons);

      // first: 50,000 * 10% = 5,000 → leaves 45,000
      // second: 45,000 * 20% = 9,000 (from fresh category sum after first coupon)
      // But wait: we need to recalculate. Fresh category is fixed at 50,000.
      // First coupon: 50,000 * 10% = 5,000 off fresh
      // Second coupon: 50,000 * 20% = 10,000 off fresh (but only 45,000 remains, so 9,000)
      // Actually, reading the spec more carefully: D-10 says category coupons calculate from
      // that category's sum AFTER tier, but it's per-coupon. Let me re-read...
      //
      // D-3 says: "second coupon is applied to remaining sum after first coupon (on same category)"
      // So sequential application to the same category means the category's effective sum decreases.
      // But our algorithm tracks global currentSubtotal, not per-category sum.
      //
      // Let me think about this differently:
      // - Fresh items: 50,000
      // - Standard items: 50,000
      // - Total: 100,000
      //
      // First coupon (fresh, -10%): affects fresh items. 50,000 * 10% = 5,000
      // Global subtotal becomes: 100,000 - 5,000 = 95,000
      // Fresh items now conceptually worth: 50,000 - 5,000 = 45,000 (for next coupon)
      //
      // Second coupon (fresh, -20%): should calculate from 45,000 (remaining fresh)
      // 45,000 * 20% = 9,000
      // Global subtotal becomes: 95,000 - 9,000 = 86,000
      //
      // Total coupon discount: 5,000 + 9,000 = 14,000
      //
      // But our implementation calculates from the ORIGINAL category sum each time!
      // That's wrong. We need to track adjustments per category or recalculate.
      //
      // Actually, rereading the spec D-10: "Tier applies globally, then category coupons
      // from category sum AFTER tier". It doesn't say what happens when you have multiple
      // category coupons on the same category.
      //
      // And D-3 says: "two coupons on one category, second applies to sum after first"
      // This means: 50,000 - 5,000 = 45,000, then apply second to 45,000 * 20% = 9,000.
      //
      // So I need to fix the implementation to track per-category discounts properly.

      expect(breakdown.couponDiscountKopecks).toBe(14_000);
      expect(breakdown.totalKopecks).toBe(100_000 - 14_000 + 4_900); // 90,900
    });
  });

  describe("AC-4: Coupon exceeds subtotal (boundary)", () => {
    it("coupon -500 грн on order 200 грн = 0 payment, not negative", () => {
      const o = order({ items: [item({ unitPriceKopecks: 20_000 })] }); // 200 грн
      const coupons = [coupon({ kind: "fixed", value: 50_000 })]; // 500 грн off

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(20_000); // max of coupon and subtotal
      expect(breakdown.totalKopecks).toBe(0 + 4_900); // 4,900 (shipping only)
    });
  });

  describe("AC-5: Coupon minSubtotal not met", () => {
    it("coupon requires 100,000 (1000 грн) but order is 80,000 (800 грн)", () => {
      const o = order({ items: [item({ unitPriceKopecks: 80_000 })] });
      const coupons = [coupon({ kind: "percent", value: 10, minSubtotalKopecks: 100_000 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(0);
      expect(breakdown.totalKopecks).toBe(80_000 + 4_900);
    });
  });

  describe("AC-6: Tier + coupon sequential", () => {
    it("10% tier on 1000 грн + 15% coupon on remaining = 900 - 135 = 765 грн", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "gold",
      });
      const coupons = [coupon({ kind: "percent", value: 15 })];

      const breakdown = discountPrice(o, coupons);

      // Tier: 100,000 * 10% = 10,000 → 90,000 remains
      // Coupon: 90,000 * 15% = 13,500 → 76,500 remains
      expect(breakdown.tierDiscountKopecks).toBe(10_000);
      expect(breakdown.couponDiscountKopecks).toBe(13_500);
      expect(breakdown.totalKopecks).toBe(76_500 + 4_900); // 81,400
    });
  });

  describe("AC-7: Category coupon with no items in that category (boundary)", () => {
    it("coupon on fresh category but no fresh items = 0 discount", () => {
      const o = order({
        items: [item({ category: "standard", unitPriceKopecks: 100_000 })],
      });
      const coupons = [coupon({ category: "fresh", kind: "percent", value: 10 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(0);
      expect(breakdown.totalKopecks).toBe(100_000 + 4_900);
    });
  });

  describe("AC-8: Rounding 0.5 kopecks (boundary)", () => {
    it("Silver (5%) on 333 kopecks = 16.65 → rounds to 17 kopecks", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 333 })],
        customerTier: "silver",
      });

      const breakdown = discountPrice(o, []);

      // 333 * 5% = 16.65 → rounds to 17
      expect(breakdown.tierDiscountKopecks).toBe(17);
      expect(breakdown.subtotalKopecks - breakdown.tierDiscountKopecks).toBe(316);
    });
  });

  describe("AC-9: Three sequential coupons", () => {
    it("10%, 20%, 5% applied sequentially", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })],
      });
      const coupons = [
        coupon({ kind: "percent", value: 10 }),
        coupon({ kind: "percent", value: 20 }),
        coupon({ kind: "percent", value: 5 }),
      ];

      const breakdown = discountPrice(o, coupons);

      // 100,000 * 10% = 10,000 → 90,000
      // 90,000 * 20% = 18,000 → 72,000
      // 72,000 * 5% = 3,600 → 68,400
      // Total coupon discount: 10,000 + 18,000 + 3,600 = 31,600
      expect(breakdown.couponDiscountKopecks).toBe(31_600);
      expect(breakdown.totalKopecks).toBe(68_400 + 4_900); // 73,300
    });
  });

  describe("AC-10: Empty order (boundary)", () => {
    it("zero items = 0 subtotal, 0 discounts, 0 total (shipping waived for all-digital/empty)", () => {
      const o = order({ items: [] });

      const breakdown = discountPrice(o, [coupon()]);

      expect(breakdown.subtotalKopecks).toBe(0);
      expect(breakdown.tierDiscountKopecks).toBe(0);
      expect(breakdown.couponDiscountKopecks).toBe(0);
      // Empty order is treated as all-digital (vacuous truth), so shipping is waived
      expect(breakdown.shippingKopecks).toBe(0);
      expect(breakdown.totalKopecks).toBe(0);
    });
  });
});
