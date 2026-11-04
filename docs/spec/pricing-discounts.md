# Specification: Checkout Discounts

**Status:** Draft  
**Source:** [Feature request](../../materials/feature-request.md)  
**Decision author:** Codex

## 1. Goal

Customers can combine their earned loyalty discount with the best eligible coupon they enter. Checkout returns an itemized price that can be reproduced from the same order, coupon catalog, and evaluation time.

## 2. Out of Scope

Coupon creation, code normalization at entry, usage tracking, taxes, refunds, per-line discount allocation, and checkout UI are out of scope. The seeded order types and pricing helpers remain unchanged.

## 3. Decisions

| ID | Question | Decision | Why |
|---|---|---|---|
| D-1 | How do loyalty and coupons combine? | Apply the winning coupon first, then apply `tierPercent(order)` to the remaining merchandise subtotal: none 0%, Silver 5%, Gold 10%. | Both benefits can apply without adding headline rates or allocating loyalty discounts across categories. |
| D-2 | Is shipping discountable? | Exclude shipping from all discount bases and eligibility checks; add unchanged `shippingKopecks(order)` at the end. | Merchandise promotions do not subsidize delivery. |
| D-3 | What if several codes are entered? | Evaluate each entered code independently against the original merchandise amounts, even if the codes target the same category. Apply only the greatest capped, rounded coupon discount; if tied, use the earliest entered code. With no positive candidate, apply zero. | Customers get the best single coupon without compounding campaign costs; ties are deterministic. |
| D-4 | When and how are percentages rounded? | Round once per percentage candidate on its aggregate base and once for loyalty on its remaining subtotal. Round to the nearest kopeck, with exact halves rounded up. For nonnegative whole base `b` and whole rate `p`, use the integer quotient of `(b * p + 50) / 100`, with exact intermediates. | Splitting an item across lines cannot change the discount; halves have a reproducible result. |
| D-5 | What is the category coupon base? | Sum original line totals for exactly the specified category; without a category, use the original merchandise subtotal. A zero base yields zero for either coupon kind. | A category offer never discounts unrelated merchandise. |
| D-6 | What does the minimum subtotal measure? | Compare the original whole-order merchandise subtotal to `minSubtotalKopecks`; equality qualifies. No minimum applies when the field is omitted. Category scope affects the discount base, not this test. | The advertised spend threshold does not change with other discounts or the basket's category mix. |
| D-7 | Can a discount exceed the amount due? | A fixed coupon requests its face value in kopecks once, not per unit or line. Cap each candidate at its own eligible base before comparing it with other candidates. Loyalty cannot exceed the remaining subtotal. No unused discount becomes credit. | An offer cannot turn a category or order into a payout. |
| D-8 | When does a coupon expire, and what happens then? | Interpret `expiresAt` as an instant and accept it only when `nowMs < expiresAt` (after conversion to epoch milliseconds). Ignore expired coupons without throwing or returning a rejection reason. | The seeded contract makes the cutoff exclusive; a rejected code must not block the quote. |
| D-9 | How are codes matched? | Match entered codes exactly and case-sensitively; ignore unknown codes. Repeated entries cannot increase the discount because only one candidate wins. | This layer uses catalog identity without changing what the customer entered. |
| D-10 | What happens with an empty basket? | Return zero for every amount: no merchandise base, and the existing shipping helper returns zero. | An empty order incurs no charge and needs no shipping override. |

## 4. Acceptance Criteria

All money values below are in kopecks. Unless stated otherwise, use a UA order with tier `none`, one quantity-1 `standard` line priced at the stated subtotal, and no entered codes. Listed coupons are both in the catalog and entered in the listed order unless stated otherwise. Use `nowMs = Date.parse("2026-10-01T12:00:00Z")`; coupons expire at `2026-10-02T12:00:00Z` unless stated otherwise.

