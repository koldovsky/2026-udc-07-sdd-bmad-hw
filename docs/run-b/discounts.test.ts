import { describe, it, expect } from "vitest";
import {
  quoteOrder,
  roundHalfUpKopecks,
  allocateByLargestRemainder,
  couponScope,
} from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

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

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "SAVE15",
  kind: "percent",
  value: 15,
  expiresAt: "2030-01-01T00:00:00Z",
  ...over,
});

const NOW = new Date("2026-09-06T12:00:00Z");

/** 1 000 грн of goods, split 700 standard / 300 fresh. */
const mixedOrder = (over: Partial<Order> = {}): Order =>
  order({
    items: [
      item({ sku: "STD", unitPriceKopecks: 70_000, category: "standard" }),
      item({ sku: "FRESH", unitPriceKopecks: 30_000, category: "fresh" }),
    ],
    ...over,
  });

describe("D1 — discounts apply to goods only, shipping is never discounted", () => {
  it("adds the full shipping fee on top of the discounted goods", () => {
    const q = quoteOrder(mixedOrder({ customerTier: "gold" }), [], NOW);
    expect(q.discountedSubtotalKopecks).toBe(90_000); // 1000 грн − 10%
    expect(q.shippingKopecks).toBe(4_900); // untouched by the tier discount
    expect(q.totalKopecks).toBe(94_900);
  });

  it("does not let shipping enlarge the discount base", () => {
    const international = quoteOrder(mixedOrder({ customerTier: "gold", country: "PL" }), [], NOW);
    expect(international.totalDiscountKopecks).toBe(10_000); // same 10% as domestic
    expect(international.totalKopecks).toBe(90_000 + 19_900);
  });
});

describe("D2 — tier first, then coupons, applied sequentially not additively", () => {
  it("stacks gold and a 15% coupon to −235 грн, not −250 грн", () => {
    const o = mixedOrder({ customerTier: "gold", coupons: ["SAVE15"] });
    const q = quoteOrder(o, [coupon()], NOW);

    expect(q.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 13_500]);
    expect(q.totalDiscountKopecks).toBe(23_500); // 235 грн, not 25_000
    expect(q.discountedSubtotalKopecks).toBe(76_500);
  });

  it("applies the tier before any coupon, whatever the typing order", () => {
    const o = mixedOrder({ customerTier: "silver", coupons: ["SAVE15"] });
    const q = quoteOrder(o, [coupon()], NOW);
    expect(q.discounts[0]?.source).toBe("tier");
    expect(q.discounts[1]?.code).toBe("SAVE15");
  });

  it("applies multiple coupons in the order the customer typed them", () => {
    const catalog = [
      coupon({ code: "FRESH20", kind: "percent", value: 20, category: "fresh" }),
      coupon({ code: "SAVE15" }),
    ];
    const typedFreshFirst = quoteOrder(
      mixedOrder({ customerTier: "gold", coupons: ["FRESH20", "SAVE15"] }),
      catalog,
      NOW,
    );
    // Worked example from the spec: 10 000, then 5 400, then 12 690.
    expect(typedFreshFirst.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 5_400, 12_690]);
    expect(typedFreshFirst.totalKopecks).toBe(71_910 + 4_900);
  });
});

describe("D3 — round half-up, once per discount, then allocate exactly", () => {
  it("rounds a half-kopeck up", () => {
    expect(roundHalfUpKopecks(0.5)).toBe(1);
    expect(roundHalfUpKopecks(1.5)).toBe(2);
    expect(roundHalfUpKopecks(0.49)).toBe(0);
    // 5% of 10 kopecks = 0.5 kopecks -> 1
    const q = quoteOrder(order({ items: [item({ unitPriceKopecks: 10 })], customerTier: "silver" }), [], NOW);
    expect(q.totalDiscountKopecks).toBe(1);
  });

  it("splits one rounded amount across lines with no kopeck left over", () => {
    const o = order({
      customerTier: "gold",
      items: [
        item({ sku: "A", unitPriceKopecks: 3_333 }),
        item({ sku: "B", unitPriceKopecks: 3_333 }),
        item({ sku: "C", unitPriceKopecks: 3_333 }),
      ],
    });
    const q = quoteOrder(o, [], NOW);
    // 10% of 9 999 = 999.9 -> 1 000, and goods land exactly 1 000 lower.
    expect(q.totalDiscountKopecks).toBe(1_000);
    expect(q.subtotalKopecks - q.discountedSubtotalKopecks).toBe(1_000);
  });

  it("allocates leftover kopecks to the largest remainders, ties by position", () => {
    expect(allocateByLargestRemainder(1, [1, 1, 1])).toEqual([1, 0, 0]);
    expect(allocateByLargestRemainder(10, [3, 3, 4])).toEqual([3, 3, 4]);
    expect(allocateByLargestRemainder(5, [1, 2, 3]).reduce((a, b) => a + b, 0)).toBe(5);
    expect(allocateByLargestRemainder(0, [5, 5])).toEqual([0, 0]);
    expect(allocateByLargestRemainder(7, [])).toEqual([]);
  });

  it("keeps the breakdown internally consistent", () => {
    const catalog = [coupon({ code: "FRESH20", value: 20, category: "fresh" }), coupon()];
    const q = quoteOrder(mixedOrder({ customerTier: "gold", coupons: ["FRESH20", "SAVE15"] }), catalog, NOW);
    const summed = q.discounts.reduce((sum, d) => sum + d.amountKopecks, 0);
    expect(summed).toBe(q.totalDiscountKopecks);
    expect(q.subtotalKopecks - q.totalDiscountKopecks).toBe(q.discountedSubtotalKopecks);
    expect(q.discountedSubtotalKopecks + q.shippingKopecks).toBe(q.totalKopecks);
  });
});

