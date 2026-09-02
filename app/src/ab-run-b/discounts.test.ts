import { describe, it, expect } from "vitest";
import { priceOrder, roundKopecks } from "./discounts.js";
import type { Coupon, LineItem, Order } from "../types.js";

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
  code: "SAVE10",
  kind: "percent",
  value: 10,
  expiresAt: "2030-01-01T00:00:00.000Z",
  ...over,
});

const NOW = new Date("2025-10-01T12:00:00.000Z");

describe("roundKopecks", () => {
  it("rounds halves away from zero", () => {
    expect(roundKopecks(10.5)).toBe(11);
    expect(roundKopecks(10.4999)).toBe(10);
    expect(roundKopecks(0)).toBe(0);
  });
});

describe("tier discount", () => {
  it("applies nothing for tier none", () => {
    const r = priceOrder(order({ customerTier: "none" }), [], NOW);
    expect(r.tierDiscountKopecks).toBe(0);
    expect(r.totalKopecks).toBe(25_000 + 4_900);
  });

  it("applies 5% for silver", () => {
    const r = priceOrder(order({ customerTier: "silver" }), [], NOW);
    expect(r.tierDiscountKopecks).toBe(1_250);
    expect(r.discountedSubtotalKopecks).toBe(23_750);
  });

  it("applies 10% for gold", () => {
    const r = priceOrder(order({ customerTier: "gold" }), [], NOW);
    expect(r.tierDiscountKopecks).toBe(2_500);
    expect(r.appliedDiscounts).toEqual([{ source: "tier", code: "gold", amountKopecks: 2_500 }]);
  });

  it("does not discount shipping", () => {
    const r = priceOrder(order({ customerTier: "gold", country: "PL" }), [], NOW);
    expect(r.shippingKopecks).toBe(19_900);
    expect(r.totalKopecks).toBe(22_500 + 19_900);
  });

  it("rounds a fractional tier discount half-up", () => {
    // 5% of 251 kopecks = 12.55 -> 13
    const o = order({ customerTier: "silver", items: [item({ unitPriceKopecks: 251 })] });
    expect(priceOrder(o, [], NOW).tierDiscountKopecks).toBe(13);
  });

  it("is 0 on an empty order", () => {
    const r = priceOrder(order({ customerTier: "gold", items: [] }), [], NOW);
    expect(r.subtotalKopecks).toBe(0);
    expect(r.totalDiscountKopecks).toBe(0);
    expect(r.totalKopecks).toBe(0);
  });
});

describe("percentage coupons", () => {
  it("applies a percentage to the subtotal", () => {
    const r = priceOrder(order({ coupons: ["SAVE10"] }), [coupon()], NOW);
    expect(r.couponDiscountKopecks).toBe(2_500);
    expect(r.discountedSubtotalKopecks).toBe(22_500);
  });

  it("matches codes case-insensitively and trims whitespace", () => {
    const r = priceOrder(order({ coupons: ["  save10 "] }), [coupon()], NOW);
    expect(r.couponDiscountKopecks).toBe(2_500);
  });

  it("rejects an unknown code", () => {
    const r = priceOrder(order({ coupons: ["NOPE"] }), [coupon()], NOW);
    expect(r.couponDiscountKopecks).toBe(0);
    expect(r.rejectedCoupons).toEqual([{ code: "NOPE", reason: "unknown-code" }]);
  });
});

describe("fixed coupons", () => {
  it("subtracts a fixed amount of kopecks", () => {
    const c = coupon({ code: "MINUS50", kind: "fixed", value: 5_000 });
    const r = priceOrder(order({ coupons: ["MINUS50"] }), [c], NOW);
    expect(r.couponDiscountKopecks).toBe(5_000);
    expect(r.discountedSubtotalKopecks).toBe(20_000);
  });

  it("caps at the remaining goods value and never goes negative", () => {
    const c = coupon({ code: "HUGE", kind: "fixed", value: 1_000_000 });
    const r = priceOrder(order({ coupons: ["HUGE"] }), [c], NOW);
    expect(r.couponDiscountKopecks).toBe(25_000);
    expect(r.discountedSubtotalKopecks).toBe(0);
    expect(r.totalKopecks).toBe(4_900); // shipping is still owed
  });
});

describe("expiry", () => {
  it("rejects a coupon that expired before now", () => {
    const c = coupon({ expiresAt: "2025-09-30T00:00:00.000Z" });
    const r = priceOrder(order({ coupons: ["SAVE10"] }), [c], NOW);
    expect(r.rejectedCoupons).toEqual([{ code: "SAVE10", reason: "expired" }]);
  });

  it("rejects exactly at the expiry instant (not valid on or after)", () => {
    const c = coupon({ expiresAt: NOW.toISOString() });
    const r = priceOrder(order({ coupons: ["SAVE10"] }), [c], NOW);
    expect(r.rejectedCoupons[0]?.reason).toBe("expired");
  });

  it("accepts one millisecond before expiry", () => {
    const c = coupon({ expiresAt: new Date(NOW.getTime() + 1).toISOString() });
    expect(priceOrder(order({ coupons: ["SAVE10"] }), [c], NOW).couponDiscountKopecks).toBe(2_500);
  });

  it("rejects an unparseable expiry date", () => {
    const c = coupon({ expiresAt: "not-a-date" });
    expect(priceOrder(order({ coupons: ["SAVE10"] }), [c], NOW).rejectedCoupons[0]?.reason).toBe(
      "expired",
    );
  });
});

