# Specification: loyalty and coupon discounts

**Status:** agreed
**Source:** `materials/feature-request.md`

## 1. Goal

Calculate an order price that applies loyalty and eligible coupon discounts in a
predictable order. All monetary results use integer kopecks, and every entered
coupon has an applied or rejected result.

## 2. Out of scope

Campaign scheduling, coupon redemption tracking, persistence, UI/API integration,
currency conversion, and validation unrelated to discount calculation are out of
scope.

The existing `Order`, `LineItem`, and `Coupon` shapes and the behavior and signatures
in `app/src/pricing.ts` remain unchanged.

## 3. Decisions

| Ambiguity | Decision | Rationale |
|---|---|---|
| Discount base | Discounts apply only to merchandise. Shipping is never discounted. Loyalty applies to every merchandise category. | Keeps the existing shipping rules independent from discounts. |
| Stacking | Apply discounts sequentially to the remaining eligible merchandise value. | Gives one predictable result when discounts are combined. |
| Application order | Apply loyalty first, then coupons in the customer's input order. Do not optimize or reorder coupons. | `Order.coupons` already preserves the customer's chosen order. |
| Multiple coupons | Apply every eligible coupon. There is no maximum count, and overlapping coupons may affect the same items or category. | Supports the requested use of multiple promo codes. |
| Repeated codes | Normalize codes by trimming surrounding whitespace and comparing case-insensitively. Apply a normalized code at most once; reject later occurrences as `duplicate`. Blank and unknown codes are invalid. | Formatting must not allow the same coupon to be applied repeatedly. |
| Coupon definitions | The caller supplies `Coupon[]`; no external lookup service is used. Only entered codes are evaluated. If multiple definitions have the same normalized code, reject that entered code as `invalid_or_unknown`. | Fits the existing repository types and avoids choosing an arbitrary conflicting definition. |
| Minimum subtotal | Compare `minSubtotalKopecks` inclusively with the original merchandise subtotal before any discounts. Do not re-evaluate it later. | Eligibility does not change as earlier discounts are applied. |
| Category coupons | A category coupon applies only to the remaining value of matching items. A fixed category coupon applies once across that category, not once per line or unit. | Prevents discounts from affecting unrelated merchandise or multiplying with quantity. |
| Shared discount allocation | An order-wide discount reduces the remaining values of categories proportionally. If whole-kopeck allocation leaves a remainder, assign it deterministically to eligible lines in input order. | Later category coupons need a deterministic remaining category value. |
| Rounding | Calculate each percentage discount on its complete eligible amount, then round that discount once to the nearest kopeck; exact halves round up. | Prevents per-line rounding drift and defines half-kopeck behavior. |
| Discount floor | Cap each discount at its remaining eligible value. Merchandise and category balances cannot become negative, and excess from a category coupon does not spill into other categories. | A discount cannot create credit or discount ineligible goods. |
| Coupon rejection | Invalid/unknown, expired, below-minimum, non-matching-category, and duplicate coupons are skipped without failing pricing. Return one structured reason using that priority. An eligible discount that rounds to zero is applied with zero savings. | Pricing can continue while explaining why an entered coupon did not save money. |
| Expiry | Evaluate every coupon against one explicit current timestamp supplied to pricing. A coupon is expired when that timestamp is at or after `expiresAt`; malformed expiry is `invalid_or_unknown`. | Makes the expiry boundary deterministic and testable. |
| Empty orders and side effects | An empty order returns a valid zero-value result. Pricing is pure: it does not mutate inputs or consume coupons. | Supports a required boundary case and repeatable calculation. |
| Feature boundary | This iteration calculates discounts only. | Avoids adding campaign, storage, and checkout concerns. |

Coupon definitions and other numeric inputs follow the existing domain contract:
percentage values are whole numbers from 0 through 100, while fixed values and
minimums are nonnegative integer kopecks. Behavior for inputs outside that contract
is outside this specification.

## 4. Deterministic calculation sequence

1. Compute the original merchandise subtotal. Keep enough remaining merchandise
   value by category to evaluate later category coupons.
2. Apply the loyalty percentage from `tierPercent` to all remaining merchandise.
3. Evaluate entered coupon codes in input order. Determine eligibility from the
   original subtotal and original category presence; rejected coupons save zero and
   do not change remaining values.
4. Apply each eligible coupon to its remaining eligible merchandise. Percentage
   coupons use the rounding rule above; fixed coupons are capped at that balance.
   Order-wide discounts reduce category balances proportionally, with allocation
   remainders assigned to eligible lines in input order.
5. Return the breakdown, where:

   `totalKopecks = subtotalKopecks - tierDiscountKopecks - couponDiscountKopecks + shippingKopecks`

Shipping comes from the existing `shippingKopecks(order)` behavior and is added only
after merchandise discounts.

## 5. Acceptance criteria

All amounts below are kopecks. Unless stated otherwise, the order is for `UA`, its
customer tier is `none`, coupon expiry is `2026-10-01T00:00:00.000Z`, and pricing is
evaluated at `2026-09-07T12:00:00.000Z`.

- **AC-1: Loyalty excludes shipping.** WHEN a Gold customer orders standard
  merchandise totaling 100,000 with no coupons, THEN the tier discount is 10,000,
  shipping is 4,900, and the final total is 94,900.