describe("D4 — one coupon per scope, first typed wins", () => {
  it("rejects a second coupon on the same category", () => {
    const catalog = [
      coupon({ code: "FRESH20", value: 20, category: "fresh" }),
      coupon({ code: "FRESH50", value: 50, category: "fresh" }),
    ];
    const q = quoteOrder(mixedOrder({ coupons: ["FRESH20", "FRESH50"] }), catalog, NOW);
    expect(q.discounts.map((d) => d.code)).toEqual(["FRESH20"]);
    expect(q.rejectedCoupons).toEqual([{ code: "FRESH50", reason: "scope-conflict" }]);
  });

  it("rejects a second order-wide coupon", () => {
    const catalog = [coupon({ code: "SAVE15" }), coupon({ code: "SAVE10", value: 10 })];
    const q = quoteOrder(mixedOrder({ coupons: ["SAVE15", "SAVE10"] }), catalog, NOW);
    expect(q.rejectedCoupons).toEqual([{ code: "SAVE10", reason: "scope-conflict" }]);
  });

  it("lets an order-wide coupon and a category coupon coexist", () => {
    const catalog = [coupon({ code: "FRESH20", value: 20, category: "fresh" }), coupon()];
    const q = quoteOrder(mixedOrder({ coupons: ["FRESH20", "SAVE15"] }), catalog, NOW);
    expect(q.discounts.map((d) => d.code)).toEqual(["FRESH20", "SAVE15"]);
    expect(q.rejectedCoupons).toEqual([]);
  });

  it("leaves the scope free when the earlier coupon did not apply", () => {
    const catalog = [
      coupon({ code: "FRESH0", value: 0, category: "fresh" }),
      coupon({ code: "FRESH20", value: 20, category: "fresh" }),
    ];
    const q = quoteOrder(mixedOrder({ coupons: ["FRESH0", "FRESH20"] }), catalog, NOW);
    expect(q.rejectedCoupons).toEqual([{ code: "FRESH0", reason: "no-effect" }]);
    expect(q.discounts.map((d) => d.code)).toEqual(["FRESH20"]);
  });

  it("derives the scope from the category, defaulting to the whole order", () => {
    expect(couponScope(coupon())).toBe("order");
    expect(couponScope(coupon({ category: "digital" }))).toBe("digital");
  });
});

describe("D5 — a category coupon's percentage comes from that category only", () => {
  it("takes 20% of the fresh lines, not of the whole order", () => {
    const catalog = [coupon({ code: "FRESH20", value: 20, category: "fresh" })];
    const q = quoteOrder(mixedOrder({ coupons: ["FRESH20"] }), catalog, NOW);
    expect(q.discounts[0]?.baseKopecks).toBe(30_000); // fresh only
    expect(q.totalDiscountKopecks).toBe(6_000); // 60 грн, not 200 грн
  });

  it("uses the category's remaining value after the tier discount", () => {
    const catalog = [coupon({ code: "FRESH20", value: 20, category: "fresh" })];
    const q = quoteOrder(mixedOrder({ customerTier: "gold", coupons: ["FRESH20"] }), catalog, NOW);
    expect(q.discounts[1]?.baseKopecks).toBe(27_000); // 300 грн less its 10% share
    expect(q.discounts[1]?.amountKopecks).toBe(5_400);
  });
});

