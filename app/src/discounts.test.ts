import { describe, it, expect } from "vitest";
import { priceOrder } from "./discounts.js";
import type { Order, LineItem, Coupon } from "./types.js";

// One describe per acceptance criterion in docs/spec/pricing-discounts.md, named
// after its AC id so the spec link shows up in the test output. Amounts are
// whole kopecks (1 грн = 100 копійок). `now` is pinned so expiry is deterministic.

const NOW = new Date("2026-09-06T12:00:00Z");
const FUTURE = "2026-12-31T00:00:00Z";

const item = (over: Partial<LineItem> = {}): LineItem => ({
  sku: "AA-1",
  name: "Thing",
  unitPriceKopecks: 100_000,
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
  expiresAt: FUTURE,
  ...over,
});

describe("AC-1: gold tier discount, no coupons", () => {
  it("takes 10% off the goods subtotal and adds domestic shipping", () => {
    const b = priceOrder(order({ customerTier: "gold" }), [], NOW);
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(4_900);
    expect(b.totalKopecks).toBe(94_900);
    expect(b.appliedCoupons).toEqual([]);
  });
});

describe("AC-2: silver tier discount, no coupons", () => {
  it("takes 5% off the goods subtotal", () => {
    const b = priceOrder(order({ customerTier: "silver" }), [], NOW);
    expect(b.tierDiscountKopecks).toBe(5_000);
    expect(b.totalKopecks).toBe(99_900);
  });
});

describe("AC-3: no tier, no coupons — engine is a no-op over base pricing", () => {
  it("returns subtotal plus shipping unchanged", () => {
    const b = priceOrder(order(), [], NOW);
    expect(b.tierDiscountKopecks).toBe(0);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
  });
});

describe("AC-4: percent coupon stacks sequentially after the tier discount", () => {
  it("applies the coupon to the post-tier remainder, not the subtotal", () => {
    const c = [coupon({ code: "AUTUMN15", value: 15 })];
    const b = priceOrder(order({ customerTier: "gold", coupons: ["AUTUMN15"] }), c, NOW);
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(13_500);
    expect(b.totalKopecks).toBe(81_400);
    expect(b.appliedCoupons).toEqual(["AUTUMN15"]);
  });
});

