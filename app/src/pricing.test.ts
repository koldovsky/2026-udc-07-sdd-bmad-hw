import { describe, it, expect } from "vitest";
import {
  lineTotalKopecks,
  subtotalKopecks,
  shippingKopecks,
  tierPercent,
} from "./pricing.js";
import { discountPrice } from "./discounts.js";
import type { Order, LineItem, Coupon } from "./types.js";

// Test helpers
const item = (over: Partial<LineItem> = {}): LineItem => ({
  sku: "TEST-SKU",
  name: "Test Item",
  unitPriceKopecks: 25_000, // 250 грн
  quantity: 1,
  category: "standard",
  ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: "test-order",
  items: [item()],
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...over,
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "TESTCODE",
  kind: "percent",
  value: 10,
  expiresAt: "2099-12-31",
  ...over,
});

// Existing pricing tests
describe("lineTotalKopecks", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineTotalKopecks(item({ unitPriceKopecks: 6_250, quantity: 4 }))).toBe(25_000);
  });
});

describe("subtotalKopecks", () => {
  it("sums all line items", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 50_000 }), item({ unitPriceKopecks: 25_000, quantity: 2 })],
    });
    expect(subtotalKopecks(o)).toBe(100_000);
  });

  it("returns 0 for empty order", () => {
    expect(subtotalKopecks(order({ items: [] }))).toBe(0);
  });
});

describe("shippingKopecks", () => {
  it("charges domestic fee for UA", () => {
    expect(shippingKopecks(order({ country: "UA" }))).toBe(4_900);
  });

  it("charges international fee for other countries", () => {
    expect(shippingKopecks(order({ country: "PL" }))).toBe(19_900);
  });

  it("waives shipping for all-digital orders", () => {
    const o = order({ items: [item({ category: "digital" })] });
    expect(shippingKopecks(o)).toBe(0);
  });

  it("charges shipping for mixed digital+physical orders", () => {
    const o = order({
      items: [item({ category: "digital" }), item({ category: "fresh" })],
    });
    expect(shippingKopecks(o)).toBe(4_900);
  });
});

describe("tierPercent", () => {
  it("returns correct tier percentages", () => {
    expect(tierPercent(order({ customerTier: "none" }))).toBe(0);
    expect(tierPercent(order({ customerTier: "silver" }))).toBe(5);
    expect(tierPercent(order({ customerTier: "gold" }))).toBe(10);
  });
});