describe("D6 — a fixed coupon is capped at its eligible remaining base", () => {
  it("never discounts more than the category holds", () => {
    const catalog = [
      coupon({ code: "FRESH500", kind: "fixed", value: 50_000, category: "fresh" }),
    ];
    const q = quoteOrder(mixedOrder({ coupons: ["FRESH500"] }), catalog, NOW);
    expect(q.totalDiscountKopecks).toBe(30_000); // the fresh lines, not 500 грн
    expect(q.discountedSubtotalKopecks).toBe(70_000); // standard lines untouched
  });

  it("subtracts a fixed amount in kopecks when the base covers it", () => {
    const catalog = [coupon({ code: "MINUS100", kind: "fixed", value: 10_000 })];
    const q = quoteOrder(mixedOrder({ coupons: ["MINUS100"] }), catalog, NOW);
    expect(q.totalDiscountKopecks).toBe(10_000);
  });
});

describe("D7 — minSubtotalKopecks is checked against the original items subtotal", () => {
  it("applies when the untouched subtotal reaches the threshold", () => {
    const catalog = [coupon({ minSubtotalKopecks: 100_000 })];
    const q = quoteOrder(mixedOrder({ coupons: ["SAVE15"] }), catalog, NOW);
    expect(q.rejectedCoupons).toEqual([]);
  });

  it("still applies when the tier discount would have pushed the order below it", () => {
    const catalog = [coupon({ minSubtotalKopecks: 100_000 })];
    const q = quoteOrder(mixedOrder({ customerTier: "gold", coupons: ["SAVE15"] }), catalog, NOW);
    // Goods after tier are 90 000 — below the threshold — but the check is pre-discount.
    expect(q.rejectedCoupons).toEqual([]);
    expect(q.discounts.map((d) => d.code)).toEqual([undefined, "SAVE15"]);
  });

  it("rejects when the subtotal falls short, and does not count shipping towards it", () => {
    const catalog = [coupon({ minSubtotalKopecks: 100_001 })];
    const q = quoteOrder(mixedOrder({ coupons: ["SAVE15"] }), catalog, NOW);
    expect(q.rejectedCoupons).toEqual([{ code: "SAVE15", reason: "below-min-subtotal" }]);
    expect(q.totalDiscountKopecks).toBe(0);
  });
});

describe("D8 — expiry is now >= expiresAt, and rejection is explicit", () => {
  it("rejects a coupon that expired yesterday", () => {
    const catalog = [coupon({ expiresAt: "2026-09-05T00:00:00Z" })];
    const q = quoteOrder(mixedOrder({ coupons: ["SAVE15"] }), catalog, NOW);
    expect(q.rejectedCoupons).toEqual([{ code: "SAVE15", reason: "expired" }]);
    expect(q.discounts).toEqual([]);
  });

  it("rejects at exactly the expiry instant", () => {
    const catalog = [coupon({ expiresAt: NOW.toISOString() })];
    expect(quoteOrder(mixedOrder({ coupons: ["SAVE15"] }), catalog, NOW).rejectedCoupons).toEqual([
      { code: "SAVE15", reason: "expired" },
    ]);
  });

  it("accepts one millisecond before expiry", () => {
    const catalog = [coupon({ expiresAt: new Date(NOW.getTime() + 1).toISOString() })];
    expect(quoteOrder(mixedOrder({ coupons: ["SAVE15"] }), catalog, NOW).rejectedCoupons).toEqual([]);
  });

  it("fails closed on an unparseable expiry date", () => {
    const catalog = [coupon({ expiresAt: "not a date" })];
    expect(quoteOrder(mixedOrder({ coupons: ["SAVE15"] }), catalog, NOW).rejectedCoupons).toEqual([
      { code: "SAVE15", reason: "expired" },
    ]);
  });

  it("still prices the rest of the order instead of throwing", () => {
    const catalog = [
      coupon({ code: "OLD", expiresAt: "2020-01-01T00:00:00Z" }),
      coupon({ code: "FRESH20", value: 20, category: "fresh" }),
    ];
    const q = quoteOrder(mixedOrder({ customerTier: "gold", coupons: ["OLD", "FRESH20"] }), catalog, NOW);
    expect(q.rejectedCoupons).toEqual([{ code: "OLD", reason: "expired" }]);
    expect(q.discounts.map((d) => d.amountKopecks)).toEqual([10_000, 5_400]);
  });
});

