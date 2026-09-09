import { describe, it, expect } from "vitest";
import { priceOrder, type PriceBreakdown } from "./discounts.js";
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
  code: "PROMO15",
  kind: "percent",
  value: 15,
  expiresAt: "2027-01-01T00:00:00.000Z",
  ...over,
});

const NOW = new Date("2026-09-07T12:00:00.000Z");

/**
 * Contract invariants from the spec (§5) — asserted on every call below.
 * `uniqueCouponCount` is the number of distinct codes the customer entered:
 * duplicates collapse (D-12), and every remaining code must come back either
 * applied or rejected with a reason.
 */
const expectInvariants = (b: PriceBreakdown, uniqueCouponCount: number): void => {
  expect(b.totalKopecks).toBe(
    b.subtotalKopecks -
      b.tierDiscountKopecks -
      b.couponDiscountKopecks +
      b.shippingKopecks,
  );
  expect(b.tierDiscountKopecks + b.couponDiscountKopecks).toBeLessThanOrEqual(
    b.subtotalKopecks,
  );
  expect(b.totalKopecks).toBeGreaterThanOrEqual(0);
  for (const amount of [
    b.subtotalKopecks,
    b.tierDiscountKopecks,
    b.couponDiscountKopecks,
    b.shippingKopecks,
    b.totalKopecks,
  ]) {
    expect(Number.isInteger(amount)).toBe(true);
  }
  expect(b.appliedCouponCode !== null).toBe(b.couponDiscountKopecks > 0);
  // Жоден введений код не зникає без пояснення: кожен унікальний код або
  // застосовано, або повернено у списку відхилених рівно один раз.
  expect(b.rejectedCoupons.length + (b.appliedCouponCode !== null ? 1 : 0)).toBe(
    uniqueCouponCount,
  );
};

const price = (o: Order, catalogue: Coupon[] = [], now: Date = NOW): PriceBreakdown => {
  const breakdown = priceOrder(o, catalogue, now);
  expectInvariants(breakdown, new Set(o.coupons).size);
  return breakdown;
};

