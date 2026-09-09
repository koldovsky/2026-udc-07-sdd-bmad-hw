// ============================================================================
// Task D — Run B1 ARTIFACT, preserved verbatim. NOT production code.
//
// Produced by an agent given only materials/feature-request.md (no spec),
// in an isolated worktree at commit c339625. Kept as evidence for the
// comparison table in docs/ab-validation.md. Nothing in app/ imports this,
// and docs/ is outside app/tsconfig.json's include, so it never compiles
// or runs as part of the project.
//
// PROVENANCE CAVEAT: this run read the main repo's app/src/index.ts through
// an absolute path, which already carried Task C's export names. Its
// contract shape is therefore NOT independent evidence; its resolution of
// the business forks is (it never read the spec or the implementation).
// See docs/ab-validation.md § Provenance. Run B2 repeats it under tighter
// isolation.
// ============================================================================

// Tests are named after the acceptance criteria documented at the top of
// `discounts.ts`, so the decision each test locks in is visible in the output.
// Amounts are whole kopecks: 100_000 = 1000 грн.

import { describe, it, expect } from "vitest";
import { priceOrder } from "./discounts.js";
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
  items: [item({ unitPriceKopecks: 100_000 })], // 1000 грн
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...over,
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "SAVE",
  kind: "percent",
  value: 10,
  expiresAt: "2030-01-01T00:00:00.000Z",
  ...over,
});

/** Fixed clock, well before every non-expired fixture above. */
const NOW = new Date("2026-09-09T12:00:00.000Z");

/** 600 грн standard + 400 грн fresh. */
const mixedItems = (): LineItem[] => [
  item({ sku: "S-1", unitPriceKopecks: 60_000, category: "standard" }),
  item({ sku: "F-1", unitPriceKopecks: 40_000, category: "fresh" }),
];

describe("AC-1: tier discount applies to the items subtotal only", () => {
  it("AC-1: silver takes 5% off the items subtotal", () => {
    const r = priceOrder(order({ customerTier: "silver" }), [], NOW);
    expect(r.tierPercent).toBe(5);
    expect(r.tierDiscountKopecks).toBe(5_000);
    expect(r.discountedItemsKopecks).toBe(95_000);
    expect(r.totalKopecks).toBe(95_000 + 4_900);
  });

  it("AC-1: gold takes 10% off the items subtotal", () => {
    const r = priceOrder(order({ customerTier: "gold" }), [], NOW);
    expect(r.tierDiscountKopecks).toBe(10_000);
    expect(r.totalKopecks).toBe(90_000 + 4_900);
  });

  it("AC-1: tier 'none' discounts nothing", () => {
    const r = priceOrder(order(), [], NOW);
    expect(r.tierPercent).toBe(0);
    expect(r.totalDiscountKopecks).toBe(0);
    expect(r.totalKopecks).toBe(104_900);
  });

  it("AC-1: shipping is not part of the discount base", () => {
    // International shipping is 199 грн. 10% of items only, never of shipping.
    const r = priceOrder(order({ customerTier: "gold", country: "PL" }), [], NOW);
    expect(r.shippingKopecks).toBe(19_900);
    expect(r.tierDiscountKopecks).toBe(10_000); // not 11_990
    expect(r.totalKopecks).toBe(90_000 + 19_900);
  });
});

describe("AC-2: tier and coupon stack sequentially, not additively", () => {
  it("AC-2: gold + 15% coupon takes 235 грн off 1000 грн, not 250 грн", () => {
    const catalog = [coupon({ code: "AUTUMN15", value: 15 })];
    const r = priceOrder(
      order({ customerTier: "gold", coupons: ["AUTUMN15"] }),
      catalog,
      NOW,
    );
    expect(r.tierDiscountKopecks).toBe(10_000);
    expect(r.appliedCoupons[0]?.baseKopecks).toBe(90_000); // what is left after tier
    expect(r.couponDiscountKopecks).toBe(13_500);
    expect(r.totalDiscountKopecks).toBe(23_500); // additive would be 25_000
    expect(r.discountedItemsKopecks).toBe(76_500);
    expect(r.totalKopecks).toBe(81_400);
  });

  it("AC-2: a fixed coupon is an amount in kopecks taken off what is left", () => {
    const catalog = [coupon({ code: "MINUS150", kind: "fixed", value: 15_000 })];
    const r = priceOrder(order({ coupons: ["MINUS150"] }), catalog, NOW);
    expect(r.couponDiscountKopecks).toBe(15_000); // 150 грн
    expect(r.discountedItemsKopecks).toBe(85_000);
    expect(r.totalKopecks).toBe(89_900);
  });
});

