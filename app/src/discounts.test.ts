// One test per acceptance criterion in docs/spec/pricing-discounts.md §4.
// Test names carry the AC id so the link to the spec shows in vitest output.
//
// Every expected figure is taken from the specification's AC table, not from
// running the code: if an expectation here disagrees with the implementation,
// the implementation is what's wrong.
//
// Amounts are whole kopecks. 25_000 = 250 грн.

import { describe, it, expect } from "vitest";
import { priceOrder } from "./discounts.js";
import type { PriceBreakdown } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

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
  expiresAt: "2026-12-31T00:00:00.000Z",
  ...over,
});

/** Evaluation instant for every test — well before the default expiry (D-11). */
const NOW = new Date("2026-09-09T00:00:00.000Z");

/** A 1 000 грн order split across two categories, used by several criteria. */
const twoCategoryItems = (): LineItem[] => [
  item({ sku: "FR-1", unitPriceKopecks: 40_000, category: "fresh" }),
  item({ sku: "ST-1", unitPriceKopecks: 60_000, category: "standard" }),
];

/**
 * AC-16 — asserted on every fixture in this file, not only in its own test.
 * Reconciliation, the shipping floor, and every typed code accounted for
 * exactly once (D-19).
 */
function expectInvariants(b: PriceBreakdown, o: Order): void {
  expect(
    b.subtotalKopecks - b.tierDiscountKopecks - b.couponDiscountKopecks + b.shippingKopecks,
  ).toBe(b.totalKopecks);
  expect(b.totalKopecks).toBeGreaterThanOrEqual(b.shippingKopecks);
  expect(b.couponDiscountKopecks).toBe(
    b.appliedCoupons.reduce((sum, applied) => sum + applied.discountKopecks, 0),
  );
  const accountedFor = [
    ...b.appliedCoupons.map((a) => a.code),
    ...b.rejectedCoupons.map((r) => r.code),
  ].sort();
  expect(accountedFor).toEqual([...o.coupons].sort());
}