describe("priceOrder", () => {
  it("AC-1: Gold-клієнт без промокодів — доставка не дисконтується", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "gold",
      }),
    );
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(4_900);
    expect(b.totalKopecks).toBe(94_900);
  });

  it("AC-2: Silver і промокод 15% застосовуються послідовно, а не складанням", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        customerTier: "silver",
        coupons: ["PROMO15"],
      }),
      [coupon()],
    );
    expect(b.tierDiscountKopecks).toBe(5_000);
    expect(b.couponDiscountKopecks).toBe(14_250); // 15% від залишку 95 000
    expect(b.totalKopecks).toBe(85_650); // не 84 900, як дало б 5% + 15%
  });

  it("AC-3: два промокоди на одну категорію — застосовується найвигідніший", () => {
    const b = price(
      order({
        items: [
          item({ unitPriceKopecks: 60_000, category: "fresh" }),
          item({ sku: "BB-2", unitPriceKopecks: 40_000 }),
        ],
        coupons: ["FRESH10", "FRESH50"],
      }),
      [
        coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
        coupon({ code: "FRESH50", kind: "fixed", value: 5_000, category: "fresh" }),
      ],
    );
    expect(b.appliedCouponCode).toBe("FRESH10");
    expect(b.couponDiscountKopecks).toBe(6_000);
    expect(b.rejectedCoupons).toEqual([{ code: "FRESH50", reason: "not_best" }]);
    expect(b.totalKopecks).toBe(98_900);
  });

  it("AC-3: однакова знижка — перемагає введений першим промокод", () => {
    const items = [
      item({ unitPriceKopecks: 60_000, category: "fresh" }),
      item({ sku: "BB-2", unitPriceKopecks: 40_000 }),
    ];
    const catalogue = [
      coupon({ code: "FRESH10", kind: "percent", value: 10, category: "fresh" }),
      coupon({ code: "FRESH6K", kind: "fixed", value: 6_000, category: "fresh" }),
    ];
    // Обидва дають рівно 6 000 копійок — вирішує лише порядок введення.
    const first = price(order({ items, coupons: ["FRESH10", "FRESH6K"] }), catalogue);
    expect(first.appliedCouponCode).toBe("FRESH10");
    expect(first.couponDiscountKopecks).toBe(6_000);
    expect(first.rejectedCoupons).toEqual([{ code: "FRESH6K", reason: "not_best" }]);

    const reversed = price(order({ items, coupons: ["FRESH6K", "FRESH10"] }), catalogue);
    expect(reversed.appliedCouponCode).toBe("FRESH6K");
    expect(reversed.couponDiscountKopecks).toBe(6_000);
    expect(reversed.rejectedCoupons).toEqual([{ code: "FRESH10", reason: "not_best" }]);
    // Підсумок від порядку не залежить — різниться лише те, який код виграв.
    expect(reversed.totalKopecks).toBe(first.totalKopecks);
  });

  it("AC-4: знижка перевищує суму товарів — підсумок не відʼємний, доставка сплачується", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 10_000 })],
        coupons: ["SUPER"],
      }),
      [coupon({ code: "SUPER", kind: "fixed", value: 20_000 })],
    );
    expect(b.couponDiscountKopecks).toBe(10_000); // обмежено сумою товарів
    expect(b.totalKopecks).toBe(4_900); // сама доставка
  });

  it("AC-5: прострочений промокод не спрацьовує і не ламає розрахунок", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["OLD15"],
      }),
      [coupon({ code: "OLD15", expiresAt: "2026-09-01T00:00:00.000Z" })],
    );
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.appliedCouponCode).toBeNull();
    expect(b.rejectedCoupons).toEqual([{ code: "OLD15", reason: "expired" }]);
    expect(b.totalKopecks).toBe(104_900);
  });

  it("AC-6: межа терміну дії — дійсний строго до expiresAt", () => {
    const o = order({
      items: [item({ unitPriceKopecks: 100_000 })],
      coupons: ["EXP"],
    });
    const catalogue = [coupon({ code: "EXP", expiresAt: "2026-10-01T00:00:00.000Z" })];

    const justBefore = price(o, catalogue, new Date("2026-09-30T23:59:59.999Z"));
    expect(justBefore.appliedCouponCode).toBe("EXP");
    expect(justBefore.totalKopecks).toBe(89_900);

    const exactly = price(o, catalogue, new Date("2026-10-01T00:00:00.000Z"));
    expect(exactly.rejectedCoupons).toEqual([{ code: "EXP", reason: "expired" }]);
    expect(exactly.totalKopecks).toBe(104_900);
  });

  it("AC-7: мінімальна сума перевіряється до знижок — сума рівно на порозі проходить", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 50_000 })],
        customerTier: "gold",
        coupons: ["MIN500"],
      }),
      [coupon({ code: "MIN500", value: 10, minSubtotalKopecks: 50_000 })],
    );
    // Поріг звіряється з 50 000, а не з 45 000, що лишились після знижки за рівнем.
    expect(b.tierDiscountKopecks).toBe(5_000);
    expect(b.couponDiscountKopecks).toBe(4_500);
    expect(b.totalKopecks).toBe(45_400);
  });

  it("AC-8: сума нижча за поріг — промокод відхилено", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 49_999 })],
        coupons: ["MIN500"],
      }),
      [coupon({ code: "MIN500", value: 10, minSubtotalKopecks: 50_000 })],
    );
    expect(b.rejectedCoupons).toEqual([
      { code: "MIN500", reason: "min_subtotal_not_met" },
    ]);
    expect(b.totalKopecks).toBe(54_899);
  });

  it("AC-9: пів копійки округлюється вгору", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 1_010, category: "digital" })],
        customerTier: "silver",
      }),
    );
    expect(b.tierDiscountKopecks).toBe(51); // 5% від 1 010 = 50,5 → 51
    expect(b.shippingKopecks).toBe(0);
    expect(b.totalKopecks).toBe(959); // не 960
  });

  it("AC-10: порожнє замовлення — усе нульове, без винятку", () => {
    const b = price(
      order({ items: [], customerTier: "gold", coupons: ["PROMO15"] }),
      [coupon()],
    );
    expect(b.subtotalKopecks).toBe(0);
    expect(b.tierDiscountKopecks).toBe(0);
    expect(b.couponDiscountKopecks).toBe(0);
    expect(b.shippingKopecks).toBe(0);
    expect(b.totalKopecks).toBe(0);
  });

  it("AC-11: категорійний промокод рахується від суми своєї категорії", () => {
    const b = price(
      order({
        items: [
          item({ unitPriceKopecks: 30_000, category: "digital" }),
          item({ sku: "BB-2", unitPriceKopecks: 70_000 }),
        ],
        coupons: ["DIGI20"],
      }),
      [coupon({ code: "DIGI20", value: 20, category: "digital" })],
    );
    expect(b.couponDiscountKopecks).toBe(6_000); // 20% від 30 000, не від 100 000
    expect(b.totalKopecks).toBe(98_900);
  });

  it("AC-12: категорії немає в замовленні — промокод відхилено", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["FRESH10"],
      }),
      [coupon({ code: "FRESH10", value: 10, category: "fresh" })],
    );
    expect(b.appliedCouponCode).toBeNull();
    expect(b.rejectedCoupons).toEqual([
      { code: "FRESH10", reason: "category_absent" },
    ]);
    expect(b.totalKopecks).toBe(104_900);
  });

  it("AC-13: невідомий код повертається з причиною, а не винятком", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["NOPE"],
      }),
      [coupon()],
    );
    expect(b.rejectedCoupons).toEqual([{ code: "NOPE", reason: "unknown" }]);
    expect(b.totalKopecks).toBe(104_900);
  });

  it("AC-14: база категорійного промокоду — сума категорії після знижки за рівнем", () => {
    const b = price(
      order({
        items: [
          item({ unitPriceKopecks: 60_000, category: "fresh" }),
          item({ sku: "BB-2", unitPriceKopecks: 40_000 }),
        ],
        customerTier: "gold",
        coupons: ["FRESH10"],
      }),
      [coupon({ code: "FRESH10", value: 10, category: "fresh" })],
    );
    expect(b.tierDiscountKopecks).toBe(10_000);
    expect(b.couponDiscountKopecks).toBe(5_400); // 10% від (60 000 − 6 000)
    expect(b.totalKopecks).toBe(89_500); // не 89 400
  });

  it("AC-15: той самий код двічі — знижка нараховується один раз", () => {
    const b = price(
      order({
        items: [item({ unitPriceKopecks: 100_000 })],
        coupons: ["PROMO15", "PROMO15"],
      }),
      [coupon()],
    );
    expect(b.couponDiscountKopecks).toBe(15_000);
    expect(b.rejectedCoupons).toEqual([]);
    expect(b.totalKopecks).toBe(89_900);
  });

  it("AC-16: придатний промокод із нульовою знижкою не вважається застосованим", () => {
    const b = price(
      order({
        items: [
          item({ unitPriceKopecks: 10, category: "fresh" }),
          item({ sku: "BB-2", unitPriceKopecks: 100_000 }),
        ],
        coupons: ["TINY1"],
      }),
      [coupon({ code: "TINY1", value: 1, category: "fresh" })],
    );
    expect(b.appliedCouponCode).toBeNull();
    expect(b.rejectedCoupons).toEqual([{ code: "TINY1", reason: "no_effect" }]);
    expect(b.totalKopecks).toBe(104_910);
  });
});

describe("Інваріанти розкладки (контракт §5)", () => {
  // Ширша перевірка, ніж окремі AC: інваріанти мають триматись на будь-якій
  // комбінації рівня, виду купона й категорії, а не лише на сценаріях AC.
  const tiers: Order["customerTier"][] = ["none", "silver", "gold"];
  const categories: LineItem["category"][] = ["standard", "fresh", "digital"];
  const kinds: Coupon["kind"][] = ["percent", "fixed"];

  it("тримаються на всіх комбінаціях рівня, категорії та виду купона", () => {
    let checked = 0;
    for (const customerTier of tiers) {
      for (const category of categories) {
        for (const kind of kinds) {
          for (const unitPriceKopecks of [0, 1, 1_010, 99_999]) {
            const c = coupon({
              code: "X",
              kind,
              value: kind === "percent" ? 100 : 1_000_000,
              category,
            });
            const coupons = ["X", "X", "MISSING"];
            expectInvariants(
              priceOrder(
                order({
                  items: [item({ unitPriceKopecks, category })],
                  customerTier,
                  coupons,
                }),
                [c],
                NOW,
              ),
              new Set(coupons).size,
            );
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(72);
  });
});
