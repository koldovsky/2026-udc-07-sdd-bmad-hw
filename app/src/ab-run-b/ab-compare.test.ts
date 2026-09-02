// Task D evidence — NOT production code.
//
// Pins the measured behavioural differences between:
//   A = app/src/discounts.ts        (built from docs/spec/pricing-discounts.md)
//   B = app/src/ab-run-b/discounts.ts (built from materials/feature-request.md only)
//
// These assertions are the raw data behind the comparison table in
// docs/ab-validation.md. They are written to FAIL if either engine changes, so
// the numbers quoted in that document can never silently go stale.

import { describe, it, expect } from "vitest";
import { priceOrder as priceA } from "../discounts.js";
import { priceOrder as priceB } from "./discounts.js";
import type { Order, LineItem, Coupon } from "../types.js";

const item = (o: Partial<LineItem> = {}): LineItem => ({
  sku: "AA-1",
  name: "T",
  unitPriceKopecks: 100_000,
  quantity: 1,
  category: "standard",
  ...o,
});

const order = (o: Partial<Order> = {}): Order => ({
  id: "o1",
  items: [item()],
  country: "UA",
  customerTier: "none",
  coupons: [],
  ...o,
});

const cp = (o: Partial<Coupon> = {}): Coupon => ({
  code: "CODE",
  kind: "percent",
  value: 10,
  expiresAt: "2030-01-01T00:00:00Z",
  ...o,
});

const NOW = new Date("2026-09-02T12:00:00Z");

/** 60 000 standard + 40 000 fresh, gold customer. */
const mixed = (over: Partial<Order> = {}) =>
  order({
    items: [
      item({ sku: "S", unitPriceKopecks: 60_000, category: "standard" }),
      item({ sku: "F", unitPriceKopecks: 40_000, category: "fresh" }),
    ],
    customerTier: "gold",
    ...over,
  });

const totals = (o: Order, c: Coupon[]) => ({
  a: priceA(o, c, NOW).totalKopecks,
  b: priceB(o, c, NOW).totalKopecks,
});

describe("A/B — where the spec changed the money", () => {
  it("AGREE: sequential stacking, discount base, category share, rounding", () => {
    // The forks the ticket's own commentary points at — B got all of these right.
    expect(
      totals(order({ customerTier: "gold", coupons: ["A15"] }), [cp({ code: "A15", value: 15 })]),
    ).toEqual({ a: 81_400, b: 81_400 });

    expect(totals(mixed({ coupons: ["F20"] }), [cp({ code: "F20", value: 20, category: "fresh" })]))
      .toEqual({ a: 87_700, b: 87_700 });

    expect(
      totals(mixed({ coupons: ["F20", "O10"] }), [
        cp({ code: "F20", value: 20, category: "fresh" }),
        cp({ code: "O10", value: 10 }),
      ]),
    ).toEqual({ a: 79_420, b: 79_420 });

    // Half-kopeck rounding on both the tier and the category base.
    expect(
      totals(
        order({
          items: [
            item({ sku: "S", unitPriceKopecks: 5_000 }),
            item({ sku: "F", unitPriceKopecks: 5_001, category: "fresh" }),
          ],
          customerTier: "silver",
          coupons: ["F10"],
        }),
        [cp({ code: "F10", value: 10, category: "fresh" })],
      ),
    ).toEqual({ a: 13_926, b: 13_926 });
  });

  it("DIFFER #1: two coupons on one category — B stacks them, costing 2 880", () => {
    const t = totals(mixed({ coupons: ["F20", "F10"] }), [
      cp({ code: "F20", value: 20, category: "fresh" }),
      cp({ code: "F10", value: 10, category: "fresh" }),
    ]);
    expect(t).toEqual({ a: 87_700, b: 84_820 });
    expect(t.b - t.a).toBe(-2_880);
  });

  it("DIFFER #2: unbounded stacking — three order-wide coupons cost 39 600 more", () => {
    const catalog = [
      cp({ code: "O10", value: 10 }),
      cp({ code: "O20", value: 20 }),
      cp({ code: "O30", value: 30 }),
    ];
    const t = totals(order({ coupons: ["O10", "O20", "O30"] }), catalog);
    expect(t).toEqual({ a: 94_900, b: 55_300 });
    // B gives away 44% of a 1 000 грн order; A caps the order scope at one coupon.
    expect(t.b - t.a).toBe(-39_600);
  });

  it("DIFFER #3: category base mechanism — proportional scaling vs per-line ledger", () => {
    // Both engines apply BOTH coupons here; the 864 gap is purely the arithmetic.
    // A (D-5): each category's base is scaled by the global remaining/subtotal ratio.
    // B: the tier is allocated down to line items, so a fresh coupon never shrinks
    //    the standard base. B's answer is arguably the better one — see docs/ab-validation.md.
    const t = totals(mixed({ coupons: ["F20", "S20"] }), [
      cp({ code: "F20", value: 20, category: "fresh" }),
      cp({ code: "S20", value: 20, category: "standard" }),
    ]);
    expect(t).toEqual({ a: 77_764, b: 76_900 });
    expect(t.b - t.a).toBe(-864);
  });

  it("DIFFER #4: code matching — B normalises case, A demands an exact match", () => {
    const t = totals(order({ coupons: ["o10"] }), [cp({ code: "O10", value: 10 })]);
    expect(t).toEqual({ a: 104_900, b: 94_900 });
    expect(priceA(order({ coupons: ["o10"] }), [cp({ code: "O10" })], NOW).rejectedCoupons).toEqual([
      { code: "o10", reason: "unknown" },
    ]);
  });

  it("DIFFER #5: malformed expiresAt — same money, different diagnosis", () => {
    const o = order({ coupons: ["BR"] });
    const catalog = [cp({ code: "BR", expiresAt: "not-a-date" })];

    expect(totals(o, catalog)).toEqual({ a: 104_900, b: 104_900 });

    // Invisible in the total, decisive in the metrics: A reports a catalogue data
    // defect, B reports a finished promotion.
    expect(priceA(o, catalog, NOW).rejectedCoupons[0]?.reason).toBe("invalid_value");
    expect(priceB(o, catalog, NOW).rejectedCoupons[0]?.reason).toBe("expired");
  });
});

