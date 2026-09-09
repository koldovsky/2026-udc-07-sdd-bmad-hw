// ============================================================================
// Task D — Run B2 ARTIFACT, preserved verbatim. NOT production code.
//
// Produced by a second agent given only materials/feature-request.md (no
// spec), in an isolated worktree at commit c339625, under stricter path
// confinement than Run B1 (relative paths only). It read nothing outside
// its own tree, so its choices are independent of Task A-C entirely.
//
// Kept as evidence for the comparison table in docs/ab-validation.md.
// Nothing in app/ imports this, and docs/ is outside app/tsconfig.json's
// include, so it never compiles or runs as part of the project.
// ============================================================================

import { describe, it, expect } from "vitest";
import { priceOrder, percentOfKopecks } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

// Acceptance criteria, derived from materials/feature-request.md. The decision
// ids (D-n) they pin down are documented at the top of discounts.ts.
//
//   AC-1  loyalty tiers actually apply (silver 5%, gold 10%)              req. 1
//   AC-2  coupons: percent / fixed, category-restricted, min-subtotal     req. 2
//   AC-3  a coupon stacks with the tier discount, sequentially            req. 3
//   AC-4  expired coupons never apply                                     req. 4
//   AC-5  several coupons: all apply, typed order, one per scope           req. 5
//   AC-6  kopecks never drift: half-up per step, parts sum back           req. 6
//   AC-7  shipping is outside the discount base                          D-1
//   AC-8  nothing goes negative and nothing overshoots                   D-10
//   AC-9  a bad coupon is reported, not thrown                           D-9

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
  items: [item({ unitPriceKopecks: 50_000 }), item({ unitPriceKopecks: 25_000, quantity: 2 })],
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...over,
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "SAVE",
  kind: "percent",
  value: 15,
  expiresAt: "2026-12-31T00:00:00.000Z",
  ...over,
});

/** Fixed clock so expiry is deterministic. */
const NOW = new Date("2026-10-01T00:00:00.000Z");

/** standard 600 грн + fresh 400 грн = 1000 грн, for category-scope tests. */
const mixedOrder = (over: Partial<Order> = {}): Order =>
  order({
    items: [
      item({ unitPriceKopecks: 60_000, category: "standard" }),
      item({ unitPriceKopecks: 40_000, category: "fresh" }),
    ],
    ...over,
  });