describe("priceOrder — docs/spec/pricing-discounts.md", () => {
  it("AC-1: gold tier on a plain order, shipping untouched", () => {
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], customerTier: "gold" });
    const b = priceOrder(o, [], NOW);

    expect(b.subtotalKopecks).toBe(100_000);
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(4_900);
    expect(b.totalKopecks).toBe(94_900);
    expectInvariants(b, o);
  });

  it("AC-2: tier and coupon stack sequentially, not additively", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      customerTier: "gold",
      coupons: ["SAVE15"],
    });
    const b = priceOrder(o, [coupon({ code: "SAVE15", value: 15 })], NOW);

    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(13_500); // 15% of the remaining 90_000
    expect(b.totalKopecks).toBe(81_400);
    expect(b.totalKopecks).not.toBe(79_900); // what a combined 25% would give
    expectInvariants(b, o);
  });

  it("AC-3: two coupons on the same category — the second is refused", () => {
    const o = order({ items: twoCategoryItems(), coupons: ["FRESH15", "FRESH5"] });
    const b = priceOrder(
      o,
      [
        coupon({ code: "FRESH15", value: 15, category: "fresh" }),
        coupon({ code: "FRESH5", value: 5, category: "fresh" }),
      ],
      NOW,
    );

    expect(b.appliedCoupons).toEqual([{ code: "FRESH15", discountKopecks: 6_000 }]);
    expect(b.rejectedCoupons).toEqual([{ code: "FRESH5", reason: "duplicate-scope" }]);
    expect(b.totalKopecks).toBe(98_900);
    expectInvariants(b, o);
  });

  it("AC-4: a fixed coupon larger than the order clamps, and the total floors at shipping", () => {
    const o = order({ items: [item({ unitPriceKopecks: 30_000 })], coupons: ["SAVE500"] });
    const b = priceOrder(o, [coupon({ code: "SAVE500", kind: "fixed", value: 50_000 })], NOW);

    expect(b.appliedCoupons).toEqual([{ code: "SAVE500", discountKopecks: 30_000 }]);
    expect(b.subtotalKopecks - b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(4_900);
    expectInvariants(b, o);
  });

  it("AC-5: half a kopeck on a tier discount rounds up", () => {
    const o = order({ items: [item({ unitPriceKopecks: 12_345 })], customerTier: "gold" });
    const b = priceOrder(o, [], NOW);

    expect(b.tierDiscountKopecks).toBe(1_235); // 1_234.5 → up
    expect(b.totalKopecks).toBe(16_010);
    expectInvariants(b, o);
  });

  it("AC-6: half a kopeck on a coupon discount rounds up", () => {
    const o = order({ items: [item({ unitPriceKopecks: 12_350 })], coupons: ["FIVE"] });
    const b = priceOrder(o, [coupon({ code: "FIVE", value: 5 })], NOW);

    expect(b.couponDiscountKopecks).toBe(618); // 617.5 → up
    expect(b.totalKopecks).toBe(16_632);
    expectInvariants(b, o);
  });

  it("AC-7: a coupon at the exact instant it expires is refused, without throwing", () => {
    const expiresAt = NOW.toISOString();
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], coupons: ["OLD"] });
    const b = priceOrder(o, [coupon({ code: "OLD", expiresAt })], NOW);

    expect(b.rejectedCoupons).toEqual([{ code: "OLD", reason: "expired" }]);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
    expectInvariants(b, o);
  });

  it("AC-8: a code the catalog does not contain is refused as unknown", () => {
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], coupons: ["NOPE"] });
    const b = priceOrder(o, [coupon({ code: "SAVE15", value: 15 })], NOW);

    expect(b.rejectedCoupons).toEqual([{ code: "NOPE", reason: "unknown" }]);
    expect(b.totalKopecks).toBe(104_900);
    expectInvariants(b, o);
  });

  it("AC-9: a subtotal exactly at the minimum satisfies it, judged before discounts", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 50_000 })],
      customerTier: "gold",
      coupons: ["MIN500"],
    });
    const b = priceOrder(o, [coupon({ code: "MIN500", minSubtotalKopecks: 50_000 })], NOW);

    expect(b.tierDiscountKopecks).toBe(5_000);
    expect(b.couponDiscountKopecks).toBe(4_500); // post-tier 45_000 is below the bar, gross is not
    expect(b.rejectedCoupons).toEqual([]);
    expect(b.totalKopecks).toBe(45_400);
    expectInvariants(b, o);
  });

  it("AC-10: a subtotal just below the minimum refuses the coupon", () => {
    const o = order({ items: [item({ unitPriceKopecks: 49_900 })], coupons: ["MIN500"] });
    const b = priceOrder(o, [coupon({ code: "MIN500", minSubtotalKopecks: 50_000 })], NOW);

    expect(b.rejectedCoupons).toEqual([{ code: "MIN500", reason: "below-min-subtotal" }]);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(54_800);
    expectInvariants(b, o);
  });

  it("AC-11: a category coupon uses its own category's post-tier base", () => {
    const o = order({
      items: twoCategoryItems(),
      customerTier: "gold",
      coupons: ["FRESH15"],
    });
    const b = priceOrder(o, [coupon({ code: "FRESH15", value: 15, category: "fresh" })], NOW);

    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(5_400); // 15% of the post-tier fresh 36_000
    expect(b.couponDiscountKopecks).not.toBe(6_000); // pre-tier category base
    expect(b.couponDiscountKopecks).not.toBe(13_500); // whole-order base
    expect(b.totalKopecks).toBe(89_500);
    expectInvariants(b, o);
  });

  it("AC-12: an order with no items prices to zero and refuses the code", () => {
    const o = order({ items: [], customerTier: "gold", coupons: ["SAVE10"] });
    const b = priceOrder(o, [coupon()], NOW);

    expect(b.subtotalKopecks).toBe(0);
    expect(b.tierDiscountKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(0);
    expect(b.totalKopecks).toBe(0);
    expect(b.rejectedCoupons).toEqual([{ code: "SAVE10", reason: "no-eligible-items" }]);
    expectInvariants(b, o);
  });

  it("AC-13: a category coupon with no items in that category is refused", () => {
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], coupons: ["DIG10"] });
    const b = priceOrder(o, [coupon({ code: "DIG10", category: "digital" })], NOW);

    expect(b.rejectedCoupons).toEqual([{ code: "DIG10", reason: "no-eligible-items" }]);
    expect(b.totalKopecks).toBe(104_900);
    expectInvariants(b, o);
  });

  it("AC-14: the same code entered twice applies once", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["SAVE10", "SAVE10"],
    });
    const b = priceOrder(o, [coupon()], NOW);

    expect(b.appliedCoupons).toEqual([{ code: "SAVE10", discountKopecks: 10_000 }]);
    expect(b.rejectedCoupons).toEqual([{ code: "SAVE10", reason: "duplicate-code" }]);
    expect(b.totalKopecks).toBe(94_900);
    expectInvariants(b, o);
  });

  it("AC-15: a category coupon and an order-wide coupon stack in typed order", () => {
    const o = order({
      items: twoCategoryItems(),
      customerTier: "gold",
      coupons: ["FRESH15", "SAVE100", "FRESH5"],
    });
    const b = priceOrder(
      o,
      [
        coupon({ code: "FRESH15", value: 15, category: "fresh" }),
        coupon({ code: "SAVE100", kind: "fixed", value: 10_000 }),
        coupon({ code: "FRESH5", value: 5, category: "fresh" }),
      ],
      NOW,
    );

    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.appliedCoupons).toEqual([
      { code: "FRESH15", discountKopecks: 5_400 },
      { code: "SAVE100", discountKopecks: 10_000 }, // against the remaining 84_600
    ]);
    expect(b.rejectedCoupons).toEqual([{ code: "FRESH5", reason: "duplicate-scope" }]);
    expect(b.couponDiscountKopecks).toBe(15_400);
    expect(b.totalKopecks).toBe(79_500);
    expectInvariants(b, o);
  });

  it("AC-16: the breakdown reconciles on every fixture in this suite", () => {
    const fixtures: Array<{ o: Order; catalog: Coupon[] }> = [
      { o: order({ items: [item({ unitPriceKopecks: 100_000 })], customerTier: "gold" }), catalog: [] },
      {
        o: order({ items: [], customerTier: "gold", coupons: ["SAVE10"] }),
        catalog: [coupon()],
      },
      {
        o: order({ items: [item({ unitPriceKopecks: 30_000 })], coupons: ["SAVE500"] }),
        catalog: [coupon({ code: "SAVE500", kind: "fixed", value: 50_000 })],
      },
      {
        o: order({
          items: twoCategoryItems(),
          customerTier: "silver",
          coupons: ["FRESH15", "SAVE100", "FRESH15", "GONE"],
        }),
        catalog: [
          coupon({ code: "FRESH15", value: 15, category: "fresh" }),
          coupon({ code: "SAVE100", kind: "fixed", value: 10_000 }),
          coupon({ code: "GONE", expiresAt: "2020-01-01T00:00:00.000Z" }),
        ],
      },
      {
        o: order({
          items: [item({ unitPriceKopecks: 12_345, category: "digital" })],
          customerTier: "gold",
          country: "PL",
        }),
        catalog: [],
      },
    ];

    for (const { o, catalog } of fixtures) {
      expectInvariants(priceOrder(o, catalog, NOW), o);
    }
  });

  it("AC-17: the tier applies to digital items, where there is no shipping to discount", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 20_000, category: "digital" })],
      customerTier: "gold",
    });
    const b = priceOrder(o, [], NOW);

    expect(b.tierDiscountKopecks).toBe(2_000);
    expect(b.shippingKopecks).toBe(0);
    expect(b.totalKopecks).toBe(18_000);
    expectInvariants(b, o);
  });

  it("AC-18: code matching is exact and case-sensitive", () => {
    const o = order({ items: [item({ unitPriceKopecks: 100_000 })], coupons: ["save10"] });
    const b = priceOrder(o, [coupon({ code: "SAVE10" })], NOW);

    expect(b.rejectedCoupons).toEqual([{ code: "save10", reason: "unknown" }]);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
    expectInvariants(b, o);
  });

  it("AC-19: pricing does not modify its inputs and repeats identically", () => {
    const o = order({
      items: twoCategoryItems(),
      customerTier: "gold",
      coupons: ["FRESH15", "SAVE100", "FRESH5"],
    });
    const catalog = [
      coupon({ code: "FRESH15", value: 15, category: "fresh" }),
      coupon({ code: "SAVE100", kind: "fixed", value: 10_000 }),
      coupon({ code: "FRESH5", value: 5, category: "fresh" }),
    ];
    const orderBefore = structuredClone(o);
    const catalogBefore = structuredClone(catalog);

    const first = priceOrder(o, catalog, NOW);
    const second = priceOrder(o, catalog, NOW);

    expect(o).toEqual(orderBefore);
    expect(catalog).toEqual(catalogBefore);
    expect(second).toEqual(first);
    expectInvariants(first, o);
  });
});