describe("AC-3: every valid coupon applies, in the order the customer typed them", () => {
  it("AC-3: an order-wide and a category coupon both apply", () => {
    const catalog = [
      coupon({ code: "SAVE10", value: 10 }),
      coupon({ code: "FRESH20", kind: "fixed", value: 2_000, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items: mixedItems(), coupons: ["SAVE10", "FRESH20"] }),
      catalog,
      NOW,
    );
    expect(r.appliedCoupons.map((a) => a.code)).toEqual(["SAVE10", "FRESH20"]);
    // SAVE10: 10% of 100_000 = 10_000 -> fresh left 36_000; FRESH20: -2_000.
    expect(r.couponDiscountKopecks).toBe(12_000);
    expect(r.discountedItemsKopecks).toBe(88_000);
    expect(r.rejectedCoupons).toEqual([]);
  });

  it("AC-3: typed order changes the result and the earlier code wins the bigger base", () => {
    const catalog = [
      coupon({ code: "SAVE10", value: 10 }),
      coupon({ code: "FRESH20", kind: "fixed", value: 2_000, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items: mixedItems(), coupons: ["FRESH20", "SAVE10"] }),
      catalog,
      NOW,
    );
    // FRESH20 first: fresh 38_000. SAVE10 then sees 98_000 -> 9_800.
    expect(r.appliedCoupons.map((a) => a.code)).toEqual(["FRESH20", "SAVE10"]);
    expect(r.couponDiscountKopecks).toBe(11_800);
    expect(r.discountedItemsKopecks).toBe(88_200);
  });
});

describe("AC-4: at most one coupon per scope", () => {
  it("AC-4: two coupons on the same category — the first typed one wins", () => {
    const catalog = [
      coupon({ code: "FRESH10", value: 10, category: "fresh" }),
      coupon({ code: "FRESH50", value: 50, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items: mixedItems(), coupons: ["FRESH10", "FRESH50"] }),
      catalog,
      NOW,
    );
    expect(r.appliedCoupons.map((a) => a.code)).toEqual(["FRESH10"]);
    expect(r.couponDiscountKopecks).toBe(4_000);
    expect(r.rejectedCoupons).toEqual([
      { code: "FRESH50", reason: "scope_already_discounted" },
    ]);
  });

  it("AC-4: two order-wide coupons — the second is rejected", () => {
    const catalog = [coupon({ code: "A10", value: 10 }), coupon({ code: "B20", value: 20 })];
    const r = priceOrder(order({ coupons: ["A10", "B20"] }), catalog, NOW);
    expect(r.appliedCoupons.map((a) => a.code)).toEqual(["A10"]);
    expect(r.rejectedCoupons).toEqual([{ code: "B20", reason: "scope_already_discounted" }]);
    expect(r.couponDiscountKopecks).toBe(10_000);
  });

  it("AC-4: the same code typed twice counts once", () => {
    const catalog = [coupon({ code: "SAVE10", value: 10 })];
    const r = priceOrder(order({ coupons: ["SAVE10", "SAVE10"] }), catalog, NOW);
    expect(r.appliedCoupons).toHaveLength(1);
    expect(r.rejectedCoupons).toEqual([{ code: "SAVE10", reason: "duplicate_code" }]);
    expect(r.couponDiscountKopecks).toBe(10_000);
  });

  it("AC-4: coupons on different categories both apply", () => {
    const catalog = [
      coupon({ code: "STD10", value: 10, category: "standard" }),
      coupon({ code: "FRESH10", value: 10, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items: mixedItems(), coupons: ["STD10", "FRESH10"] }),
      catalog,
      NOW,
    );
    expect(r.appliedCoupons.map((a) => a.discountKopecks)).toEqual([6_000, 4_000]);
    expect(r.couponDiscountKopecks).toBe(10_000);
  });
});

