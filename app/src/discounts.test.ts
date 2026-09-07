import { describe, expect, it } from "vitest";
import { priceOrder } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

const now = new Date("2026-09-07T12:00:00.000Z");
const activeExpiry = "2026-10-01T00:00:00.000Z";

const item = (over: Partial<LineItem> = {}): LineItem => ({
  sku: "item",
  name: "Item",
  unitPriceKopecks: 10_000,
  quantity: 1,
  category: "standard",
  ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: "order",
  items: [item()],
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...over,
});

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  code: "SAVE",
  kind: "percent",
  value: 10,
  expiresAt: activeExpiry,
  ...over,
});

describe("priceOrder", () => {
  it("AC-1: loyalty excludes shipping", () => {
    const result = priceOrder(
      order({ customerTier: "gold", items: [item({ unitPriceKopecks: 100_000 })] }),
      [],
      now,
    );

    expect(result).toMatchObject({
      subtotalKopecks: 100_000,
      tierDiscountKopecks: 10_000,
      couponDiscountKopecks: 0,
      shippingKopecks: 4_900,
      totalKopecks: 94_900,
    });
  });

  it("AC-2: loyalty and coupon stack sequentially", () => {
    const result = priceOrder(
      order({ customerTier: "gold", coupons: ["SAVE"], items: [item({ unitPriceKopecks: 100_000 })] }),
      [coupon({ value: 15 })],
      now,
    );

    expect(result.tierDiscountKopecks).toBe(10_000);
    expect(result.couponDiscountKopecks).toBe(13_500);
    expect(result.totalKopecks).toBe(81_400);
  });

  it("AC-3: overlapping coupons follow input order", () => {
    const result = priceOrder(
      order({
        coupons: ["FRESH-FIXED", "FRESH-PERCENT"],
        items: [
          item({ sku: "fresh", category: "fresh", unitPriceKopecks: 10_000 }),
          item({ sku: "standard", category: "standard", unitPriceKopecks: 10_000 }),
        ],
      }),
      [
        coupon({ code: "FRESH-FIXED", kind: "fixed", value: 1_000, category: "fresh" }),
        coupon({ code: "FRESH-PERCENT", value: 20, category: "fresh" }),
      ],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "fresh-fixed", status: "applied", discountKopecks: 1_000 },
      { code: "fresh-percent", status: "applied", discountKopecks: 1_800 },
    ]);
    expect(result.totalKopecks).toBe(22_100);
  });

  it("AC-4: a normalized code applies once", () => {
    const result = priceOrder(
      order({ coupons: [" save ", "Save"] }),
      [coupon({ code: "SAVE" })],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "save", status: "applied", discountKopecks: 1_000 },
      { code: "save", status: "rejected", discountKopecks: 0, reason: "duplicate" },
    ]);
    expect(result.totalKopecks).toBe(13_900);
  });

  it("AC-5: minimum uses the original subtotal", () => {
    const result = priceOrder(
      order({ customerTier: "gold", coupons: ["MINIMUM"] }),
      [coupon({ code: "MINIMUM", minSubtotalKopecks: 10_000 })],
      now,
    );

    expect(result.tierDiscountKopecks).toBe(1_000);
    expect(result.couponDiscountKopecks).toBe(900);
    expect(result.totalKopecks).toBe(13_000);
  });

  it("AC-6: a category coupon uses its remaining category balance", () => {
    const result = priceOrder(
      order({
        customerTier: "silver",
        coupons: ["FRESH"],
        items: [
          item({ sku: "fresh", category: "fresh", unitPriceKopecks: 6_000 }),
          item({ sku: "standard", category: "standard", unitPriceKopecks: 4_000 }),
        ],
      }),
      [coupon({ code: "FRESH", category: "fresh" })],
      now,
    );

    expect(result.tierDiscountKopecks).toBe(500);
    expect(result.couponDiscountKopecks).toBe(570);
    expect(result.totalKopecks).toBe(13_830);
  });

  it("AC-7: a fixed category coupon is capped and does not spill", () => {
    const result = priceOrder(
      order({
        coupons: ["FRESH-FIXED"],
        items: [
          item({ sku: "fresh", category: "fresh", unitPriceKopecks: 3_000 }),
          item({ sku: "standard", category: "standard", unitPriceKopecks: 7_000 }),
        ],
      }),
      [coupon({ code: "FRESH-FIXED", kind: "fixed", value: 5_000, category: "fresh" })],
      now,
    );

    expect(result.couponDiscountKopecks).toBe(3_000);
    expect(result.totalKopecks).toBe(11_900);
  });

  it("AC-8: exact halves round up once per percentage operation", () => {
    const result = priceOrder(
      order({ coupons: ["HALF"], items: [item({ unitPriceKopecks: 15 })] }),
      [coupon({ code: "HALF", value: 10 })],
      now,
    );

    expect(result.couponDiscountKopecks).toBe(2);
    expect(result.totalKopecks).toBe(4_913);
  });

  it("AC-9: the expiry instant is excluded", () => {
    const result = priceOrder(
      order({ coupons: ["EXPIRED"] }),
      [coupon({ code: "EXPIRED", expiresAt: now.toISOString() })],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "expired", status: "rejected", discountKopecks: 0, reason: "expired" },
    ]);
    expect(result.totalKopecks).toBe(14_900);
  });

  it("AC-10: rejected coupons do not stop valid coupons", () => {
    const result = priceOrder(
      order({ coupons: ["UNKNOWN", "SAVE"] }),
      [coupon()],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "unknown", status: "rejected", discountKopecks: 0, reason: "invalid_or_unknown" },
      { code: "save", status: "applied", discountKopecks: 1_000 },
    ]);
    expect(result.totalKopecks).toBe(13_900);
  });

  it("AC-11: a missing category is a structured rejection", () => {
    const result = priceOrder(
      order({ coupons: ["FRESH"], items: [item({ category: "standard" })] }),
      [coupon({ code: "FRESH", category: "fresh" })],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "fresh", status: "rejected", discountKopecks: 0, reason: "no_matching_category" },
    ]);
    expect(result.totalKopecks).toBe(14_900);
  });

  it("AC-12: empty orders stay at zero", () => {
    const result = priceOrder(order({ items: [] }), [], now);

    expect(result).toMatchObject({
      subtotalKopecks: 0,
      tierDiscountKopecks: 0,
      couponDiscountKopecks: 0,
      shippingKopecks: 0,
      totalKopecks: 0,
      couponResults: [],
    });
  });

  it("AC-13: conflicting coupon definitions are invalid", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE"] }),
      [
        coupon({ code: "SAVE", value: 10 }),
        coupon({ code: " save ", kind: "fixed", value: 500 }),
      ],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "save", status: "rejected", discountKopecks: 0, reason: "invalid_or_unknown" },
    ]);
    expect(result.totalKopecks).toBe(14_900);
  });

  it("AC-14: a malformed expiry is invalid", () => {
    const result = priceOrder(
      order({ coupons: ["SAVE"] }),
      [coupon({ expiresAt: "not-a-date" })],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "save", status: "rejected", discountKopecks: 0, reason: "invalid_or_unknown" },
    ]);
    expect(result.totalKopecks).toBe(14_900);
  });

  it("AC-15: a zero-saving coupon is applied", () => {
    const result = priceOrder(
      order({ coupons: ["TINY"], items: [item({ unitPriceKopecks: 1 })] }),
      [coupon({ code: "TINY", value: 10 })],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "tiny", status: "applied", discountKopecks: 0 },
    ]);
    expect(result.totalKopecks).toBe(4_901);
  });

  it("AC-16: below-minimum coupons are rejected", () => {
    const result = priceOrder(
      order({ coupons: ["MINIMUM"], items: [item({ unitPriceKopecks: 9_999 })] }),
      [coupon({ code: "MINIMUM", minSubtotalKopecks: 10_000 })],
      now,
    );

    expect(result.couponResults).toEqual([
      { code: "minimum", status: "rejected", discountKopecks: 0, reason: "minimum_not_met" },
    ]);
    expect(result.totalKopecks).toBe(14_899);
  });
});
