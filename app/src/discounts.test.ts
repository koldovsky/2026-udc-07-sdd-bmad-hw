// Tests are named by acceptance-criterion id from docs/spec/pricing-discounts.md.
// The id prefix is what makes docs/traceability.md verifiable from test output:
//   cd app && npm test -- --reporter=verbose
//
// Every test goes through price(), which asserts the AC-20 balance invariant on
// each result — so AC-20 is enforced across the whole suite, not just in its own case.

import { describe, it, expect } from "vitest";
import { priceOrder, roundKopecks } from "./discounts.js";
import type { PriceBreakdown } from "./discounts.js";
import type { Order, LineItem, Coupon } from "./types.js";

// ── fixtures ────────────────────────────────────────────────────────────────

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
  items: [item({ unitPriceKopecks: 100_000 })], // subtotal 100 000 = 1 000 грн
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...over,
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "CODE",
  kind: "percent",
  value: 10,
  expiresAt: "2030-01-01T00:00:00Z",
  ...over,
});

/** A fixed instant well before every fixture expiry, so tests never depend on the wall clock. */
const NOW = new Date("2026-09-02T12:00:00Z");

/** AC-20: the breakdown must reconcile exactly on every result the engine produces. */
function expectBalanced(b: PriceBreakdown): void {
  const amounts = [
    b.subtotalKopecks,
    b.tierDiscountKopecks,
    b.couponDiscountKopecks,
    b.discountedGoodsKopecks,
    b.shippingKopecks,
    b.totalKopecks,
    ...b.appliedCoupons.map((a) => a.discountKopecks),
  ];
  for (const n of amounts) {
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
  }
  expect(
    b.subtotalKopecks - b.tierDiscountKopecks - b.couponDiscountKopecks + b.shippingKopecks,
  ).toBe(b.totalKopecks);
  expect(b.discountedGoodsKopecks + b.shippingKopecks).toBe(b.totalKopecks);
  expect(b.appliedCoupons.reduce((s, a) => s + a.discountKopecks, 0)).toBe(
    b.couponDiscountKopecks,
  );
}

function price(o: Order, catalog: Coupon[] = [], now: Date = NOW): PriceBreakdown {
  const result = priceOrder(o, catalog, now);
  expectBalanced(result);
  return result;
}

const reasons = (b: PriceBreakdown) => b.rejectedCoupons.map((r) => `${r.code}:${r.reason}`);

// ── AC-1 .. AC-4: tier and the discount base ────────────────────────────────

describe("tier discount", () => {
  it("AC-1: gold order of 100 000 with no coupons → tier 10 000, total 94 900", () => {
    const b = price(order({ customerTier: "gold" }));
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(4_900);
    expect(b.totalKopecks).toBe(94_900); // 100 000 − 10 000 + 4 900
  });

  it("AC-2: silver → tier 5 000, total 99 900; none → tier 0, total 104 900", () => {
    const silver = price(order({ customerTier: "silver" }));
    expect(silver.tierPercent).toBe(5);
    expect(silver.tierDiscountKopecks).toBe(5_000);
    expect(silver.totalKopecks).toBe(99_900);

    const none = price(order({ customerTier: "none" }));
    expect(none.tierPercent).toBe(0);
    expect(none.tierDiscountKopecks).toBe(0);
    expect(none.totalKopecks).toBe(104_900);
  });

  it("AC-3: gold + 15% coupon compose sequentially → coupon 13 500, not 15 000", () => {
    const b = price(
      order({ customerTier: "gold", coupons: ["AUTUMN15"] }),
      [coupon({ code: "AUTUMN15", kind: "percent", value: 15 })],
    );
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(13_500); // 15% of the remaining 90 000
    expect(b.discountedGoodsKopecks).toBe(76_500);
    expect(b.totalKopecks).toBe(81_400);
  });

  it("AC-4: international shipping is outside the base → tier 10 000, total 109 900", () => {
    const b = price(order({ customerTier: "gold", country: "PL" }));
    expect(b.shippingKopecks).toBe(19_900);
    expect(b.tierDiscountKopecks).toBe(10_000); // not 11 990
    expect(b.totalKopecks).toBe(109_900);
  });
});