describe("D9 — the total can never go negative", () => {
  it("floors discounted goods at zero and charges shipping only", () => {
    const catalog = [coupon({ code: "HUGE", kind: "fixed", value: 999_999 })];
    const q = quoteOrder(mixedOrder({ customerTier: "gold", coupons: ["HUGE"] }), catalog, NOW);
    expect(q.discountedSubtotalKopecks).toBe(0);
    expect(q.totalDiscountKopecks).toBe(100_000); // never more than the goods
    expect(q.totalKopecks).toBe(4_900);
  });

  it("handles an empty order without discounts or negatives", () => {
    const q = quoteOrder(order({ items: [], customerTier: "gold", coupons: ["SAVE15"] }), [coupon()], NOW);
    expect(q.subtotalKopecks).toBe(0);
    expect(q.discounts).toEqual([]);
    expect(q.rejectedCoupons).toEqual([{ code: "SAVE15", reason: "no-effect" }]);
    expect(q.totalKopecks).toBe(q.shippingKopecks);
  });
});

describe("D10 — rejection reasons and their precedence", () => {
  it("rejects a code that is not in the catalog", () => {
    const q = quoteOrder(mixedOrder({ coupons: ["NOPE"] }), [coupon()], NOW);
    expect(q.rejectedCoupons).toEqual([{ code: "NOPE", reason: "unknown-code" }]);
  });

  it("rejects the second occurrence of the same code", () => {
    const q = quoteOrder(mixedOrder({ coupons: ["SAVE15", "SAVE15"] }), [coupon()], NOW);
    expect(q.discounts.map((d) => d.code)).toEqual(["SAVE15"]);
    expect(q.rejectedCoupons).toEqual([{ code: "SAVE15", reason: "duplicate-code" }]);
  });

  it("prefers unknown-code over every later check", () => {
    const q = quoteOrder(mixedOrder({ coupons: ["GHOST", "GHOST"] }), [], NOW);
    expect(q.rejectedCoupons).toEqual([
      { code: "GHOST", reason: "unknown-code" },
      { code: "GHOST", reason: "unknown-code" },
    ]);
  });

  it("prefers expired over below-min-subtotal", () => {
    const catalog = [coupon({ expiresAt: "2020-01-01T00:00:00Z", minSubtotalKopecks: 999_999 })];
    expect(quoteOrder(mixedOrder({ coupons: ["SAVE15"] }), catalog, NOW).rejectedCoupons).toEqual([
      { code: "SAVE15", reason: "expired" },
    ]);
  });

  it("reports no-effect when the category has no items", () => {
    const catalog = [coupon({ code: "DIGI20", value: 20, category: "digital" })];
    const q = quoteOrder(mixedOrder({ coupons: ["DIGI20"] }), catalog, NOW);
    expect(q.rejectedCoupons).toEqual([{ code: "DIGI20", reason: "no-effect" }]);
  });

  it("reports every rejection in typing order", () => {
    const catalog = [coupon({ code: "OLD", expiresAt: "2020-01-01T00:00:00Z" })];
    const q = quoteOrder(mixedOrder({ coupons: ["NOPE", "OLD"] }), catalog, NOW);
    expect(q.rejectedCoupons.map((r) => r.code)).toEqual(["NOPE", "OLD"]);
  });
});

describe("D11 — catalog values are clamped", () => {
  it("clamps a percentage above 100 down to 100", () => {
    const catalog = [coupon({ code: "WILD", value: 150 })];
    const q = quoteOrder(mixedOrder({ coupons: ["WILD"] }), catalog, NOW);
    expect(q.totalDiscountKopecks).toBe(100_000);
    expect(q.discountedSubtotalKopecks).toBe(0);
  });

  it("treats a negative or non-finite value as no discount at all", () => {
    const catalog = [
      coupon({ code: "NEG", kind: "fixed", value: -5_000 }),
      coupon({ code: "NAN", value: Number.NaN }),
    ];
    const q = quoteOrder(mixedOrder({ coupons: ["NEG", "NAN"] }), catalog, NOW);
    expect(q.totalDiscountKopecks).toBe(0);
    expect(q.rejectedCoupons.map((r) => r.reason)).toEqual(["no-effect", "no-effect"]);
  });
});

describe("tier percentages come from the seeded contract", () => {
  it("gives silver 5% and gold 10% of the goods", () => {
    expect(quoteOrder(mixedOrder({ customerTier: "silver" }), [], NOW).totalDiscountKopecks).toBe(5_000);
    expect(quoteOrder(mixedOrder({ customerTier: "gold" }), [], NOW).totalDiscountKopecks).toBe(10_000);
    expect(quoteOrder(mixedOrder({ customerTier: "none" }), [], NOW).discounts).toEqual([]);
  });
});
