import { expect, test } from "vitest";
import { priceOrder } from "./discounts.js";
import type { Coupon, LineItem, Order } from "./types.js";

const nowMs = Date.parse("2026-10-01T12:00:00Z");
const expiresAt = "2026-10-02T12:00:00Z";

function line(unitPriceKopecks: number, category: LineItem["category"] = "standard"): LineItem {
  return { sku: `${category}-${unitPriceKopecks}`, name: category, unitPriceKopecks, quantity: 1, category };
}

function order(items: LineItem[], overrides: Partial<Omit<Order, "items">> = {}): Order {
  return { id: "order", items, country: "UA", customerTier: "none", coupons: [], ...overrides };
}

test("AC-1: Gold loyalty without coupons", () => {
  expect(priceOrder(order([line(100_000)], { customerTier: "gold" }), [], nowMs)).toEqual({
    subtotalKopecks: 100_000,
    couponDiscountKopecks: 0,
    tierDiscountKopecks: 10_000,
    shippingKopecks: 4_900,
    totalKopecks: 94_900,
  });
});

test("AC-2: Exclusive expiration at minus one, zero, and plus one millisecond", () => {
  const catalog: Coupon[] = [{ code: "SAVE", kind: "fixed", value: 1_000, expiresAt }];
  const basket = order([line(10_000)], { coupons: ["SAVE"] });
  const cutoff = Date.parse(expiresAt);

  expect(priceOrder(basket, catalog, cutoff - 1).couponDiscountKopecks).toBe(1_000);
  expect(priceOrder(basket, catalog, cutoff).couponDiscountKopecks).toBe(0);
  expect(priceOrder(basket, catalog, cutoff + 1).couponDiscountKopecks).toBe(0);
});

test("AC-3: Best of two coupons targeting the same category in both entry orders", () => {
  const catalog: Coupon[] = [
    { code: "FRESH10", kind: "percent", value: 10, category: "fresh", expiresAt },
    { code: "FRESH15", kind: "percent", value: 15, category: "fresh", expiresAt },
  ];
  const items = [line(10_000, "fresh"), line(10_000)];

  for (const coupons of [["FRESH10", "FRESH15"], ["FRESH15", "FRESH10"]]) {
    expect(priceOrder(order(items, { coupons }), catalog, nowMs)).toMatchObject({
      couponDiscountKopecks: 1_500,
      totalKopecks: 23_400,
    });
  }
});

test("AC-4: Fixed discount capped at subtotal before Gold loyalty", () => {
  const catalog: Coupon[] = [{ code: "SAVE", kind: "fixed", value: 20_000, expiresAt }];
  const basket = order([line(10_000)], { customerTier: "gold", coupons: ["SAVE"] });

  expect(priceOrder(basket, catalog, nowMs)).toMatchObject({
    couponDiscountKopecks: 10_000,
    tierDiscountKopecks: 0,
    totalKopecks: 4_900,
  });
});

test("AC-5: Silver loyalty applied after the coupon", () => {
  const catalog: Coupon[] = [{ code: "SAVE", kind: "percent", value: 10, expiresAt }];
  const basket = order([line(10_000)], { customerTier: "silver", coupons: ["SAVE"] });

  expect(priceOrder(basket, catalog, nowMs)).toMatchObject({
    couponDiscountKopecks: 1_000,
    tierDiscountKopecks: 450,
    totalKopecks: 13_450,
  });
});

test("AC-6: Aggregate loyalty rounding at half a kopeck", () => {
  const basket = order([line(2), line(3)], { customerTier: "gold" });

  expect(priceOrder(basket, [], nowMs)).toMatchObject({
    tierDiscountKopecks: 1,
    totalKopecks: 4_904,
  });
});

test("AC-7: Empty basket returns five zero amounts", () => {
  const catalog: Coupon[] = [{ code: "SAVE", kind: "fixed", value: 1_000, expiresAt }];
  const basket = order([], { customerTier: "gold", coupons: ["SAVE"] });

  expect(priceOrder(basket, catalog, nowMs)).toEqual({
    subtotalKopecks: 0,
    couponDiscountKopecks: 0,
    tierDiscountKopecks: 0,
    shippingKopecks: 0,
    totalKopecks: 0,
  });
});