describe("AC-1: loyalty tiers apply to the items subtotal", () => {
  it("AC-1: gold takes 10% (1000 грн -> 900 грн + 49 грн shipping)", () => {
    const b = priceOrder(order({ customerTier: "gold" }), [], NOW);
    expect(b.subtotalKopecks).toBe(100_000);
    expect(b.totalDiscountKopecks).toBe(10_000);
    expect(b.discountedSubtotalKopecks).toBe(90_000);
    expect(b.totalKopecks).toBe(94_900);
    expect(b.discounts).toEqual([
      { source: "tier", label: "gold tier -10%", amountKopecks: 10_000, scope: "order" },
    ]);
  });

  it("AC-1: silver takes 5%", () => {
    const b = priceOrder(order({ customerTier: "silver" }), [], NOW);
    expect(b.totalDiscountKopecks).toBe(5_000);
    expect(b.totalKopecks).toBe(99_900);
  });

  it("AC-1: an untiered customer gets no discount line at all (D-13)", () => {
    const b = priceOrder(order(), [], NOW);
    expect(b.discounts).toEqual([]);
    expect(b.totalDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
  });
});

describe("AC-2: coupon kinds and eligibility rules", () => {
  it("AC-2: a percent coupon takes its share of the order", () => {
    const b = priceOrder(order({ coupons: ["SAVE"] }), [coupon({ value: 15 })], NOW);
    expect(b.totalDiscountKopecks).toBe(15_000);
    expect(b.discounts).toEqual([
      { source: "coupon", code: "SAVE", label: "coupon SAVE -15%", amountKopecks: 15_000, scope: "order" },
    ]);
  });

  it("AC-2: a fixed coupon takes its hryvnia amount (200 грн)", () => {
    const c = coupon({ code: "MINUS200", kind: "fixed", value: 20_000 });
    const b = priceOrder(order({ coupons: ["MINUS200"] }), [c], NOW);
    expect(b.totalDiscountKopecks).toBe(20_000);
    expect(b.discountedSubtotalKopecks).toBe(80_000);
  });

  it("AC-2: a category percent coupon takes a share of THAT category only (D-6)", () => {
    const c = coupon({ code: "FRESH10", value: 10, category: "fresh" });
    const b = priceOrder(mixedOrder({ coupons: ["FRESH10"] }), [c], NOW);
    // 10% of the 400 грн fresh lines, not of the 1000 грн order.
    expect(b.totalDiscountKopecks).toBe(4_000);
    expect(b.discounts).toEqual([
      {
        source: "coupon",
        code: "FRESH10",
        label: "coupon FRESH10 -10% (fresh)",
        amountKopecks: 4_000,
        scope: "fresh",
      },
    ]);
  });

  it("AC-2: a fixed category coupon is capped by that category's amount (D-6, D-10)", () => {
    const c = coupon({ code: "FRESH1000", kind: "fixed", value: 100_000, category: "fresh" });
    const b = priceOrder(mixedOrder({ coupons: ["FRESH1000"] }), [c], NOW);
    // Never spills over onto the 600 грн of standard items.
    expect(b.totalDiscountKopecks).toBe(40_000);
    expect(b.discountedSubtotalKopecks).toBe(60_000);
  });

  it("AC-2: a coupon below its minimum subtotal is rejected", () => {
    const c = coupon({ code: "BIG", minSubtotalKopecks: 150_000 });
    const b = priceOrder(order({ coupons: ["BIG"] }), [c], NOW);
    expect(b.totalDiscountKopecks).toBe(0);
    expect(b.rejectedCoupons).toEqual([{ code: "BIG", reason: "min-subtotal-not-met" }]);
  });

  it("AC-2: the minimum is inclusive — exactly reaching it applies", () => {
    const c = coupon({ code: "BIG", minSubtotalKopecks: 100_000 });
    const b = priceOrder(order({ coupons: ["BIG"] }), [c], NOW);
    expect(b.totalDiscountKopecks).toBe(15_000);
    expect(b.rejectedCoupons).toEqual([]);
  });

  it("AC-2: the minimum is checked BEFORE other discounts (D-7)", () => {
    // Tier already pulls the order down to 900 грн, but the 1000 грн threshold
    // is judged against the basket the customer built.
    const c = coupon({ code: "BIG", minSubtotalKopecks: 100_000 });
    const b = priceOrder(order({ customerTier: "gold", coupons: ["BIG"] }), [c], NOW);
    expect(b.rejectedCoupons).toEqual([]);
    expect(b.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 13_500]);
  });

  it("AC-2: a category coupon with no matching items is rejected (D-12)", () => {
    const c = coupon({ code: "DIGI", category: "digital" });
    const b = priceOrder(mixedOrder({ coupons: ["DIGI"] }), [c], NOW);
    expect(b.discounts).toEqual([]);
    expect(b.rejectedCoupons).toEqual([{ code: "DIGI", reason: "no-items-in-category" }]);
  });

  it("AC-2: a category coupon runs on what the tier already reduced (D-2, D-6)", () => {
    const c = coupon({ code: "FRESH25", value: 25, category: "fresh" });
    const b = priceOrder(mixedOrder({ customerTier: "gold", coupons: ["FRESH25"] }), [c], NOW);
    // Tier -10% of 1000 грн = 100 грн, split 60/40 -> fresh is left at 360 грн.
    // Then -25% of 360 грн = 90 грн.
    expect(b.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 9_000]);
    expect(b.totalDiscountKopecks).toBe(19_000);
  });
});