describe("AC-5: fixed-amount coupon in kopecks", () => {
  it("subtracts the fixed value from the remainder", () => {
    const c = [coupon({ code: "MINUS200", kind: "fixed", value: 20_000 })];
    const b = priceOrder(order({ coupons: ["MINUS200"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(20_000);
    expect(b.totalKopecks).toBe(84_900);
    expect(b.appliedCoupons).toEqual(["MINUS200"]);
  });
});

describe("AC-6: two category coupons on different categories both apply", () => {
  it("discounts each category off its own line-sum, in typed order", () => {
    const o = order({
      items: [
        item({ unitPriceKopecks: 100_000 }),
        item({ sku: "BB-2", unitPriceKopecks: 50_000, category: "fresh" }),
      ],
      coupons: ["STD10", "FRESH50"],
    });
    const c = [
      coupon({ code: "STD10", value: 10, category: "standard" }),
      coupon({ code: "FRESH50", value: 50, category: "fresh" }),
    ];
    const b = priceOrder(o, c, NOW);
    expect(b.couponDiscountKopecks).toBe(35_000);
    expect(b.shippingKopecks).toBe(4_900);
    expect(b.totalKopecks).toBe(119_900);
    expect(b.appliedCoupons).toEqual(["STD10", "FRESH50"]);
  });
});

describe("AC-7: two coupons on the same category — only the first counts", () => {
  it("ignores the second coupon scoped to an already-discounted category", () => {
    const c = [
      coupon({ code: "STD10", value: 10, category: "standard" }),
      coupon({ code: "STD25", value: 25, category: "standard" }),
    ];
    const b = priceOrder(order({ coupons: ["STD10", "STD25"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(10_000);
    expect(b.totalKopecks).toBe(94_900);
    expect(b.appliedCoupons).toEqual(["STD10"]);
  });
});

describe("AC-8: typed order changes the result for mixed coupon kinds", () => {
  const c = [
    coupon({ code: "P10", value: 10 }),
    coupon({ code: "F200", kind: "fixed", value: 20_000 }),
  ];
  it("percent then fixed: 100000 -> -10000 -> -20000", () => {
    const b = priceOrder(order({ coupons: ["P10", "F200"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(30_000);
    expect(b.totalKopecks).toBe(74_900);
  });
  it("fixed then percent: 100000 -> -20000 -> -8000", () => {
    const b = priceOrder(order({ coupons: ["F200", "P10"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(28_000);
    expect(b.totalKopecks).toBe(76_900);
  });
});

describe("AC-9 (edge): discount larger than the goods total floors at zero", () => {
  it("caps the coupon at the goods total and still charges shipping", () => {
    const o = order({ items: [item({ unitPriceKopecks: 10_000 })], coupons: ["MINUS500"] });
    const c = [coupon({ code: "MINUS500", kind: "fixed", value: 50_000 })];
    const b = priceOrder(o, c, NOW);
    expect(b.couponDiscountKopecks).toBe(10_000);
    expect(b.totalKopecks).toBe(4_900);
    expect(b.appliedCoupons).toEqual(["MINUS500"]);
  });
});

describe("AC-10 (edge): empty order prices to zero without error", () => {
  it("returns all zeros and applies no coupon", () => {
    const c = [coupon({ code: "AUTUMN15", value: 15 })];
    const b = priceOrder(
      order({ items: [], customerTier: "gold", coupons: ["AUTUMN15"] }),
      c,
      NOW,
    );
    expect(b).toEqual({
      subtotalKopecks: 0,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      shippingKopecks: 0,
      totalKopecks: 0,
      appliedCoupons: [],
    });
  });
});

describe("AC-11 (edge): half-kopeck rounds half-up, per step", () => {
  it("round(502.5) === 503", () => {
    const o = order({ items: [item({ unitPriceKopecks: 1_005 })], coupons: ["HALF50"] });
    const c = [coupon({ code: "HALF50", value: 50 })];
    const b = priceOrder(o, c, NOW);
    expect(b.couponDiscountKopecks).toBe(503);
    expect(b.totalKopecks).toBe(5_402);
  });
});

describe("AC-12: expired or unparseable coupon is silently skipped", () => {
  it("ignores a coupon whose expiresAt is in the past", () => {
    const c = [coupon({ code: "OLD20", value: 20, expiresAt: "2020-01-01T00:00:00Z" })];
    const b = priceOrder(order({ customerTier: "silver", coupons: ["OLD20"] }), c, NOW);
    expect(b.tierDiscountKopecks).toBe(5_000);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(99_900);
    expect(b.appliedCoupons).toEqual([]);
  });
  it("ignores a coupon whose expiresAt cannot be parsed, without throwing", () => {
    const c = [coupon({ code: "OLD20", value: 20, expiresAt: "not-a-date" })];
    expect(() => priceOrder(order({ coupons: ["OLD20"] }), c, NOW)).not.toThrow();
    expect(priceOrder(order({ coupons: ["OLD20"] }), c, NOW).appliedCoupons).toEqual([]);
  });
});

describe("AC-13: unknown coupon code is silently skipped", () => {
  it("prices the order normally and throws nothing", () => {
    expect(() => priceOrder(order({ coupons: ["NOPE"] }), [], NOW)).not.toThrow();
    const b = priceOrder(order({ coupons: ["NOPE"] }), [], NOW);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
    expect(b.appliedCoupons).toEqual([]);
  });
});

describe("AC-14: duplicate coupon code counts once", () => {
  it("applies the repeated code a single time", () => {
    const c = [coupon({ code: "AUTUMN15", value: 15 })];
    const b = priceOrder(order({ coupons: ["AUTUMN15", "AUTUMN15"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(15_000);
    expect(b.totalKopecks).toBe(89_900);
    expect(b.appliedCoupons).toEqual(["AUTUMN15"]);
  });
});

describe("AC-15: minSubtotalKopecks is checked against the pre-discount subtotal", () => {
  const c = [coupon({ code: "BIG50", value: 50, minSubtotalKopecks: 50_000 })];
  it("(a) rejects the coupon when the raw subtotal is below the threshold", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 40_000 })],
      customerTier: "gold",
      coupons: ["BIG50"],
    });
    const b = priceOrder(o, c, NOW);
    expect(b.tierDiscountKopecks).toBe(4_000);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(40_900);
    expect(b.appliedCoupons).toEqual([]);
  });
  it("(b) accepts it at exactly the threshold even though the post-tier amount is lower", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 50_000 })],
      customerTier: "gold",
      coupons: ["BIG50"],
    });
    const b = priceOrder(o, c, NOW);
    expect(b.tierDiscountKopecks).toBe(5_000);
    expect(b.couponDiscountKopecks).toBe(22_500);
    expect(b.totalKopecks).toBe(27_400);
    expect(b.appliedCoupons).toEqual(["BIG50"]);
  });
});

describe("AC-16: category coupon base is the category line-sum, not reduced by the tier", () => {
  it("discounts 25% of the fresh lines, not 25% of the post-tier remainder", () => {
    const o = order({
      items: [
        item({ unitPriceKopecks: 100_000 }),
        item({ sku: "BB-2", unitPriceKopecks: 40_000, category: "fresh" }),
      ],
      customerTier: "gold",
      coupons: ["FRESH25"],
    });
    const c = [coupon({ code: "FRESH25", value: 25, category: "fresh" })];
    const b = priceOrder(o, c, NOW);
    expect(b.tierDiscountKopecks).toBe(14_000);
    expect(b.couponDiscountKopecks).toBe(10_000);
    expect(b.totalKopecks).toBe(120_900);
    expect(b.appliedCoupons).toEqual(["FRESH25"]);
  });
});

describe("AC-17: all-digital order waives shipping, discounts still apply to goods", () => {
  it("charges no shipping and 10% tier off goods", () => {
    const b = priceOrder(
      order({ items: [item({ category: "digital" })], customerTier: "gold" }),
      [],
      NOW,
    );
    expect(b.shippingKopecks).toBe(0);
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.totalKopecks).toBe(90_000);
  });
});

describe("AC-18: international shipping is added at full rate on top of discounted goods", () => {
  it("adds 19900 undiscounted after tier and coupon", () => {
    const c = [coupon({ code: "AUTUMN15", value: 15 })];
    const b = priceOrder(
      order({ country: "PL", customerTier: "gold", coupons: ["AUTUMN15"] }),
      c,
      NOW,
    );
    expect(b.shippingKopecks).toBe(19_900);
    expect(b.totalKopecks).toBe(96_400);
  });
});

describe("AC-19: out-of-range percent value is clamped to 100", () => {
  it("treats value 150 as 100%", () => {
    const c = [coupon({ code: "WILD150", value: 150 })];
    const b = priceOrder(order({ coupons: ["WILD150"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(100_000);
    expect(b.totalKopecks).toBe(4_900);
    expect(b.appliedCoupons).toEqual(["WILD150"]);
  });
});

describe("AC-20: a non-positive percent value yields no discount", () => {
  it("does not apply a percent coupon whose value is 0", () => {
    const c = [coupon({ code: "ZERO", value: 0 })];
    const b = priceOrder(order({ coupons: ["ZERO"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
    expect(b.appliedCoupons).toEqual([]);
  });
});

describe("AC-21: a category coupon with no matching items is skipped", () => {
  it("ignores a fresh-scoped coupon when the cart has no fresh items", () => {
    const c = [coupon({ code: "FRESH10", value: 10, category: "fresh" })];
    expect(() => priceOrder(order({ coupons: ["FRESH10"] }), c, NOW)).not.toThrow();
    const b = priceOrder(order({ coupons: ["FRESH10"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
    expect(b.appliedCoupons).toEqual([]);
  });
});

describe("AC-22: coupon code matching is exact and case-sensitive", () => {
  it("does not match a lower-cased code against an upper-case catalog entry", () => {
    const c = [coupon({ code: "AUTUMN15", value: 15 })];
    const b = priceOrder(order({ coupons: ["autumn15"] }), c, NOW);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
    expect(b.appliedCoupons).toEqual([]);
  });
});
