import { describe, expect, it } from "vitest";
import { priceOrder } from "./discounts.js";
import type { PriceBreakdown } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const EXPIRES = "2027-01-01T00:00:00.000Z";

function item(over: Partial<LineItem> & Pick<LineItem, "unitPriceKopecks" | "category">): LineItem {
  return {
    sku: "SKU-1",
    name: "Item",
    quantity: 1,
    ...over,
  };
}

function order(over: Partial<Order> & Pick<Order, "items">): Order {
  return {
    id: "o1",
    country: "UA",
    customerTier: "none",
    coupons: [],
    ...over,
  };
}

function coupon(
  code: string,
  kind: Coupon["kind"],
  value: number,
  over: Partial<Coupon> = {},
): Coupon {
  return { code, kind, value, expiresAt: EXPIRES, ...over };
}

function breakdown(over: Partial<PriceBreakdown> & Pick<PriceBreakdown, "subtotalKopecks">): PriceBreakdown {
  const subtotalKopecks = over.subtotalKopecks;
  const tierDiscountKopecks = over.tierDiscountKopecks ?? 0;
  const couponDiscountKopecks = over.couponDiscountKopecks ?? 0;
  const shipping = over.shippingKopecks ?? 4_900;
  return {
    subtotalKopecks,
    tierDiscountKopecks,
    couponDiscountKopecks,
    shippingKopecks: shipping,
    totalKopecks:
      over.totalKopecks ??
      subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks + shipping,
  };
}