describe("AC-3: a coupon stacks with the tier discount, sequentially (D-2)", () => {
  it("AC-3: gold + 15% on 1000 грн gives 235 грн off, not 250 грн", () => {
    const b = priceOrder(order({ customerTier: "gold", coupons: ["SAVE"] }), [coupon()], NOW);
    expect(b.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 13_500]);
    expect(b.totalDiscountKopecks).toBe(23_500);
    expect(b.discountedSubtotalKopecks).toBe(76_500);
    expect(b.totalKopecks).toBe(81_400);
  });

  it("AC-3: the tier step is always first, whatever the coupon list", () => {
    const b = priceOrder(order({ customerTier: "silver", coupons: ["SAVE"] }), [coupon()], NOW);
    expect(b.discounts.map((d) => d.source)).toEqual(["tier", "coupon"]);
  });
});

describe("AC-4: expired coupons never apply (D-8)", () => {
  it("AC-4: a coupon that expired yesterday is rejected", () => {
    const c = coupon({ code: "OLD", expiresAt: "2026-09-30T00:00:00.000Z" });
    const b = priceOrder(order({ coupons: ["OLD"] }), [c], NOW);
    expect(b.totalDiscountKopecks).toBe(0);
    expect(b.rejectedCoupons).toEqual([{ code: "OLD", reason: "expired" }]);
  });

  it("AC-4: the expiry instant itself is already too late (boundary)", () => {
    const c = coupon({ code: "EDGE", expiresAt: NOW.toISOString() });
    const b = priceOrder(order({ coupons: ["EDGE"] }), [c], NOW);
    expect(b.rejectedCoupons).toEqual([{ code: "EDGE", reason: "expired" }]);
  });

  it("AC-4: one millisecond before expiry it still applies (boundary)", () => {
    const c = coupon({ code: "EDGE", expiresAt: new Date(NOW.getTime() + 1).toISOString() });
    const b = priceOrder(order({ coupons: ["EDGE"] }), [c], NOW);
    expect(b.rejectedCoupons).toEqual([]);
    expect(b.totalDiscountKopecks).toBe(15_000);
  });

  it("AC-4: an unparseable expiry date is treated as expired (D-8)", () => {
    const c = coupon({ code: "JUNK", expiresAt: "not a date" });
    const b = priceOrder(order({ coupons: ["JUNK"] }), [c], NOW);
    expect(b.rejectedCoupons).toEqual([{ code: "JUNK", reason: "expired" }]);
  });

  it("AC-4: an expired coupon does not block the valid ones next to it", () => {
    const old = coupon({ code: "OLD", expiresAt: "2026-01-01T00:00:00.000Z" });
    const live = coupon({ code: "FRESH10", value: 10, category: "fresh" });
    const b = priceOrder(mixedOrder({ coupons: ["OLD", "FRESH10"] }), [old, live], NOW);
    expect(b.totalDiscountKopecks).toBe(4_000);
    expect(b.rejectedCoupons).toEqual([{ code: "OLD", reason: "expired" }]);
  });
});