- **AC-1:** WHEN a Gold customer orders merchandise worth 100,000 without coupons, THEN the loyalty discount is 10,000, the coupon discount is 0, and the total is 94,900.
- **AC-2:** WHEN a 1,000 fixed coupon is evaluated on a subtotal of 10,000 one millisecond before, exactly at, or one millisecond after expiration, THEN the coupon discounts are 1,000, 0, and 0 respectively, with no error.
- **AC-3:** WHEN a basket has 10,000 in fresh goods and 10,000 in standard goods and two fresh coupons offer 10% and 15%, THEN the coupon discount is 1,500 in either entry order and the total is 23,400.
- **AC-4 (boundary):** WHEN a Gold customer enters a fixed coupon worth 20,000 on a subtotal of 10,000, THEN the coupon discount is 10,000, the loyalty discount is 0, and the total is 4,900.
- **AC-5:** WHEN a Silver customer enters a 10% coupon on a subtotal of 10,000, THEN the coupon discount is 1,000, the loyalty discount is 450, and the total is 13,450.
- **AC-6 (boundary):** WHEN a Gold customer buys two standard lines worth 2 and 3 with no coupons, THEN the aggregate loyalty discount rounds from exactly half a kopeck to 1 and the total is 4,904.
- **AC-7 (boundary):** WHEN a Gold customer's basket is empty and an entered fixed coupon offers 1,000, THEN subtotal, coupon discount, loyalty discount, shipping, and total are all 0.
- **AC-8 (boundary):** WHEN a Gold customer has 4,000 in fresh goods and 6,000 in standard goods and enters a 10% fresh coupon with a minimum of 10,000, THEN the coupon discount is 400; reducing the standard line to 5,999 makes the coupon discount 0.
- **AC-9:** WHEN a basket has 1,000 in fresh goods and 9,000 in standard goods and the candidates are a fresh fixed coupon worth 5,000 and an unrestricted fixed coupon worth 1,200, THEN the coupon discount is 1,200.
- **AC-10:** WHEN a basket contains only 10,000 in standard goods and the entered coupon is a fixed fresh coupon worth 1,000, THEN the coupon discount is 0 and the total is 14,900.
- **AC-11:** WHEN a basket subtotal is 10,000 and codes `save`, `MISSING`, `SAVE`, and `SAVE` are entered against a catalog containing only `SAVE` worth 1,000, THEN the first two codes alone yield a coupon discount of 0 and all four together yield 1,000.
- **AC-12:** WHEN a basket contains two digital lines worth 2 and 3 and the only coupon offers 10% off digital goods, THEN the coupon discount is 1, shipping is 0, and the total is 4.
- **AC-13:** WHEN a physical order of 10,000 ships outside UA with a 10% coupon, THEN the coupon discount is 1,000, shipping is 19,900, and the total is 28,900.
- **AC-14:** WHEN a basket subtotal is 10,000 and a 10% coupon ties a fixed coupon worth 1,000, THEN either entry order returns the same breakdown, including a coupon discount of 1,000 and a total of 13,900; winning code identity is not exposed.

## 5. Contract

New public API in `app/src/discounts.ts`:

```ts
import type { Coupon, Order } from "./types.js";

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  shippingKopecks: number;
  totalKopecks: number;
}

export function priceOrder(
  order: Order,
  coupons: readonly Coupon[],
  nowMs: number,
): PriceBreakdown;
```

- The caller supplies a valid epoch-millisecond timestamp and a catalog with unique codes and valid ISO timestamps with explicit UTC offsets (`Z` is allowed).
- Prices, quantities, fixed values, and minimums are nonnegative safe integers; percentage rates are whole numbers from 0 through 100 inclusive. Undiscounted subtotal plus shipping must fit in a safe integer. Invalid input handling is outside this contract.
- The function does not mutate inputs or read the system clock. Use the existing line total, subtotal, shipping, and tier helpers unchanged.
- Return the original merchandise subtotal, the actual amounts deducted for the coupon and loyalty, the unchanged shipping fee, and `totalKopecks = subtotalKopecks - couponDiscountKopecks - tierDiscountKopecks + shippingKopecks`.

## 6. Verification

In Task C, run `cd app && npm test` and verify the seeded pricing tests still pass and every AC ID appears in a passing test. Check the exact integer outputs in each case.