// ── AC-5 .. AC-7: category scoping and stacking ─────────────────────────────

const mixedOrder = (over: Partial<Order> = {}): Order =>
  order({
    items: [
      item({ sku: "S-1", unitPriceKopecks: 60_000, category: "standard" }),
      item({ sku: "F-1", unitPriceKopecks: 40_000, category: "fresh" }),
    ],
    customerTier: "gold",
    ...over,
  });

describe("category coupons", () => {
  it("AC-5: 20% fresh coupon uses the category share of the remainder → 7 200", () => {
    const b = price(mixedOrder({ coupons: ["FRESH20"] }), [
      coupon({ code: "FRESH20", value: 20, category: "fresh" }),
    ]);
    expect(b.subtotalKopecks).toBe(100_000);
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(7_200); // 20% of 40 000 × 90 000 / 100 000 = 36 000
    expect(b.totalKopecks).toBe(87_700);
  });

  it("AC-6: two coupons on the same category → the second is duplicate_scope", () => {
    const b = price(mixedOrder({ coupons: ["FRESH20", "FRESH10"] }), [
      coupon({ code: "FRESH20", value: 20, category: "fresh" }),
      coupon({ code: "FRESH10", value: 10, category: "fresh" }),
    ]);
    expect(b.appliedCoupons).toEqual([{ code: "FRESH20", discountKopecks: 7_200 }]);
    expect(reasons(b)).toEqual(["FRESH10:duplicate_scope"]);
    expect(b.totalKopecks).toBe(87_700); // identical to AC-5
  });

  it("AC-7: different scopes stack in entry order → 7 200 then 8 280", () => {
    const b = price(mixedOrder({ coupons: ["FRESH20", "ORDER10"] }), [
      coupon({ code: "FRESH20", value: 20, category: "fresh" }),
      coupon({ code: "ORDER10", value: 10 }),
    ]);
    expect(b.appliedCoupons).toEqual([
      { code: "FRESH20", discountKopecks: 7_200 }, // leaves 82 800
      { code: "ORDER10", discountKopecks: 8_280 }, // 10% of 82 800
    ]);
    expect(b.couponDiscountKopecks).toBe(15_480);
    expect(b.discountedGoodsKopecks).toBe(74_520);
    expect(b.totalKopecks).toBe(79_420);
  });
});

// ── AC-8 .. AC-9: minimum subtotal ──────────────────────────────────────────

describe("minimum subtotal threshold", () => {
  const min95k = coupon({
    code: "MIN95K",
    kind: "fixed",
    value: 5_000,
    minSubtotalKopecks: 95_000,
  });

  it("AC-8: measured against the pre-discount subtotal → applies despite remainder 90 000", () => {
    const b = price(order({ customerTier: "gold", coupons: ["MIN95K"] }), [min95k]);
    expect(b.couponDiscountKopecks).toBe(5_000);
    expect(b.rejectedCoupons).toEqual([]);
    expect(b.totalKopecks).toBe(89_900);
  });

  it("AC-9: 94 999 is below the threshold, 95 000 is not (inclusive)", () => {
    const below = price(
      order({ items: [item({ unitPriceKopecks: 94_999 })], coupons: ["MIN95K"] }),
      [min95k],
    );
    expect(reasons(below)).toEqual(["MIN95K:below_min_subtotal"]);
    expect(below.couponDiscountKopecks).toBe(0);

    const exact = price(
      order({ items: [item({ unitPriceKopecks: 95_000 })], coupons: ["MIN95K"] }),
      [min95k],
    );
    expect(exact.couponDiscountKopecks).toBe(5_000);
  });
});

// ── AC-10: expiry ───────────────────────────────────────────────────────────