describe("AC-5: several coupons (D-4, D-5)", () => {
  it("AC-5: every valid coupon applies, cascading, in the order typed", () => {
    const wide = coupon({ code: "ALL10", value: 10 });
    const fresh = coupon({ code: "FRESH20", value: 20, category: "fresh" });
    const b = priceOrder(mixedOrder({ coupons: ["ALL10", "FRESH20"] }), [wide, fresh], NOW);
    // -10% of 1000 грн = 100 грн (60 standard / 40 fresh), leaving fresh at 360 грн.
    // Then -20% of 360 грн = 72 грн.
    expect(b.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 7_200]);
    expect(b.totalDiscountKopecks).toBe(17_200);
    expect(b.totalKopecks).toBe(87_700);
  });

  it("AC-5: typed order changes the outcome, and that is the defined behaviour", () => {
    const flat = coupon({ code: "MINUS500", kind: "fixed", value: 50_000 });
    const fresh = coupon({ code: "FRESH20", value: 20, category: "fresh" });
    const catalog = [flat, fresh];
    const first = priceOrder(mixedOrder({ coupons: ["MINUS500", "FRESH20"] }), catalog, NOW);
    const second = priceOrder(mixedOrder({ coupons: ["FRESH20", "MINUS500"] }), catalog, NOW);
    // 500 грн flat, then 20% of the 200 грн of fresh still left = 40 грн.
    expect(first.totalDiscountKopecks).toBe(54_000);
    // 20% of 400 грн fresh = 80 грн, then the full 500 грн flat off 920 грн.
    expect(second.totalDiscountKopecks).toBe(58_000);
  });

  it("AC-5: a second coupon on the same category is rejected (D-5)", () => {
    const a = coupon({ code: "FRESH10", value: 10, category: "fresh" });
    const bb = coupon({ code: "FRESH30", value: 30, category: "fresh" });
    const b = priceOrder(mixedOrder({ coupons: ["FRESH10", "FRESH30"] }), [a, bb], NOW);
    expect(b.totalDiscountKopecks).toBe(4_000);
    expect(b.rejectedCoupons).toEqual([{ code: "FRESH30", reason: "scope-already-discounted" }]);
  });

  it("AC-5: two order-wide coupons also collide — only the first applies (D-5)", () => {
    const a = coupon({ code: "ALL10", value: 10 });
    const bb = coupon({ code: "ALL20", value: 20 });
    const b = priceOrder(order({ coupons: ["ALL10", "ALL20"] }), [a, bb], NOW);
    expect(b.totalDiscountKopecks).toBe(10_000);
    expect(b.rejectedCoupons).toEqual([{ code: "ALL20", reason: "scope-already-discounted" }]);
  });

  it("AC-5: the same code typed twice counts once", () => {
    const b = priceOrder(order({ coupons: ["SAVE", "SAVE"] }), [coupon()], NOW);
    expect(b.totalDiscountKopecks).toBe(15_000);
    expect(b.rejectedCoupons).toEqual([{ code: "SAVE", reason: "duplicate-code" }]);
  });

  it("AC-5: coupons on different categories all apply", () => {
    const o = order({
      items: [
        item({ unitPriceKopecks: 60_000, category: "standard" }),
        item({ unitPriceKopecks: 40_000, category: "fresh" }),
      ],
      coupons: ["STD10", "FRESH50"],
    });
    const catalog = [
      coupon({ code: "STD10", value: 10, category: "standard" }),
      coupon({ code: "FRESH50", value: 50, category: "fresh" }),
    ];
    const b = priceOrder(o, catalog, NOW);
    expect(b.discounts.map((d) => d.amountKopecks)).toEqual([6_000, 20_000]);
    expect(b.rejectedCoupons).toEqual([]);
  });
});