describe("AC-5: a category coupon is computed on that category only", () => {
  it("AC-5: percent is taken from the category's post-tier share, not the whole order", () => {
    const catalog = [coupon({ code: "FRESH20", value: 20, category: "fresh" })];
    const r = priceOrder(
      order({ items: mixedItems(), customerTier: "gold", coupons: ["FRESH20"] }),
      catalog,
      NOW,
    );
    expect(r.tierDiscountKopecks).toBe(10_000);
    // fresh is 400 грн of 1000 грн, so it carries 40 грн of the tier discount.
    expect(r.appliedCoupons[0]?.baseKopecks).toBe(36_000);
    expect(r.appliedCoupons[0]?.discountKopecks).toBe(7_200); // not 18_000, not 8_000
    expect(r.appliedCoupons[0]?.scope).toBe("fresh");
    expect(r.discountedItemsKopecks).toBe(82_800);
  });

  it("AC-5: a fixed category coupon cannot eat into other categories", () => {
    const catalog = [
      coupon({ code: "FRESH999", kind: "fixed", value: 99_900, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items: mixedItems(), coupons: ["FRESH999"] }),
      catalog,
      NOW,
    );
    expect(r.couponDiscountKopecks).toBe(40_000); // capped at the fresh lines
    expect(r.discountedItemsKopecks).toBe(60_000);
  });
});

describe("AC-6: the tier discount splits across categories without losing a kopeck", () => {
  it("AC-6: an odd split is allocated by largest remainder and sums back exactly", () => {
    const items = [
      item({ sku: "S-1", unitPriceKopecks: 333, category: "standard" }),
      item({ sku: "F-1", unitPriceKopecks: 333, category: "fresh" }),
    ];
    const catalog = [coupon({ code: "FRESH100", value: 100, category: "fresh" })];
    const r = priceOrder(
      order({ items, customerTier: "silver", coupons: ["FRESH100"] }),
      catalog,
      NOW,
    );
    expect(r.subtotalKopecks).toBe(666);
    expect(r.tierDiscountKopecks).toBe(33); // 33.3 -> 33
    // 33 splits 17 / 16; fresh keeps 317, and a 100% coupon takes exactly that.
    expect(r.appliedCoupons[0]?.baseKopecks).toBe(317);
    expect(r.couponDiscountKopecks).toBe(317);
    expect(r.totalDiscountKopecks).toBe(350);
    expect(r.discountedItemsKopecks).toBe(316);
  });
});

describe("AC-7: minSubtotalKopecks is checked against the raw subtotal", () => {
  it("AC-7: a coupon whose minimum is above the post-tier amount still applies", () => {
    const catalog = [coupon({ code: "BIG10", value: 10, minSubtotalKopecks: 95_000 })];
    const r = priceOrder(
      order({ customerTier: "gold", coupons: ["BIG10"] }),
      catalog,
      NOW,
    );
    // Post-tier the order is 90_000 — below the 95_000 minimum — but the gate
    // is the raw 100_000 subtotal, so the coupon applies.
    expect(r.appliedCoupons[0]?.discountKopecks).toBe(9_000);
    expect(r.rejectedCoupons).toEqual([]);
  });

  it("AC-7: the minimum is inclusive — a subtotal exactly at it qualifies", () => {
    const catalog = [coupon({ code: "MIN1000", value: 10, minSubtotalKopecks: 100_000 })];
    const r = priceOrder(order({ coupons: ["MIN1000"] }), catalog, NOW);
    expect(r.couponDiscountKopecks).toBe(10_000);
  });

  it("AC-7: below the minimum the coupon is rejected explicitly", () => {
    const catalog = [coupon({ code: "MIN2000", value: 10, minSubtotalKopecks: 200_000 })];
    const r = priceOrder(order({ coupons: ["MIN2000"] }), catalog, NOW);
    expect(r.appliedCoupons).toEqual([]);
    expect(r.rejectedCoupons).toEqual([{ code: "MIN2000", reason: "min_subtotal_not_met" }]);
    expect(r.totalDiscountKopecks).toBe(0);
  });
});