// Discount engine tests
describe("discountPrice", () => {
  describe("Tier discount (feature requirement 1)", () => {
    it("applies Silver tier discount (5%)", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "silver",
      });
      const breakdown = discountPrice(o, []);

      expect(breakdown.tierDiscountKopecks).toBe(5_000);
      expect(breakdown.totalKopecks).toBe(95_000 + 4_900);
    });

    it("applies Gold tier discount (10%)", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "gold",
      });
      const breakdown = discountPrice(o, []);

      expect(breakdown.tierDiscountKopecks).toBe(10_000);
      expect(breakdown.totalKopecks).toBe(90_000 + 4_900);
    });

    it("applies no discount for 'none' tier", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "none",
      });
      const breakdown = discountPrice(o, []);

      expect(breakdown.tierDiscountKopecks).toBe(0);
    });
  });

  describe("Coupon discounts (feature requirement 2)", () => {
    it("applies percentage-based coupon", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [coupon({ kind: "percent", value: 15 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(15_000);
      expect(breakdown.totalKopecks).toBe(85_000 + 4_900);
    });

    it("applies fixed-amount coupon in kopecks", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [coupon({ kind: "fixed", value: 20_000 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(20_000);
      expect(breakdown.totalKopecks).toBe(80_000 + 4_900);
    });

    it("applies category-specific coupon only to that category", () => {
      const o = order({
        items: [
          item({ category: "fresh", unitPriceKopecks: 50_000 }),
          item({ category: "standard", unitPriceKopecks: 50_000 }),
        ],
      });
      const coupons = [coupon({ category: "fresh", kind: "percent", value: 20 })];

      const breakdown = discountPrice(o, coupons);

      // 20% of 50_000 (fresh items only) = 10_000
      expect(breakdown.couponDiscountKopecks).toBe(10_000);
    });

    it("respects minSubtotalKopecks requirement", () => {
      const o = order({ items: [item({ unitPriceKopecks: 50_000 })] });
      const coupons = [coupon({ minSubtotalKopecks: 100_000 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(0);
    });
  });

  describe("Tier + Coupon together (feature requirement 3)", () => {
    it("applies both tier and coupon in sequence", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "silver",
      });
      const coupons = [coupon({ kind: "percent", value: 10 })];

      const breakdown = discountPrice(o, coupons);

      // Tier: 100_000 * 5% = 5_000 → 95_000 remains
      // Coupon: 95_000 * 10% = 9_500 → 85_500 remains
      expect(breakdown.tierDiscountKopecks).toBe(5_000);
      expect(breakdown.couponDiscountKopecks).toBe(9_500);
      expect(breakdown.totalKopecks).toBe(85_500 + 4_900);
    });
  });

  describe("Expired coupons (feature requirement 4)", () => {
    it("ignores expired coupons (expiresAt <= today)", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [coupon({ expiresAt: "2026-09-07", kind: "fixed", value: 10_000 })];

      const breakdown = discountPrice(o, coupons, "2026-09-08");

      expect(breakdown.couponDiscountKopecks).toBe(0);
    });

    it("rejects coupons on the expiration date", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [coupon({ expiresAt: "2026-09-08", kind: "fixed", value: 10_000 })];

      const breakdown = discountPrice(o, coupons, "2026-09-08");

      expect(breakdown.couponDiscountKopecks).toBe(0);
    });

    it("accepts coupons expiring tomorrow", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [coupon({ expiresAt: "2026-09-09", kind: "fixed", value: 10_000 })];

      const breakdown = discountPrice(o, coupons, "2026-09-08");

      expect(breakdown.couponDiscountKopecks).toBe(10_000);
    });
  });

  describe("Multiple coupons (feature requirement 5)", () => {
    it("applies all coupons in order provided", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [
        coupon({ kind: "percent", value: 10 }),
        coupon({ kind: "percent", value: 10 }),
      ];

      const breakdown = discountPrice(o, coupons);

      // First: 100_000 * 10% = 10_000 → 90_000
      // Second: 90_000 * 10% = 9_000 → 81_000
      // Total coupon: 10_000 + 9_000 = 19_000
      expect(breakdown.couponDiscountKopecks).toBe(19_000);
      expect(breakdown.totalKopecks).toBe(81_000 + 4_900);
    });

    it("handles multiple coupons on same category sequentially", () => {
      const o = order({
        items: [
          item({ category: "fresh", unitPriceKopecks: 100_000 }),
        ],
      });
      const coupons = [
        coupon({ category: "fresh", kind: "percent", value: 10 }),
        coupon({ category: "fresh", kind: "percent", value: 20 }),
      ];

      const breakdown = discountPrice(o, coupons);

      // First coupon: 100_000 * 10% = 10_000
      // Fresh category now effectively: 100_000 - 10_000 = 90_000
      // Second coupon: 90_000 * 20% = 18_000
      // Total coupon: 10_000 + 18_000 = 28_000
      expect(breakdown.couponDiscountKopecks).toBe(28_000);
    });

    it("skips invalid coupons and continues with valid ones", () => {
      const o = order({ items: [item({ unitPriceKopecks: 100_000 })] });
      const coupons = [
        coupon({ expiresAt: "2026-09-07" }), // expired
        coupon({ kind: "percent", value: 20 }),
      ];

      const breakdown = discountPrice(o, coupons, "2026-09-08");

      expect(breakdown.couponDiscountKopecks).toBe(20_000);
    });
  });

  describe("Rounding (feature requirement 6)", () => {
    it("rounds per-discount calculation to nearest kopeck", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 333 })],
        customerTier: "silver",
      });

      const breakdown = discountPrice(o, []);

      // 333 * 5% = 16.65 → rounds to 17
      expect(breakdown.tierDiscountKopecks).toBe(17);
    });

    it("handles rounding correctly for percentage coupons", () => {
      const o = order({ items: [item({ unitPriceKopecks: 1000 })] });
      const coupons = [coupon({ kind: "percent", value: 33 })];

      const breakdown = discountPrice(o, coupons);

      // 1000 * 33% = 330 exactly
      expect(breakdown.couponDiscountKopecks).toBe(330);
    });

    it("handles rounding with fractional results", () => {
      const o = order({ items: [item({ unitPriceKopecks: 1001 })] });
      const coupons = [coupon({ kind: "percent", value: 33 })];

      const breakdown = discountPrice(o, coupons);

      // 1001 * 33% = 330.33 → rounds to 330
      expect(breakdown.couponDiscountKopecks).toBe(330);
    });
  });

  describe("Boundary conditions", () => {
    it("clamps coupon discount to not exceed subtotal", () => {
      const o = order({ items: [item({ unitPriceKopecks: 50_000 })] });
      const coupons = [coupon({ kind: "fixed", value: 100_000 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(50_000);
      expect(breakdown.totalKopecks).toBe(0 + 4_900);
    });

    it("never produces negative subtotal", () => {
      const o = order({ items: [item({ unitPriceKopecks: 50_000 })] });
      const coupons = [coupon({ kind: "fixed", value: 100_000 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.totalKopecks).toBeGreaterThanOrEqual(0);
    });

    it("handles empty order", () => {
      const o = order({ items: [] });
      const coupons = [coupon()];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.subtotalKopecks).toBe(0);
      expect(breakdown.tierDiscountKopecks).toBe(0);
      expect(breakdown.couponDiscountKopecks).toBe(0);
      expect(breakdown.totalKopecks).toBe(0);
    });

    it("handles category coupon when category has no items", () => {
      const o = order({
        items: [item({ category: "standard", unitPriceKopecks: 100_000 })],
      });
      const coupons = [coupon({ category: "fresh", kind: "percent", value: 50 })];

      const breakdown = discountPrice(o, coupons);

      expect(breakdown.couponDiscountKopecks).toBe(0);
    });

    it("applies shipping only after discounts", () => {
      const o = order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "gold",
        country: "PL",
      });
      const coupons = [coupon({ kind: "percent", value: 10 })];

      const breakdown = discountPrice(o, coupons);

      // Subtotal: 100_000
      // Tier: -10_000 = 90_000
      // Coupon: -9_000 = 81_000
      // Shipping: +19_900 = 100_900
      expect(breakdown.totalKopecks).toBe(100_900);
    });
  });
});