describe("AC-6: kopecks never drift (D-3)", () => {
  it("AC-6: percentOfKopecks rounds half a kopeck up", () => {
    expect(percentOfKopecks(10, 5)).toBe(1); // 0.5 -> 1
    expect(percentOfKopecks(15, 10)).toBe(2); // 1.5 -> 2
    expect(percentOfKopecks(25, 10)).toBe(3); // 2.5 -> 3
  });

  it("AC-6: percentOfKopecks truncates below the half and lifts above it", () => {
    expect(percentOfKopecks(333, 10)).toBe(33); // 33.3
    expect(percentOfKopecks(337, 10)).toBe(34); // 33.7
    expect(percentOfKopecks(0, 10)).toBe(0);
    expect(percentOfKopecks(100_000, 0)).toBe(0);
  });

  it("AC-6: a half-kopeck tier discount rounds in the customer's favour", () => {
    // 1.10 грн at silver 5% = 0.055 грн = 5.5 kopecks -> 6 kopecks.
    const o = order({ items: [item({ unitPriceKopecks: 110, quantity: 1 })], customerTier: "silver" });
    const b = priceOrder(o, [], NOW);
    expect(b.totalDiscountKopecks).toBe(6);
    expect(b.discountedSubtotalKopecks).toBe(104);
  });

  it("AC-6: rounding happens once per step, not per line", () => {
    // Three lines of 5 kopecks. Per line, silver 5% would round 0.25 -> 0 each
    // (0 total); per step it is 5% of 15 = 0.75 -> 1.
    const o = order({
      items: [
        item({ unitPriceKopecks: 5, quantity: 1 }),
        item({ unitPriceKopecks: 5, quantity: 1 }),
        item({ unitPriceKopecks: 5, quantity: 1 }),
      ],
      customerTier: "silver",
    });
    const b = priceOrder(o, [], NOW);
    expect(b.subtotalKopecks).toBe(15);
    expect(b.totalDiscountKopecks).toBe(1);
  });

  it("AC-6: a step split across categories still sums back exactly", () => {
    // 333.33 + 333.33 + 333.34 грн = 1000 грн. Gold -10% must be exactly 100 грн,
    // even though no category's tenth is a whole kopeck.
    const o = order({
      items: [
        item({ unitPriceKopecks: 33_333, category: "standard" }),
        item({ unitPriceKopecks: 33_333, category: "fresh" }),
        item({ unitPriceKopecks: 33_334, category: "digital" }),
      ],
      customerTier: "gold",
    });
    const b = priceOrder(o, [], NOW);
    expect(b.subtotalKopecks).toBe(100_000);
    expect(b.totalDiscountKopecks).toBe(10_000);
    expect(b.discountedSubtotalKopecks).toBe(90_000);
  });

  it("AC-6: the breakdown always balances and stays integral", () => {
    const o = mixedOrder({ customerTier: "gold", coupons: ["ALL7", "FRESH13"] });
    const catalog = [
      coupon({ code: "ALL7", value: 7 }),
      coupon({ code: "FRESH13", value: 13, category: "fresh" }),
    ];
    const b = priceOrder(o, catalog, NOW);
    const stepSum = b.discounts.reduce((s, d) => s + d.amountKopecks, 0);
    expect(stepSum).toBe(b.totalDiscountKopecks);
    expect(b.subtotalKopecks - b.totalDiscountKopecks).toBe(b.discountedSubtotalKopecks);
    expect(b.discountedSubtotalKopecks + b.shippingKopecks).toBe(b.totalKopecks);
    for (const value of [
      b.totalDiscountKopecks,
      b.discountedSubtotalKopecks,
      b.totalKopecks,
      ...b.discounts.map((d) => d.amountKopecks),
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("AC-7: shipping sits outside the discount base (D-1)", () => {
  it("AC-7: an international order is discounted on items only", () => {
    const b = priceOrder(order({ customerTier: "gold", country: "PL" }), [], NOW);
    // 10% of 1000 грн = 100 грн. Had shipping been in the base it would be 119.90 грн.
    expect(b.totalDiscountKopecks).toBe(10_000);
    expect(b.shippingKopecks).toBe(19_900);
    expect(b.totalKopecks).toBe(109_900);
  });

  it("AC-7: an all-digital order keeps its waived shipping", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000, category: "digital" })],
      customerTier: "gold",
    });
    const b = priceOrder(o, [], NOW);
    expect(b.shippingKopecks).toBe(0);
    expect(b.totalKopecks).toBe(90_000);
  });
});

