import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { priceOrder } from "./discounts.js";
import type { Order, Coupon, LineItem } from "./types.js";

const item = (over: Partial<LineItem> = {}): LineItem => ({
  sku: "AA-1",
  name: "Thing",
  unitPriceKopecks: 50_000,
  quantity: 2, // 100_000 (1000 грн)
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

describe("priceOrder discounts", () => {
  beforeEach(() => {
    // mock Date.now to test expiration properly
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-1: Gold tier without coupons applies 10% discount", () => {
    // 1000 грн, Gold
    const o = order({ customerTier: "gold" });
    const result = priceOrder(o, []);
    
    expect(result.subtotalKopecks).toBe(100_000);
    expect(result.tierDiscountKopecks).toBe(10_000);
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.totalKopecks).toBe(90_000 + 4_900); // 900 грн + shipping UA
  });

  it("AC-2: Expired coupon is ignored", () => {
    const o = order({ coupons: ["OLD"] });
    const c: Coupon = {
      code: "OLD",
      kind: "fixed",
      value: 10_000,
      expiresAt: "2026-09-08T00:00:00Z" // Past
    };
    const result = priceOrder(o, [c]);
    
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.totalKopecks).toBe(100_000 + 4_900);
  });

  it("AC-3: Two coupons are applied sequentially to remaining sum", () => {
    const o = order({ coupons: ["10PCT", "50GRN"] });
    const c1: Coupon = { code: "10PCT", kind: "percent", value: 10, expiresAt: "2026-10-01T00:00:00Z" };
    const c2: Coupon = { code: "50GRN", kind: "fixed", value: 5_000, expiresAt: "2026-10-01T00:00:00Z" };
    
    const result = priceOrder(o, [c1, c2]);
    
    // 1000 грн - 10% (100 грн) = 900 грн -> - 50 грн = 850 грн.
    // Total coupon discount: 150 грн (15000 kopecks)
    expect(result.couponDiscountKopecks).toBe(15_000);
    expect(result.totalKopecks).toBe(85_000 + 4_900);
  });

  it("AC-4: Discount exceeds subtotal caps total at 0 + shipping", () => {
    const o = order({ coupons: ["BIG"] });
    const c1: Coupon = { code: "BIG", kind: "fixed", value: 200_000, expiresAt: "2026-10-01T00:00:00Z" };
    
    const result = priceOrder(o, [c1]);
    
    expect(result.subtotalKopecks).toBe(100_000);
    expect(result.couponDiscountKopecks).toBe(100_000);
    expect(result.shippingKopecks).toBe(4_900);
    expect(result.totalKopecks).toBe(4_900);
  });

  it("AC-5: Empty order results in 0", () => {
    const o = order({ items: [], coupons: ["10PCT"] });
    const c1: Coupon = { code: "10PCT", kind: "percent", value: 10, expiresAt: "2026-10-01T00:00:00Z" };
    
    const result = priceOrder(o, [c1]);
    
    expect(result.subtotalKopecks).toBe(0);
    expect(result.tierDiscountKopecks).toBe(0);
    expect(result.couponDiscountKopecks).toBe(0);
    expect(result.totalKopecks).toBe(0); // 0 shipping for digital (empty counts as all digital)
  });

  it("AC-6: Tier discount rounding half kopeck", () => {
    // unitPrice 10010 = 100.1 грн. 5% (silver) = 5.005 грн (500.5 kopecks) -> rounds to 501
    const o = order({ items: [item({ unitPriceKopecks: 10_010, quantity: 1 })], customerTier: "silver" });
    const result = priceOrder(o, []);
    
    expect(result.tierDiscountKopecks).toBe(501);
  });

  it("AC-7: minSubtotalKopecks applies to original subtotal", () => {
    // subtotal = 100000. Silver tier reduces to 95000.
    // Coupon requires 100000. It should still apply.
    const o = order({ customerTier: "silver", coupons: ["MIN100"] });
    const c: Coupon = { code: "MIN100", kind: "fixed", value: 10_000, expiresAt: "2026-10-01T00:00:00Z", minSubtotalKopecks: 100_000 };
    
    const result = priceOrder(o, [c]);
    
    expect(result.couponDiscountKopecks).toBe(10_000);
  });

  it("AC-8: Category coupon calculates percentage based on original category subtotal", () => {
    // 50k digital, 50k standard
    const o = order({ 
      items: [
        item({ unitPriceKopecks: 50_000, quantity: 1, category: "digital" }),
        item({ unitPriceKopecks: 50_000, quantity: 1, category: "standard" })
      ],
      coupons: ["GEN10", "DIG20"]
    });
    // First, a general fixed coupon of 1000 kopecks
    const c1: Coupon = { code: "GEN10", kind: "fixed", value: 1_000, expiresAt: "2026-10-01T00:00:00Z" };
    // 20% on digital -> 10000 kopecks (based on 50k original, not 49k remaining)
    const c2: Coupon = { code: "DIG20", kind: "percent", value: 20, expiresAt: "2026-10-01T00:00:00Z", category: "digital" };
    
    const result = priceOrder(o, [c1, c2]);
    
    expect(result.couponDiscountKopecks).toBe(11_000); // 1000 + 10000
  });

  it("AC-9: Category coupon fixed amount applies but is capped at category original subtotal", () => {
    const o = order({ 
      items: [
        item({ unitPriceKopecks: 30_000, quantity: 1, category: "digital" })
      ],
      coupons: ["FIXED_CAT"]
    });
    // 50000 discount but category only has 30000. Should be capped at 30000.
    const c: Coupon = { code: "FIXED_CAT", kind: "fixed", value: 50_000, expiresAt: "2026-10-01T00:00:00Z", category: "digital" };
    
    const result = priceOrder(o, [c]);
    
    expect(result.couponDiscountKopecks).toBe(30_000);
  });
});