- **AC-2: Loyalty and coupon stack sequentially.** WHEN a Gold customer orders
  merchandise totaling 100,000 and enters a 15% coupon, THEN loyalty saves 10,000,
  the coupon saves 13,500 from the remaining 90,000, and the final total including
  4,900 shipping is 81,400.

- **AC-3: Overlapping coupons follow input order.** WHEN fresh merchandise totals
  10,000, standard merchandise totals 10,000, and the customer enters a fresh fixed
  coupon for 1,000 followed by a fresh 20% coupon, THEN both apply in that order,
  their discounts are 1,000 and 1,800, and the final total including shipping is
  22,100.

- **AC-4: A normalized code applies once.** WHEN merchandise totals 10,000, a 10%
  coupon has code `SAVE`, and the customer enters ` save ` followed by `Save`, THEN
  the first coupon applies for 1,000, the second is rejected as `duplicate`, and the
  final total including shipping is 13,900.

- **AC-5: Minimum uses the original subtotal.** WHEN a Gold customer orders
  merchandise totaling exactly 10,000 and enters a 10% coupon with
  `minSubtotalKopecks: 10_000`, THEN the minimum is met before loyalty, loyalty saves
  1,000, the coupon saves 900 from the remaining value, and the final total including
  shipping is 13,000.

- **AC-6: A category coupon uses its remaining category balance.** WHEN a Silver
  customer has fresh merchandise totaling 6,000 and standard merchandise totaling
  4,000, and enters a fresh 10% coupon, THEN loyalty saves 500 and proportionally
  leaves 5,700 of fresh merchandise; the coupon saves 570 and the final total
  including shipping is 13,830.

- **AC-7: A fixed category coupon is capped and does not spill.** WHEN fresh
  merchandise totals 3,000, standard merchandise totals 7,000, and a fresh fixed
  coupon for 5,000 is entered, THEN it applies once, saves 3,000, leaves the standard
  merchandise unchanged, and the final total including shipping is 11,900.

- **AC-8: Exact halves round up once per percentage operation.** WHEN merchandise
  totals 15 and a 10% coupon is entered, THEN the coupon discount of 1.5 rounds to
  2 kopecks and the final total including shipping is 4,913.

- **AC-9: The expiry instant is excluded.** WHEN merchandise totals 10,000, a 10%
  coupon expires at `2026-09-07T12:00:00.000Z`, and pricing is evaluated at exactly
  that timestamp, THEN the coupon is rejected as `expired`, saves zero, and the final
  total including shipping is 14,900.

- **AC-10: Rejected coupons do not stop valid coupons.** WHEN merchandise totals
  10,000 and the customer enters an unknown code followed by a valid 10% coupon,
  THEN the first result is rejected as `invalid_or_unknown`, the second coupon
  applies for 1,000, and the final total including shipping is 13,900.

- **AC-11: A missing category is a structured rejection.** WHEN the order contains
  only standard merchandise totaling 10,000 and the customer enters a fresh 10%
  coupon, THEN the coupon is rejected as `no_matching_category`, saves zero, and the
  final total including shipping is 14,900.

- **AC-12: Empty orders stay at zero.** WHEN an order has no items and no coupons,
  THEN subtotal, tier discount, coupon discount, shipping, and final total are all
  zero.

- **AC-13: Conflicting coupon definitions are invalid.** WHEN merchandise totals
  10,000, the supplied coupons contain `SAVE` at 10% and ` save ` as a fixed 500
  coupon, and the customer enters `SAVE`, THEN it is rejected as
  `invalid_or_unknown`, saves zero, and the final total including shipping is 14,900.

- **AC-14: A malformed expiry is invalid.** WHEN merchandise totals 10,000 and a
  10% `SAVE` coupon has `expiresAt: "not-a-date"`, THEN it is rejected as
  `invalid_or_unknown`, saves zero, and the final total including shipping is 14,900.

- **AC-15: A zero-saving coupon is applied.** WHEN merchandise totals 1 and a 10%
  coupon is entered, THEN its discount rounds to zero, its result is `applied`, and
  the final total including shipping is 4,901.

- **AC-16: Below-minimum coupons are rejected.** WHEN merchandise totals 9,999 and
  a 10% coupon requires `minSubtotalKopecks: 10_000`, THEN it is rejected as
  `minimum_not_met`, saves zero, and the final total including shipping is 14,899.

AC-7, AC-8, AC-9, AC-12, AC-15, and AC-16 are boundary cases.

## 6. Public contract

```ts
import type { Order, Coupon } from "./types.js";

export type CouponRejectionReason =
  | "invalid_or_unknown"
  | "expired"
  | "minimum_not_met"
  | "no_matching_category"
  | "duplicate";

export type CouponResult =
  | { code: string; status: "applied"; discountKopecks: number }
  | {
      code: string;
      status: "rejected";
      discountKopecks: 0;
      reason: CouponRejectionReason;
    };

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  couponResults: CouponResult[];
  shippingKopecks: number;
  totalKopecks: number;
}

export function priceOrder(
  order: Order,
  coupons: Coupon[],
  now: Date,
): PriceBreakdown;
```

`couponResults` contains one result per entered code in customer input order. The
`code` is the normalized code. `now` is required; the calculation does not read the
system clock. Coupon rejection is returned in the breakdown and does not throw.

## 7. Verification

During Task C, name tests after the relevant AC IDs and run:

```sh
cd app
npm test
npm run typecheck
```

The existing pricing tests must remain green. Each acceptance criterion must map to
a test without requiring an unstated business decision.