describe("AC-8: rounding is half-up, once per discount, on whole kopecks", () => {
  it("AC-8: half a kopeck rounds up", () => {
    const items = [item({ unitPriceKopecks: 10, quantity: 1 })];
    const r = priceOrder(order({ items, customerTier: "silver" }), [], NOW);
    expect(r.tierDiscountKopecks).toBe(1); // 0.5 -> 1
    expect(r.discountedItemsKopecks).toBe(9);
  });

  it("AC-8: the percentage is taken on the aggregate, not line by line", () => {
    const items = [
      item({ sku: "A", unitPriceKopecks: 333 }),
      item({ sku: "B", unitPriceKopecks: 333 }),
    ];
    const r = priceOrder(order({ items, customerTier: "silver" }), [], NOW);
    // Per line it would be 17 + 17 = 34; on the 666 aggregate it is 33.
    expect(r.tierDiscountKopecks).toBe(33);
  });

  it("AC-8: coupon percentages round half-up too", () => {
    const items = [item({ unitPriceKopecks: 10 })];
    const catalog = [coupon({ code: "P5", value: 5 })];
    const r = priceOrder(order({ items, coupons: ["P5"] }), catalog, NOW);
    expect(r.couponDiscountKopecks).toBe(1);
  });

  it("AC-8: every amount in the breakdown is a whole number of kopecks", () => {
    const items = [
      item({ sku: "A", unitPriceKopecks: 3_333, quantity: 3, category: "standard" }),
      item({ sku: "B", unitPriceKopecks: 1_111, quantity: 7, category: "fresh" }),
    ];
    const catalog = [
      coupon({ code: "ODD7", value: 7 }),
      coupon({ code: "FRESH13", value: 13, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items, customerTier: "silver", coupons: ["ODD7", "FRESH13"] }),
      catalog,
      NOW,
    );
    const amounts = [
      r.subtotalKopecks,
      r.tierDiscountKopecks,
      r.couponDiscountKopecks,
      r.totalDiscountKopecks,
      r.discountedItemsKopecks,
      r.shippingKopecks,
      r.totalKopecks,
      ...r.appliedCoupons.map((a) => a.baseKopecks),
      ...r.appliedCoupons.map((a) => a.discountKopecks),
    ];
    for (const amount of amounts) expect(Number.isInteger(amount)).toBe(true);
  });
});