test("AC-8: Whole-order minimum at equality and one kopeck below", () => {
  const catalog: Coupon[] = [
    { code: "FRESH10", kind: "percent", value: 10, category: "fresh", minSubtotalKopecks: 10_000, expiresAt },
  ];
  const atMinimum = order([line(4_000, "fresh"), line(6_000)], {
    customerTier: "gold",
    coupons: ["FRESH10"],
  });
  const belowMinimum = { ...atMinimum, items: [line(4_000, "fresh"), line(5_999)] };

  expect(priceOrder(atMinimum, catalog, nowMs).couponDiscountKopecks).toBe(400);
  expect(priceOrder(belowMinimum, catalog, nowMs).couponDiscountKopecks).toBe(0);
});

test("AC-9: Compare candidates after capping the category discount", () => {
  const catalog: Coupon[] = [
    { code: "FRESH", kind: "fixed", value: 5_000, category: "fresh", expiresAt },
    { code: "SAVE", kind: "fixed", value: 1_200, expiresAt },
  ];
  const basket = order([line(1_000, "fresh"), line(9_000)], { coupons: ["FRESH", "SAVE"] });

  expect(priceOrder(basket, catalog, nowMs).couponDiscountKopecks).toBe(1_200);
});

test("AC-10: Fixed category coupon with no eligible merchandise", () => {
  const catalog: Coupon[] = [{ code: "FRESH", kind: "fixed", value: 1_000, category: "fresh", expiresAt }];
  const basket = order([line(10_000)], { coupons: ["FRESH"] });

  expect(priceOrder(basket, catalog, nowMs)).toMatchObject({
    couponDiscountKopecks: 0,
    totalKopecks: 14_900,
  });
});

test("AC-11: Exact code matching, unknown codes, and duplicates", () => {
  const catalog: Coupon[] = [{ code: "SAVE", kind: "fixed", value: 1_000, expiresAt }];
  const items = [line(10_000)];
  const invalid = order(items, { coupons: ["save", "MISSING"] });
  const allCodes = order(items, { coupons: ["save", "MISSING", "SAVE", "SAVE"] });

  expect(priceOrder(invalid, catalog, nowMs).couponDiscountKopecks).toBe(0);
  expect(priceOrder(allCodes, catalog, nowMs).couponDiscountKopecks).toBe(1_000);
});

test("AC-12: Aggregate coupon rounding on digital lines with free shipping", () => {
  const catalog: Coupon[] = [{ code: "DIGITAL", kind: "percent", value: 10, category: "digital", expiresAt }];
  const basket = order([line(2, "digital"), line(3, "digital")], { coupons: ["DIGITAL"] });

  expect(priceOrder(basket, catalog, nowMs)).toMatchObject({
    couponDiscountKopecks: 1,
    shippingKopecks: 0,
    totalKopecks: 4,
  });
});

test("AC-13: International shipping excluded from discounts", () => {
  const catalog: Coupon[] = [{ code: "SAVE", kind: "percent", value: 10, expiresAt }];
  const basket = order([line(10_000)], { country: "PL", coupons: ["SAVE"] });

  expect(priceOrder(basket, catalog, nowMs)).toMatchObject({
    couponDiscountKopecks: 1_000,
    shippingKopecks: 19_900,
    totalKopecks: 28_900,
  });
});

test("AC-14: Equal coupon amounts in both entry orders with identical public breakdowns", () => {
  const catalog: Coupon[] = [
    { code: "PERCENT", kind: "percent", value: 10, expiresAt },
    { code: "FIXED", kind: "fixed", value: 1_000, expiresAt },
  ];
  const items = [line(10_000)];

  for (const coupons of [["PERCENT", "FIXED"], ["FIXED", "PERCENT"]]) {
    expect(priceOrder(order(items, { coupons }), catalog, nowMs)).toEqual({
      subtotalKopecks: 10_000,
      couponDiscountKopecks: 1_000,
      tierDiscountKopecks: 0,
      shippingKopecks: 4_900,
      totalKopecks: 13_900,
    });
  }
});