describe("priceOrder", () => {
  it("AC-1: gold tier on a standard item with no coupons", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 100_000, category: "standard" })],
      }),
      [],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 100_000, tierDiscountKopecks: 10_000, totalKopecks: 94_900 }),
    );
  });

  it("AC-2: gold tier then a 15% whole-order coupon", () => {
    const save = coupon("SAVE15", "percent", 15);
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 100_000, category: "standard" })],
        coupons: ["SAVE15"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 100_000,
        tierDiscountKopecks: 10_000,
        couponDiscountKopecks: 13_500,
        totalKopecks: 81_400,
      }),
    );
  });

  it("AC-3: silver tier and fixed coupon leave shipping undiscounted", () => {
    const save = coupon("SAVE50", "fixed", 5_000);
    const result = priceOrder(
      order({
        country: "PL",
        customerTier: "silver",
        items: [item({ unitPriceKopecks: 20_000, quantity: 2, category: "standard" })],
        coupons: ["SAVE50"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 40_000,
        tierDiscountKopecks: 2_000,
        couponDiscountKopecks: 5_000,
        shippingKopecks: 19_900,
        totalKopecks: 52_900,
      }),
    );
  });

  it("AC-4: larger whole-order coupon wins the scope", () => {
    const coupons = [coupon("A", "percent", 10), coupon("B", "fixed", 6_000)];
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 50_000, category: "standard" })],
        coupons: ["A", "B"],
      }),
      coupons,
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 50_000, couponDiscountKopecks: 6_000, totalKopecks: 48_900 }),
    );
  });

  it("AC-5: larger fresh coupon wins the category scope", () => {
    const coupons = [
      coupon("F10", "percent", 10, { category: "fresh" }),
      coupon("F25", "fixed", 2_500, { category: "fresh" }),
    ];
    const result = priceOrder(
      order({
        customerTier: "silver",
        items: [
          item({ unitPriceKopecks: 30_000, category: "fresh", sku: "F" }),
          item({ unitPriceKopecks: 20_000, category: "standard", sku: "S" }),
        ],
        coupons: ["F10", "F25"],
      }),
      coupons,
      NOW,
    );
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 50_000,
        tierDiscountKopecks: 2_500,
        couponDiscountKopecks: 2_850,
        totalKopecks: 49_550,
      }),
    );
  });

  it("AC-6: equal discounts resolve to one coupon", () => {
    const coupons = [
      coupon("X", "percent", 10, { expiresAt: "2027-03-01T00:00:00.000Z" }),
      coupon("Y", "fixed", 4_000, { expiresAt: "2027-01-01T00:00:00.000Z" }),
    ];
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 40_000, category: "standard" })],
        coupons: ["X", "Y"],
      }),
      coupons,
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 40_000, couponDiscountKopecks: 4_000, totalKopecks: 40_900 }),
    );
  });

  it("AC-7: whole-order and fresh coupons stack in either typing order", () => {
    const coupons = [
      coupon("W", "percent", 10),
      coupon("F", "percent", 20, { category: "fresh" }),
    ];
    const items = [
      item({ unitPriceKopecks: 60_000, category: "standard", sku: "S" }),
      item({ unitPriceKopecks: 40_000, category: "fresh", sku: "F" }),
    ];
    const expected = breakdown({
      subtotalKopecks: 100_000,
      tierDiscountKopecks: 10_000,
      couponDiscountKopecks: 16_200,
      totalKopecks: 78_700,
    });
    expect(
      priceOrder(order({ customerTier: "gold", items, coupons: ["W", "F"] }), coupons, NOW),
    ).toEqual(expected);
    expect(
      priceOrder(order({ customerTier: "gold", items, coupons: ["F", "W"] }), coupons, NOW),
    ).toEqual(expected);
  });

  it("AC-8: half a kopeck of tier discount rounds down", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 1_005, category: "standard" })],
      }),
      [],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 1_005, tierDiscountKopecks: 100, totalKopecks: 5_805 }),
    );
  });

  it("AC-9: tier and coupon each floor separately", () => {
    const save = coupon("SAVE15", "percent", 15);
    const result = priceOrder(
      order({
        customerTier: "silver",
        items: [item({ unitPriceKopecks: 999, category: "standard" })],
        coupons: ["SAVE15"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 999,
        tierDiscountKopecks: 49,
        couponDiscountKopecks: 142,
        totalKopecks: 5_708,
      }),
    );
  });

  it("AC-10: coupon applies when subtotal equals the threshold", () => {
    const save = coupon("MIN", "fixed", 5_000, { minSubtotalKopecks: 50_000 });
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 50_000, category: "standard" })],
        coupons: ["MIN"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 50_000, couponDiscountKopecks: 5_000, totalKopecks: 49_900 }),
    );
  });

  it("AC-11: threshold uses the pre-discount subtotal", () => {
    const save = coupon("MIN", "fixed", 5_000, { minSubtotalKopecks: 50_000 });
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 50_000, category: "standard" })],
        coupons: ["MIN"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 50_000,
        tierDiscountKopecks: 5_000,
        couponDiscountKopecks: 5_000,
        totalKopecks: 44_900,
      }),
    );
  });

  it("AC-12: coupon does not apply one kopeck below the threshold", () => {
    const save = coupon("MIN", "fixed", 5_000, { minSubtotalKopecks: 50_000 });
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 49_999, category: "standard" })],
        coupons: ["MIN"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(breakdown({ subtotalKopecks: 49_999, totalKopecks: 54_899 }));
  });

  it("AC-13: fixed coupon is capped at its base and shipping is still charged", () => {
    const save = coupon("BIG", "fixed", 10_000);
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 3_000, category: "standard" })],
        coupons: ["BIG"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 3_000, couponDiscountKopecks: 3_000, totalKopecks: 4_900 }),
    );
  });

  it("AC-14: cross-scope coupon sum is capped at the after-tier amount", () => {
    const coupons = [coupon("W", "fixed", 8_000), coupon("F", "fixed", 5_000, { category: "fresh" })];
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 10_000, category: "fresh" })],
        coupons: ["W", "F"],
      }),
      coupons,
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 10_000, couponDiscountKopecks: 10_000, totalKopecks: 4_900 }),
    );
  });

  it("AC-15: category coupon gives zero when the category is absent", () => {
    const save = coupon("FRESH50", "percent", 50, { category: "fresh" });
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["FRESH50"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(breakdown({ subtotalKopecks: 20_000, totalKopecks: 24_900 }));
  });

  it("AC-16: expired coupon is ignored and does not throw", () => {
    const save = coupon("SAVE10", "percent", 10, { expiresAt: "2026-01-01T00:00:00.000Z" });
    const placed = order({
      items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
      coupons: ["SAVE10"],
    });
    let result: PriceBreakdown | undefined;
    expect(() => {
      result = priceOrder(placed, [save], NOW);
    }).not.toThrow();
    expect(result).toEqual(breakdown({ subtotalKopecks: 20_000, totalKopecks: 24_900 }));
  });

  it("AC-17: coupon expiring exactly at now is ignored", () => {
    const save = coupon("SAVE10", "percent", 10, { expiresAt: "2026-11-18T12:00:00.000Z" });
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["SAVE10"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(breakdown({ subtotalKopecks: 20_000, totalKopecks: 24_900 }));
  });

  it("AC-18: coupon is valid one millisecond before expiry", () => {
    const save = coupon("SAVE10", "percent", 10, { expiresAt: "2026-11-18T12:00:00.000Z" });
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["SAVE10"],
      }),
      [save],
      new Date("2026-11-18T11:59:59.999Z"),
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 20_000, couponDiscountKopecks: 2_000, totalKopecks: 22_900 }),
    );
  });

  it("AC-19: typed code matches after trim and case-folding", () => {
    const save = coupon("SAVE10", "percent", 10);
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["  save10 ", "NOPE"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 20_000, couponDiscountKopecks: 2_000, totalKopecks: 22_900 }),
    );
  });

  it("AC-20: a code typed twice counts once", () => {
    const save = coupon("SAVE30", "fixed", 3_000);
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["SAVE30", "save30"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 20_000, couponDiscountKopecks: 3_000, totalKopecks: 21_900 }),
    );
  });

  it("AC-21: empty order prices to zero", () => {
    const save = coupon("TEN", "percent", 10);
    const result = priceOrder(
      order({ customerTier: "gold", items: [], coupons: ["TEN"] }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 0,
        tierDiscountKopecks: 0,
        couponDiscountKopecks: 0,
        shippingKopecks: 0,
        totalKopecks: 0,
      }),
    );
  });

  it("AC-22: gold tier applies to a digital item and shipping is waived", () => {
    const result = priceOrder(
      order({
        customerTier: "gold",
        items: [item({ unitPriceKopecks: 30_000, category: "digital" })],
      }),
      [],
      NOW,
    );
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 30_000,
        tierDiscountKopecks: 3_000,
        shippingKopecks: 0,
        totalKopecks: 27_000,
      }),
    );
  });

  it("AC-23: a catalog coupon that was never typed is ignored", () => {
    const save = coupon("SAVE10", "percent", 10);
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: [],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(breakdown({ subtotalKopecks: 20_000, totalKopecks: 24_900 }));
  });

  it("AC-24: category coupon threshold uses the whole-order subtotal", () => {
    const save = coupon("FRESH", "fixed", 2_000, {
      category: "fresh",
      minSubtotalKopecks: 50_000,
    });
    const result = priceOrder(
      order({
        items: [
          item({ unitPriceKopecks: 40_000, category: "standard", sku: "S" }),
          item({ unitPriceKopecks: 10_000, category: "fresh", sku: "F" }),
        ],
        coupons: ["FRESH"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 50_000, couponDiscountKopecks: 2_000, totalKopecks: 52_900 }),
    );
  });

  it("AC-25: catalog code is normalised with trim and case-folding", () => {
    const save = coupon("  Save10 ", "percent", 10);
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["save10"],
      }),
      [save],
      NOW,
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 20_000, couponDiscountKopecks: 2_000, totalKopecks: 22_900 }),
    );
  });

  it("AC-26: omitted now applies a coupon expiring in 2099", () => {
    const save = coupon("SAVE10", "percent", 10, { expiresAt: "2099-01-01T00:00:00.000Z" });
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["SAVE10"],
      }),
      [save],
    );
    expect(result).toEqual(
      breakdown({ subtotalKopecks: 20_000, couponDiscountKopecks: 2_000, totalKopecks: 22_900 }),
    );
  });

  it("AC-27: omitted now ignores a coupon that expired in 2000", () => {
    const save = coupon("SAVE10", "percent", 10, { expiresAt: "2000-01-01T00:00:00.000Z" });
    const result = priceOrder(
      order({
        items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
        coupons: ["SAVE10"],
      }),
      [save],
    );
    expect(result).toEqual(breakdown({ subtotalKopecks: 20_000, totalKopecks: 24_900 }));
  });

  it("AC-28: order and coupons deep-equal their pre-call copies", () => {
    const placed = order({
      customerTier: "gold",
      items: [item({ unitPriceKopecks: 20_000, category: "standard" })],
      coupons: [" SAVE10 "],
    });
    const catalog = [coupon("SAVE10", "percent", 10)];
    const orderBefore = structuredClone(placed);
    const catalogBefore = structuredClone(catalog);
    const result = priceOrder(placed, catalog, NOW);
    expect(result).toEqual(
      breakdown({
        subtotalKopecks: 20_000,
        tierDiscountKopecks: 2_000,
        couponDiscountKopecks: 1_800,
        totalKopecks: 21_100,
      }),
    );
    expect(placed).toEqual(orderBefore);
    expect(catalog).toEqual(catalogBefore);
  });
});