describe("category-restricted coupons", () => {
  const items = [
    item({ sku: "S", category: "standard", unitPriceKopecks: 60_000 }),
    item({ sku: "F", category: "fresh", unitPriceKopecks: 40_000 }),
  ];

  it("applies its percentage only to the matching category", () => {
    const c = coupon({ code: "FRESH10", category: "fresh" });
    const r = priceOrder(order({ items, coupons: ["FRESH10"] }), [c], NOW);
    expect(r.couponDiscountKopecks).toBe(4_000); // 10% of 400 грн, not of 1000 грн
  });

  it("caps a fixed category coupon at that category's value", () => {
    const c = coupon({ code: "FRESH999", kind: "fixed", value: 99_999, category: "fresh" });
    const r = priceOrder(order({ items, coupons: ["FRESH999"] }), [c], NOW);
    expect(r.couponDiscountKopecks).toBe(40_000);
    expect(r.discountedSubtotalKopecks).toBe(60_000);
  });

  it("rejects when the order has no item of that category", () => {
    const c = coupon({ code: "DIGI", category: "digital" });
    const r = priceOrder(order({ items, coupons: ["DIGI"] }), [c], NOW);
    expect(r.rejectedCoupons).toEqual([{ code: "DIGI", reason: "no-matching-items" }]);
  });

  it("applies a category percentage to the tier-reduced category value", () => {
    const c = coupon({ code: "FRESH10", category: "fresh" });
    const o = order({ items, customerTier: "gold", coupons: ["FRESH10"] });
    const r = priceOrder(o, [c], NOW);
    // gold takes 10% of 1000 грн = 100 грн, proportionally 60/40 across lines.
    expect(r.tierDiscountKopecks).toBe(10_000);
    // fresh line is left with 400 - 40 = 360 грн; 10% of that = 36 грн.
    expect(r.couponDiscountKopecks).toBe(3_600);
    expect(r.discountedSubtotalKopecks).toBe(86_400);
  });
});

describe("minimum subtotal", () => {
  it("rejects when the subtotal is below the minimum", () => {
    const c = coupon({ code: "BIG", minSubtotalKopecks: 100_000 });
    const r = priceOrder(order({ coupons: ["BIG"] }), [c], NOW);
    expect(r.rejectedCoupons).toEqual([{ code: "BIG", reason: "below-minimum-subtotal" }]);
  });

  it("accepts when the subtotal exactly meets the minimum", () => {
    const c = coupon({ code: "BIG", minSubtotalKopecks: 25_000 });
    expect(priceOrder(order({ coupons: ["BIG"] }), [c], NOW).couponDiscountKopecks).toBe(2_500);
  });

  it("checks the minimum against the undiscounted subtotal, not the running total", () => {
    // Gold + a fixed coupon would push the running value under 250 грн, but the
    // gate is on the order the customer placed.
    const c1 = coupon({ code: "MINUS100", kind: "fixed", value: 10_000 });
    const c2 = coupon({ code: "BIG", minSubtotalKopecks: 25_000 });
    const o = order({ customerTier: "gold", coupons: ["MINUS100", "BIG"] });
    const r = priceOrder(o, [c1, c2], NOW);
    expect(r.rejectedCoupons).toEqual([]);
    expect(r.appliedDiscounts.map((d) => d.code)).toEqual(["gold", "MINUS100", "BIG"]);
  });
});