describe("expiry", () => {
  const expiring = coupon({ code: "OLD10", expiresAt: "2026-10-01T00:00:00Z" });

  it("AC-10: invalid at the expiresAt instant, valid one second before, never throws", () => {
    const at = price(
      order({ coupons: ["OLD10"] }),
      [expiring],
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(reasons(at)).toEqual(["OLD10:expired"]);
    expect(at.couponDiscountKopecks).toBe(0);
    expect(at.totalKopecks).toBe(104_900); // exactly as if no coupon were entered

    const before = price(
      order({ coupons: ["OLD10"] }),
      [expiring],
      new Date("2026-09-30T23:59:59Z"),
    );
    expect(before.appliedCoupons).toEqual([{ code: "OLD10", discountKopecks: 10_000 }]);
  });
});

// ── AC-11 .. AC-14: boundaries ──────────────────────────────────────────────

describe("boundaries", () => {
  it("AC-11: fixed coupon larger than the order caps at the remainder, total = shipping", () => {
    const b = price(
      order({ items: [item({ unitPriceKopecks: 5_000 })], coupons: ["BIG100"] }),
      [coupon({ code: "BIG100", kind: "fixed", value: 10_000 })],
    );
    expect(b.couponDiscountKopecks).toBe(5_000); // capped, not 10 000
    expect(b.discountedGoodsKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(4_900);
    expect(b.totalKopecks).toBe(4_900); // never negative, shipping untouched
  });

  it("AC-12: empty order prices to zero and rejects the coupon without throwing", () => {
    const b = price(order({ items: [], customerTier: "gold", coupons: ["ORDER10"] }), [
      coupon({ code: "ORDER10" }),
    ]);
    expect(b.subtotalKopecks).toBe(0);
    expect(b.tierDiscountKopecks).toBe(0);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(0);
    expect(b.totalKopecks).toBe(0);
    expect(reasons(b)).toEqual(["ORDER10:no_matching_items"]);
  });

  it("AC-13: half a kopeck rounds up — 5% of 4 050 is 203, not 202", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 1_350, quantity: 3 })],
        customerTier: "silver",
      }),
    );
    expect(b.subtotalKopecks).toBe(4_050);
    expect(b.tierDiscountKopecks).toBe(203);
    expect(b.discountedGoodsKopecks).toBe(3_847);
    expect(b.totalKopecks).toBe(8_747);

    expect(roundKopecks(202.5)).toBe(203);
    expect(roundKopecks(202.4)).toBe(202);
  });

  it("AC-14: the category base itself rounds half-up → base 4 751, coupon 475", () => {
    const b = price(
      order({
        items: [
          item({ sku: "S-1", unitPriceKopecks: 5_000, category: "standard" }),
          item({ sku: "F-1", unitPriceKopecks: 5_001, category: "fresh" }),
        ],
        customerTier: "silver",
        coupons: ["FRESH10"],
      }),
      [coupon({ code: "FRESH10", value: 10, category: "fresh" })],
    );
    expect(b.subtotalKopecks).toBe(10_001);
    expect(b.tierDiscountKopecks).toBe(500); // round(500.05)
    expect(b.couponDiscountKopecks).toBe(475); // round(4 751 × 10%) = round(475.1)
    expect(b.discountedGoodsKopecks).toBe(9_026);
    expect(b.totalKopecks).toBe(13_926);
  });
});

// ── AC-15 .. AC-18, AC-21 .. AC-22: rejection reasons ─────────────���─────────