describe("AC-8: nothing goes negative, nothing overshoots (D-10)", () => {
  it("AC-8: a fixed coupon larger than the order stops at zero, shipping still due", () => {
    const c = coupon({ code: "HUGE", kind: "fixed", value: 500_000 });
    const b = priceOrder(order({ coupons: ["HUGE"] }), [c], NOW);
    expect(b.totalDiscountKopecks).toBe(100_000);
    expect(b.discountedSubtotalKopecks).toBe(0);
    expect(b.totalKopecks).toBe(4_900);
  });

  it("AC-8: tier plus a 100% coupon cannot exceed the subtotal", () => {
    const c = coupon({ code: "FREE", value: 100 });
    const b = priceOrder(order({ customerTier: "gold", coupons: ["FREE"] }), [c], NOW);
    expect(b.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 90_000]);
    expect(b.discountedSubtotalKopecks).toBe(0);
  });

  it("AC-8: a percent above 100 is capped at the remaining amount", () => {
    const c = coupon({ code: "OOPS", value: 150 });
    const b = priceOrder(order({ coupons: ["OOPS"] }), [c], NOW);
    expect(b.totalDiscountKopecks).toBe(100_000);
    expect(b.discountedSubtotalKopecks).toBe(0);
  });

  it("AC-8: a coupon that comes out at 0 adds no discount line", () => {
    const c = coupon({ code: "NOOP", value: 0 });
    const b = priceOrder(order({ coupons: ["NOOP"] }), [c], NOW);
    expect(b.discounts).toEqual([]);
    expect(b.rejectedCoupons).toEqual([]);
    expect(b.totalKopecks).toBe(104_900);
  });

  it("AC-8: an empty order prices at zero without dividing by zero", () => {
    const c = coupon({ code: "SAVE" });
    const b = priceOrder(order({ items: [], customerTier: "gold", coupons: ["SAVE"] }), [c], NOW);
    expect(b.subtotalKopecks).toBe(0);
    expect(b.discounts).toEqual([]);
    expect(b.totalDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(0);
  });
});

describe("AC-9: a coupon that cannot be used is reported, not thrown (D-9, D-11)", () => {
  it("AC-9: an unknown code is rejected and pricing still succeeds", () => {
    const b = priceOrder(order({ customerTier: "silver", coupons: ["NOPE"] }), [coupon()], NOW);
    expect(b.rejectedCoupons).toEqual([{ code: "NOPE", reason: "unknown-code" }]);
    expect(b.totalDiscountKopecks).toBe(5_000);
  });

  it("AC-9: an empty catalogue rejects everything rather than throwing", () => {
    expect(() => priceOrder(order({ coupons: ["SAVE"] }), [], NOW)).not.toThrow();
    expect(priceOrder(order({ coupons: ["SAVE"] }), [], NOW).rejectedCoupons).toEqual([
      { code: "SAVE", reason: "unknown-code" },
    ]);
  });

  it("AC-9: codes are matched case-insensitively and trimmed (D-11)", () => {
    const b = priceOrder(order({ coupons: ["  save  "] }), [coupon({ code: "SAVE" })], NOW);
    expect(b.rejectedCoupons).toEqual([]);
    expect(b.discounts.map((d) => d.code)).toEqual(["SAVE"]);
  });

  it("AC-9: rejections echo back exactly what the customer typed", () => {
    const b = priceOrder(order({ coupons: ["oLd-CoDe"] }), [], NOW);
    expect(b.rejectedCoupons).toEqual([{ code: "oLd-CoDe", reason: "unknown-code" }]);
  });

  it("AC-9: rejections keep the typed order alongside the applied ones", () => {
    const catalog = [
      coupon({ code: "ALL10", value: 10 }),
      coupon({ code: "GONE", expiresAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const b = priceOrder(order({ coupons: ["MYSTERY", "ALL10", "GONE"] }), catalog, NOW);
    expect(b.rejectedCoupons).toEqual([
      { code: "MYSTERY", reason: "unknown-code" },
      { code: "GONE", reason: "expired" },
    ]);
    expect(b.discounts.map((d) => d.code)).toEqual(["ALL10"]);
  });

  it("AC-9: the catalogue and clock arguments are optional", () => {
    const b = priceOrder(order({ customerTier: "gold" }));
    expect(b.totalDiscountKopecks).toBe(10_000);
  });
});