describe("stacking", () => {
  it("stacks tier and coupon multiplicatively on the remaining value", () => {
    const o = order({ customerTier: "gold", coupons: ["SAVE10"] });
    const r = priceOrder(o, [coupon()], NOW);
    expect(r.tierDiscountKopecks).toBe(2_500); // 10% of 250 грн
    expect(r.couponDiscountKopecks).toBe(2_250); // 10% of the remaining 225 грн
    expect(r.discountedSubtotalKopecks).toBe(20_250);
    expect(r.totalDiscountKopecks).toBe(4_750);
  });

  it("applies multiple coupons in the order the customer typed them", () => {
    const a = coupon({ code: "A", kind: "percent", value: 50 });
    const b = coupon({ code: "B", kind: "fixed", value: 10_000 });
    const typedAB = priceOrder(order({ coupons: ["A", "B"] }), [a, b], NOW);
    const typedBA = priceOrder(order({ coupons: ["B", "A"] }), [a, b], NOW);
    expect(typedAB.discountedSubtotalKopecks).toBe(2_500); // 250 -> 125 -> 25
    expect(typedBA.discountedSubtotalKopecks).toBe(7_500); // 250 -> 150 -> 75
  });

  it("ignores a repeated code but still records it as rejected", () => {
    const r = priceOrder(order({ coupons: ["SAVE10", "save10"] }), [coupon()], NOW);
    expect(r.couponDiscountKopecks).toBe(2_500);
    expect(r.rejectedCoupons).toEqual([{ code: "SAVE10", reason: "duplicate" }]);
  });

  it("rejects a later coupon once nothing is left to discount", () => {
    const a = coupon({ code: "ALL", kind: "percent", value: 100 });
    const b = coupon({ code: "MORE", kind: "fixed", value: 5_000 });
    const r = priceOrder(order({ coupons: ["ALL", "MORE"] }), [a, b], NOW);
    expect(r.discountedSubtotalKopecks).toBe(0);
    expect(r.rejectedCoupons).toEqual([{ code: "MORE", reason: "nothing-left-to-discount" }]);
  });

  it("never lets the discounted subtotal go negative across many coupons", () => {
    const cs = [1, 2, 3].map((n) =>
      coupon({ code: `F${n}`, kind: "fixed", value: 20_000 }),
    );
    const r = priceOrder(order({ customerTier: "gold", coupons: ["F1", "F2", "F3"] }), cs, NOW);
    expect(r.discountedSubtotalKopecks).toBe(0);
    expect(r.totalDiscountKopecks).toBe(25_000);
  });
});

describe("kopeck integrity", () => {
  it("keeps every amount a whole integer", () => {
    const o = order({
      customerTier: "silver",
      items: [
        item({ sku: "A", unitPriceKopecks: 3_333, quantity: 3 }),
        item({ sku: "B", unitPriceKopecks: 777, quantity: 7, category: "fresh" }),
      ],
      coupons: ["SAVE10", "F"],
    });
    const r = priceOrder(o, [coupon({ value: 33 }), coupon({ code: "F", kind: "fixed", value: 111 })], NOW);
    for (const v of [
      r.subtotalKopecks,
      r.tierDiscountKopecks,
      r.couponDiscountKopecks,
      r.totalDiscountKopecks,
      r.discountedSubtotalKopecks,
      r.totalKopecks,
    ]) {
      expect(Number.isInteger(v)).toBe(true);
    }
    for (const d of r.appliedDiscounts) expect(Number.isInteger(d.amountKopecks)).toBe(true);
  });

  it("keeps the breakdown internally consistent", () => {
    const o = order({ customerTier: "gold", coupons: ["SAVE10"] });
    const r = priceOrder(o, [coupon()], NOW);
    const sum = r.appliedDiscounts.reduce((s, d) => s + d.amountKopecks, 0);
    expect(sum).toBe(r.totalDiscountKopecks);
    expect(r.tierDiscountKopecks + r.couponDiscountKopecks).toBe(r.totalDiscountKopecks);
    expect(r.subtotalKopecks - r.totalDiscountKopecks).toBe(r.discountedSubtotalKopecks);
    expect(r.discountedSubtotalKopecks + r.shippingKopecks).toBe(r.totalKopecks);
  });

  it("splits an odd tier discount across lines without losing a kopeck", () => {
    // 5% of 3 x 333 = 49.95 -> 50 kopecks, split over three identical lines.
    const o = order({
      customerTier: "silver",
      items: [
        item({ sku: "A", unitPriceKopecks: 333 }),
        item({ sku: "B", unitPriceKopecks: 333 }),
        item({ sku: "C", unitPriceKopecks: 333 }),
      ],
    });
    const r = priceOrder(o, [], NOW);
    expect(r.tierDiscountKopecks).toBe(50);
    expect(r.discountedSubtotalKopecks).toBe(949);
  });
});

describe("catalog and input handling", () => {
  it("accepts a Map catalog keyed by upper-case code", () => {
    const map = new Map<string, Coupon>([["SAVE10", coupon()]]);
    expect(priceOrder(order({ coupons: ["save10"] }), map, NOW).couponDiscountKopecks).toBe(2_500);
  });

  it("rejects a structurally invalid coupon", () => {
    const c = coupon({ code: "BAD", kind: "percent", value: 250 });
    expect(priceOrder(order({ coupons: ["BAD"] }), [c], NOW).rejectedCoupons).toEqual([
      { code: "BAD", reason: "invalid-coupon" },
    ]);
  });

  it("does not mutate the order it was given", () => {
    const o = order({ customerTier: "gold", coupons: ["SAVE10"] });
    const snapshot = JSON.stringify(o);
    priceOrder(o, [coupon()], NOW);
    expect(JSON.stringify(o)).toBe(snapshot);
  });

  it("defaults to an empty catalog", () => {
    const r = priceOrder(order({ coupons: ["SAVE10"] }));
    expect(r.rejectedCoupons).toEqual([{ code: "SAVE10", reason: "unknown-code" }]);
  });
});