describe("AC-9: expired coupons are rejected explicitly", () => {
  it("AC-9: a coupon past its expiry does not discount and is reported", () => {
    const catalog = [
      coupon({ code: "OLD10", value: 10, expiresAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const r = priceOrder(order({ coupons: ["OLD10"] }), catalog, NOW);
    expect(r.appliedCoupons).toEqual([]);
    expect(r.rejectedCoupons).toEqual([{ code: "OLD10", reason: "expired" }]);
    expect(r.totalKopecks).toBe(104_900);
  });

  it("AC-9: the coupon is invalid exactly at the expiry instant", () => {
    const catalog = [coupon({ code: "EDGE", value: 10, expiresAt: NOW.toISOString() })];
    const r = priceOrder(order({ coupons: ["EDGE"] }), catalog, NOW);
    expect(r.rejectedCoupons).toEqual([{ code: "EDGE", reason: "expired" }]);
  });

  it("AC-9: it is still valid one millisecond earlier", () => {
    const catalog = [
      coupon({ code: "EDGE", value: 10, expiresAt: new Date(NOW.getTime() + 1).toISOString() }),
    ];
    const r = priceOrder(order({ coupons: ["EDGE"] }), catalog, NOW);
    expect(r.couponDiscountKopecks).toBe(10_000);
    expect(r.rejectedCoupons).toEqual([]);
  });

  it("AC-9: an unparsable expiry fails closed as expired", () => {
    const catalog = [coupon({ code: "JUNK", value: 10, expiresAt: "whenever" })];
    const r = priceOrder(order({ coupons: ["JUNK"] }), catalog, NOW);
    expect(r.rejectedCoupons).toEqual([{ code: "JUNK", reason: "expired" }]);
  });

  it("AC-9: an expired coupon does not consume its scope", () => {
    const catalog = [
      coupon({ code: "OLD50", value: 50, expiresAt: "2026-01-01T00:00:00.000Z" }),
      coupon({ code: "NEW10", value: 10 }),
    ];
    const r = priceOrder(order({ coupons: ["OLD50", "NEW10"] }), catalog, NOW);
    expect(r.appliedCoupons.map((a) => a.code)).toEqual(["NEW10"]);
    expect(r.couponDiscountKopecks).toBe(10_000);
  });
});

describe("AC-10: nothing goes negative", () => {
  it("AC-10: an oversized fixed coupon is capped at what is left", () => {
    const items = [item({ unitPriceKopecks: 10_000 })]; // 100 грн
    const catalog = [coupon({ code: "MINUS500", kind: "fixed", value: 50_000 })];
    const r = priceOrder(
      order({ items, customerTier: "gold", coupons: ["MINUS500"] }),
      catalog,
      NOW,
    );
    expect(r.tierDiscountKopecks).toBe(1_000);
    expect(r.appliedCoupons[0]?.discountKopecks).toBe(9_000); // capped, not 50_000
    expect(r.discountedItemsKopecks).toBe(0);
    expect(r.totalKopecks).toBe(4_900); // shipping is still payable
  });

  it("AC-10: once the scope is fully discounted the next coupon has no base", () => {
    const catalog = [
      coupon({ code: "FULL100", value: 100 }),
      coupon({ code: "FRESH10", value: 10, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items: mixedItems(), coupons: ["FULL100", "FRESH10"] }),
      catalog,
      NOW,
    );
    expect(r.couponDiscountKopecks).toBe(100_000);
    expect(r.discountedItemsKopecks).toBe(0);
    expect(r.rejectedCoupons).toEqual([
      { code: "FRESH10", reason: "nothing_left_to_discount" },
    ]);
    expect(r.totalKopecks).toBe(4_900);
  });

  it("AC-10: a negative fixed value cannot raise the price", () => {
    const catalog = [coupon({ code: "WEIRD", kind: "fixed", value: -5_000 })];
    const r = priceOrder(order({ coupons: ["WEIRD"] }), catalog, NOW);
    expect(r.couponDiscountKopecks).toBe(0);
    expect(r.totalKopecks).toBe(104_900);
  });

  it("AC-10: a percentage above 100 cannot exceed the base", () => {
    const catalog = [coupon({ code: "OVER", value: 150 })];
    const r = priceOrder(order({ coupons: ["OVER"] }), catalog, NOW);
    expect(r.couponDiscountKopecks).toBe(100_000);
    expect(r.discountedItemsKopecks).toBe(0);
  });
});

describe("AC-11: unknown codes are reported, never silently dropped", () => {
  it("AC-11: a code that is not in the catalog is rejected as unknown", () => {
    const catalog = [coupon({ code: "SAVE10", value: 10 })];
    const r = priceOrder(order({ coupons: ["NOPE", "SAVE10"] }), catalog, NOW);
    expect(r.rejectedCoupons).toEqual([{ code: "NOPE", reason: "unknown_code" }]);
    expect(r.appliedCoupons.map((a) => a.code)).toEqual(["SAVE10"]);
  });

  it("AC-11: with no catalog every typed code is unknown", () => {
    const r = priceOrder(order({ coupons: ["A", "B"] }));
    expect(r.rejectedCoupons).toEqual([
      { code: "A", reason: "unknown_code" },
      { code: "B", reason: "unknown_code" },
    ]);
    expect(r.totalDiscountKopecks).toBe(0);
  });

  it("AC-11: codes match exactly — a different case is not the same coupon", () => {
    const catalog = [coupon({ code: "SAVE10", value: 10 })];
    const r = priceOrder(order({ coupons: ["save10"] }), catalog, NOW);
    expect(r.rejectedCoupons).toEqual([{ code: "save10", reason: "unknown_code" }]);
  });
});

describe("AC-12: a category coupon with no matching items", () => {
  it("AC-12: a coupon for a category the order does not contain is rejected", () => {
    const catalog = [coupon({ code: "DIGI10", value: 10, category: "digital" })];
    const r = priceOrder(
      order({ items: mixedItems(), coupons: ["DIGI10"] }),
      catalog,
      NOW,
    );
    expect(r.appliedCoupons).toEqual([]);
    expect(r.rejectedCoupons).toEqual([{ code: "DIGI10", reason: "no_matching_items" }]);
  });
});

describe("AC-13: the breakdown is internally consistent", () => {
  it("AC-13: the parts always add up", () => {
    const items = [
      item({ sku: "A", unitPriceKopecks: 7_777, quantity: 3, category: "standard" }),
      item({ sku: "B", unitPriceKopecks: 1_234, quantity: 5, category: "fresh" }),
      item({ sku: "C", unitPriceKopecks: 999, quantity: 2, category: "digital" }),
    ];
    const catalog = [
      coupon({ code: "ALL7", value: 7 }),
      coupon({ code: "FRESH150", kind: "fixed", value: 150, category: "fresh" }),
    ];
    const r = priceOrder(
      order({ items, customerTier: "silver", coupons: ["ALL7", "FRESH150"] }),
      catalog,
      NOW,
    );
    const couponSum = r.appliedCoupons.reduce((s, a) => s + a.discountKopecks, 0);
    expect(r.couponDiscountKopecks).toBe(couponSum);
    expect(r.totalDiscountKopecks).toBe(r.tierDiscountKopecks + r.couponDiscountKopecks);
    expect(r.discountedItemsKopecks).toBe(r.subtotalKopecks - r.totalDiscountKopecks);
    expect(r.totalKopecks).toBe(r.discountedItemsKopecks + r.shippingKopecks);
    expect(r.discountedItemsKopecks).toBeGreaterThanOrEqual(0);
  });

  it("AC-13: an order with no tier and no coupons is just items + shipping", () => {
    const r = priceOrder(order({ items: mixedItems() }), [], NOW);
    expect(r).toMatchObject({
      subtotalKopecks: 100_000,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      discountedItemsKopecks: 100_000,
      shippingKopecks: 4_900,
      totalKopecks: 104_900,
      appliedCoupons: [],
      rejectedCoupons: [],
    });
  });

  it("AC-13: a digital-only order is discounted with no shipping to pay", () => {
    const items = [item({ unitPriceKopecks: 100_000, category: "digital" })];
    const catalog = [coupon({ code: "DIGI25", value: 25, category: "digital" })];
    const r = priceOrder(
      order({ items, customerTier: "silver", coupons: ["DIGI25"] }),
      catalog,
      NOW,
    );
    expect(r.shippingKopecks).toBe(0);
    expect(r.tierDiscountKopecks).toBe(5_000);
    expect(r.couponDiscountKopecks).toBe(23_750); // 25% of 95_000
    expect(r.totalKopecks).toBe(71_250);
  });

  it("AC-13: an empty order prices to zero and swallows no code silently", () => {
    const catalog = [coupon({ code: "SAVE10", value: 10 })];
    const r = priceOrder(order({ items: [], coupons: ["SAVE10"] }), catalog, NOW);
    expect(r.subtotalKopecks).toBe(0);
    expect(r.shippingKopecks).toBe(0);
    expect(r.totalKopecks).toBe(0);
    expect(r.rejectedCoupons).toEqual([
      { code: "SAVE10", reason: "nothing_left_to_discount" },
    ]);
  });

  it("AC-13: pricing does not mutate the order it was given", () => {
    const o = order({ items: mixedItems(), customerTier: "gold", coupons: ["SAVE10"] });
    const snapshot = JSON.stringify(o);
    priceOrder(o, [coupon({ code: "SAVE10", value: 10 })], NOW);
    expect(JSON.stringify(o)).toBe(snapshot);
  });
});