describe("rejection reasons", () => {
  it("AC-15: an unknown code is rejected as unknown and pricing still completes", () => {
    const b = price(order({ coupons: ["NOPE"] }), [coupon({ code: "ORDER10" })]);
    expect(reasons(b)).toEqual(["NOPE:unknown"]);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.totalKopecks).toBe(104_900);
  });

  it("AC-16: the same code twice discounts once, the repeat is duplicate_code", () => {
    const b = price(order({ coupons: ["ORDER10", "ORDER10"] }), [coupon({ code: "ORDER10" })]);
    expect(b.appliedCoupons).toEqual([{ code: "ORDER10", discountKopecks: 10_000 }]);
    expect(reasons(b)).toEqual(["ORDER10:duplicate_code"]);
    expect(b.totalKopecks).toBe(94_900);
  });

  it("AC-17: a coupon for a category absent from the cart is no_matching_items", () => {
    const b = price(order({ coupons: ["FRESH20"] }), [
      coupon({ code: "FRESH20", value: 20, category: "fresh" }),
    ]);
    expect(reasons(b)).toEqual(["FRESH20:no_matching_items"]);
    expect(b.appliedCoupons).toEqual([]); // NOT applied with a zero discount
  });

  it("AC-18: malformed values are invalid_value and are never clamped into range", () => {
    const b = price(order({ coupons: ["BAD150", "NEG"] }), [
      coupon({ code: "BAD150", kind: "percent", value: 150 }),
      coupon({ code: "NEG", kind: "fixed", value: -100 }),
    ]);
    expect(reasons(b)).toEqual(["BAD150:invalid_value", "NEG:invalid_value"]);
    expect(b.couponDiscountKopecks).toBe(0); // not clamped to 100% and not to 0-and-applied
    expect(b.totalKopecks).toBe(104_900);
  });

  it("AC-21: an unparseable expiresAt is invalid_value, not expired", () => {
    const b = price(order({ coupons: ["BROKEN"] }), [
      coupon({ code: "BROKEN", expiresAt: "not-a-date" }),
    ]);
    expect(reasons(b)).toEqual(["BROKEN:invalid_value"]);
    expect(b.couponDiscountKopecks).toBe(0);
  });

  it("AC-22: on duplicate catalogue entries the first one wins", () => {
    const b = price(order({ coupons: ["SAME"] }), [
      coupon({ code: "SAME", kind: "percent", value: 10 }),
      coupon({ code: "SAME", kind: "percent", value: 50 }),
    ]);
    expect(b.couponDiscountKopecks).toBe(10_000); // not 50 000
    expect(b.totalKopecks).toBe(94_900);
  });

  it("AC-23: non-integral fixed values are invalid_value; a fractional percent is fine", () => {
    const bad = price(order({ coupons: ["NANV", "HALF"] }), [
      coupon({ code: "NANV", kind: "fixed", value: Number.NaN }),
      coupon({ code: "HALF", kind: "fixed", value: 100.5 }),
    ]);
    expect(reasons(bad)).toEqual(["NANV:invalid_value", "HALF:invalid_value"]);
    expect(bad.couponDiscountKopecks).toBe(0);

    // A fractional percentage is a legitimate promotion — roundKopecks absorbs it.
    const ok = price(order({ coupons: ["PCT75"] }), [
      coupon({ code: "PCT75", kind: "percent", value: 7.5 }),
    ]);
    expect(ok.couponDiscountKopecks).toBe(7_500);
    expect(ok.totalKopecks).toBe(97_400);
  });
});

// ── AC-19 .. AC-20 ──────────────────���───────────────────────────────────────

describe("shipping and invariants", () => {
  it("AC-19: a digital-only order keeps zero shipping while discounts still apply", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 100_000, category: "digital" })],
        customerTier: "gold",
        coupons: ["ORDER10"],
      }),
      [coupon({ code: "ORDER10" })],
    );
    expect(b.shippingKopecks).toBe(0);
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(9_000); // 10% of the remaining 90 000
    expect(b.totalKopecks).toBe(81_000);
  });

  it("AC-20: the breakdown balances and stays integral on a worst-case mix", () => {
    const b = price(
      order({
        items: [
          item({ sku: "S-1", unitPriceKopecks: 3_333, quantity: 3, category: "standard" }),
          item({ sku: "F-1", unitPriceKopecks: 1_111, quantity: 7, category: "fresh" }),
          item({ sku: "D-1", unitPriceKopecks: 999, category: "digital" }),
        ],
        customerTier: "silver",
        country: "PL",
        coupons: ["FRESH20", "ORDER10", "FRESH20", "GHOST", "BROKEN", "ORDER10"],
      }),
      [
        coupon({ code: "FRESH20", value: 20, category: "fresh" }),
        coupon({ code: "ORDER10", value: 10 }),
        coupon({ code: "BROKEN", expiresAt: "" }),
      ],
    );
    // expectBalanced() inside price() carries the assertion; these pin the shape.
    expect(b.appliedCoupons.map((a) => a.code)).toEqual(["FRESH20", "ORDER10"]);
    expect(reasons(b)).toEqual([
      "FRESH20:duplicate_code",
      "GHOST:unknown",
      "BROKEN:invalid_value",
      "ORDER10:duplicate_code",
    ]);
  });
});




