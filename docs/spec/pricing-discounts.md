# Specification: order discounts (loyalty tiers + promo codes)

**Status:** agreed
**Source:** `materials/feature-request.md`
**Decision author:** Igor Rakhmanov

> Money is whole **kopecks** everywhere in code (1 грн = 100 копійок, so
> 1 000 грн = 100_000 kopecks) and is shown to people in **hryvnia**. Every
> number below is kopecks unless it says грн.

---

## 1. Goal

Loyalty tiers stop being decoration and actually reduce what a customer pays,
and promo codes work on top of them. After this ships, a checkout total can be
explained line by line — subtotal, tier discount, each accepted code with its
own amount, shipping — and reproduced to the kopeck by anyone with the same
order. A code that does nothing always carries a nameable reason why, instead
of failing silently.

## 2. Out of scope

Deliberately **not** in this iteration. Anything here that shows up in the code
is unrequested behaviour:

- **Coupon-code normalization** — no trimming, no case folding, no aliasing.
- **Catalog validation** — a coupon with `value: 150` for `kind: "percent"`, a
  negative or non-integer `value`, or an unparseable `expiresAt` is treated as
  given. The catalog is trusted input; the clamps in D-7/D-12 keep the total
  sane regardless.
- **Free-shipping coupons, BOGO, gift cards, tier-restricted coupons.**
- **Usage limits** — per customer, per code, per campaign.
- **A ceiling on total discount percentage** (considered and rejected: the
  ticket gave no number and inventing one would be a business decision).
- **Tax, currencies other than UAH, persistence, API layer, UI wording or
  i18n of rejection reasons.**
- **Any change to `shippingKopecks` or `tierPercent`** — seeded contract.

## 3. Decisions on the ambiguities

D-1…D-8 answer the forks the ticket itself listed. D-9…D-19 are the ones the
ticket did not list.

| # | Question | Decision | Why this way |
|---|---|---|---|
| D-1 | Tier + coupon: percentages added, or applied in sequence? | **Sequential.** Tier first against the item subtotal, then coupons against the amount that remains. | On 1 000 грн with gold + a 15% code, sequential takes 235 грн, additive takes 250 грн. Sequential can never exceed the sum of the parts, so margin is bounded no matter how many codes exist; and it matches the mental model where the tier is a standing benefit and the code is a top-up on what's left. |
| D-2 | Discount base: items only, or items + shipping? | **Items only** (`subtotalKopecks`). Shipping is added after every discount and is never reduced. | Shipping is a cost pass-through with its own already-specified waiver rule (`shippingKopecks` is protected). Letting a product discount eat it would silently change that function's economics. |
| D-3 | Several coupons: all / the best one / the first? | **All valid ones apply**, in the order the customer typed them, each against the amount remaining at its turn — with **at most one coupon per scope**. A later coupon aimed at an already-discounted scope is rejected `duplicate-scope`. Scopes: `order` (no `category`) and one per `category`. | The ticket says the customer may enter several codes and should feel the benefit of them, so "best one only" contradicts it. One-per-scope stops two 15% fresh codes from compounding into 27.75% off one category — a promotion nobody signed off on — while still letting a category code and an order-wide code stack. |
| D-4 | Rounding: where, and which direction? | Each percentage discount is rounded to whole kopecks **at the moment it is computed**, **half away from zero** (0.5 → up). Computed with integers only: `floor((base × percent + 50) / 100)`. Nothing else rounds — every other operation is integer. | Rounding once per discount keeps the breakdown internally consistent: the components sum to the total exactly, so there is no residue to hide. Half-up resolves the half-kopeck tie in the customer's favour, which is the version support can defend without a spreadsheet. The integer formula keeps floats out of money entirely. |
| D-5 | A category coupon's percent: of that category, or of the whole order? | **Of that category's items only.** | "15% off fresh" means 15% of the fresh items. Charging it against the whole order is a different, much larger promotion. |
| D-5a | …and what is that category base after the tier discount? | `categorySubtotal − floor((categorySubtotal × tierPercent + 50) / 100)`, computed **independently per category** — *not* an allocation of the reported `tierDiscountKopecks`. | Splitting one already-rounded amount across categories needs an arbitrary allocation order and leaks a kopeck into whichever category goes last. Per-category figures are only used as bases and caps, never reported as amounts, so a ≤1 kopeck divergence from `tierDiscountKopecks` can never reach the customer or break the D-19 invariant. |
| D-6 | `minSubtotalKopecks`: checked before or after other discounts? | **Before** — against the gross item subtotal, with **`>=`** (inclusive). | It is the threshold printed in the promo terms ("від 500 грн"), and that's the number the customer sees in the cart. Checking it post-discount would make one code's eligibility depend on which other codes were typed first. |
| D-7 | Can the total go negative? Is there a floor? | **No.** The item amount floors at 0; shipping is still charged. `total = max(0, subtotal − tier − coupons) + shipping`. | We never pay a customer to order, and shipping is real money already spent — a product discount shouldn't cover it. |
| D-8 | Expired coupon: silent skip or explicit error? | **Explicit but non-fatal.** `priceOrder` never throws; the code lands in `rejectedCoupons` as `{ code, reason: "expired" }`. | Checkout must keep pricing the order *and* be able to tell the customer which code failed and why. A thrown error would blank the price over one stale code. |
| D-9 | A code was typed that is not in the catalog. | Rejected `unknown`. | The ticket never mentions it. Ignoring it silently makes a typo indistinguishable from a working code. |
| D-10 | Code matching: exact, or trimmed / case-folded? | **Exact and case-sensitive.** `"save10" ≠ "SAVE10"`. | Normalization belongs to the input layer that collects the codes; inventing it here is behaviour nobody asked for. Stated so the implementation doesn't add it "helpfully". |
| D-11 | Where does "now" come from for expiry? | An explicit **`now: Date` parameter**. A coupon is invalid when `now >= expiresAt` — not valid *on or after* that instant, as `types.ts` states. | A hidden `Date.now()` makes the function impure and its expiry tests unrepeatable. The boundary direction comes from the seeded type, not from taste. |
| D-12 | A fixed coupon larger than its base. | **Clamped to its base**, and the clamped figure is what `appliedCoupons` reports. | The receipt must show the discount actually given, not the coupon's face value. |
| D-13 | Order of application when several apply. | **`order.coupons` order** — what the customer typed. `types.ts` already guarantees the array is in typing order. | The only ordering the domain carries. Any re-sort (by value, by scope) would be an invented rule, and with D-1 the order changes the result. |
| D-14 | The same code entered twice. | First occurrence applies; every later occurrence is rejected `duplicate-code`. | A distinct reason from `duplicate-scope` lets support tell a double-paste apart from two genuinely conflicting codes. |
| D-15 | A coupon whose base is 0 — empty order, or its category absent from the order. | Rejected `no-eligible-items`. | An "applied" discount of 0 грн reads as success in the UI while nothing happened. |
| D-16 | Does the tier discount exclude any category? | **No** — it applies to the whole item subtotal, `digital` and `fresh` included. | The ticket named no exclusions. Adding one is exactly the unrequested behaviour the reverse traceability check hunts for. |
| D-17 | Is `priceOrder` pure? | **Yes** — no mutation of `order` or the catalog, no I/O, no clock, no logging. | Makes every acceptance criterion a plain input → output test. |
| D-18 | Report one coupon total, or per coupon? | **Both**: `couponDiscountKopecks` as the sum, plus `appliedCoupons: { code, discountKopecks }[]`. | Checkout shows "SAVE100 −100 грн" per line; the sum keeps the D-19 invariant checkable in one assertion. |
| D-19 | What exactly does "kopecks must not drift" mean? | A stated invariant, asserted in tests: `subtotal − tierDiscount − couponDiscount + shipping === total`; `total >= shipping`; and every entry of `order.coupons` appears **exactly once** across `appliedCoupons` + `rejectedCoupons`, in typed order. | Turns the ticket's point 6 from a hope into something a test fails on. The third clause is what catches a coupon being quietly dropped rather than rejected. |

> Note on the empty order: `shippingKopecks` returns 0 for `items: []`, because
> "every item is digital" is vacuously true for an empty list. That is existing,
> protected behaviour — this spec inherits it rather than working around it
> (see AC-12).

### Algorithm (the sequence D-1/D-3/D-5a only pin down once written out)

1. `subtotal = subtotalKopecks(order)`; `shipping = shippingKopecks(order)`.
2. `tierDiscount = floor((subtotal × tierPercent(order) + 50) / 100)` (D-4, D-16).
3. `remaining = subtotal − tierDiscount`.
4. Per category present in the order, `categoryBase[c] = categorySubtotal(c) − floor((categorySubtotal(c) × tierPercent(order) + 50) / 100)` (D-5a).
5. For each code in `order.coupons`, in order (D-13):
   1. seen already → reject `duplicate-code` (D-14);
   2. not in catalog → reject `unknown` (D-9, exact match per D-10);
   3. `now >= expiresAt` → reject `expired` (D-8, D-11);
   4. `minSubtotalKopecks` set and `subtotal < minSubtotalKopecks` → reject `below-min-subtotal` (D-6);
   5. its scope already used → reject `duplicate-scope` (D-3);
   6. `base` = `categoryBase[coupon.category]` if scoped, else `remaining`; `base` is 0 or the category is absent → reject `no-eligible-items` (D-15);
   7. `d = floor((base × value + 50) / 100)` for percent, `min(value, base)` for fixed (D-12); then `d = min(d, remaining)` (D-7);
   8. accept: subtract `d` from `remaining` and from `categoryBase[coupon.category]` if scoped; mark the scope used; record `{ code, discountKopecks: d }`.
6. `couponDiscount = sum of accepted d`; `total = max(0, subtotal − tierDiscount − couponDiscount) + shipping` (D-7).

## 4. Acceptance criteria

17 criteria. Shipping is the UA domestic 4_900 unless stated. Boundary cases:
**AC-4, AC-5, AC-6, AC-7, AC-9, AC-12**.

- **AC-1** (D-2, D-16): WHEN a gold customer orders 100_000 (1 000 грн) to UA with no
  coupons, THEN `tierDiscountKopecks` = 10_000, `couponDiscountKopecks` = 0,
  `shippingKopecks` = 4_900, `totalKopecks` = 94_900 — shipping is not discounted.
- **AC-2** (D-1): WHEN a gold customer orders 100_000 with one order-wide 15% code,
  THEN tier = 10_000 and coupon = 13_500 (15% of the remaining 90_000), total
  = 81_400 — **not** 79_900, which additive stacking would have produced.
- **AC-3** (D-3): WHEN an order of fresh 40_000 + standard 60_000 with no tier carries
  `["FRESH15", "FRESH5"]`, both scoped to `fresh`, THEN FRESH15 applies for
  6_000, FRESH5 is rejected `duplicate-scope`, total = 98_900.
- **AC-4** (D-7, D-12, boundary): WHEN a 30_000 order with no tier carries a fixed
  coupon of 50_000, THEN the applied discount is 30_000 (clamped, not 50_000),
  the item amount is 0, and total = 4_900 — the shipping fee alone, never negative.
- **AC-5** (D-4, boundary): WHEN a gold customer orders 12_345, so the tier discount is
  exactly 1_234.5, THEN `tierDiscountKopecks` = 1_235 (half up) and total = 16_010.
- **AC-6** (D-4, boundary): WHEN a 12_350 order with no tier carries an order-wide 5%
  code, so the discount is exactly 617.5, THEN `couponDiscountKopecks` = 618 and
  total = 16_632.
- **AC-7** (D-8, D-11, boundary): WHEN `now` is exactly the coupon's `expiresAt`, on a
  100_000 order with no tier, THEN the coupon is rejected `expired`, coupon
  discount = 0, total = 104_900, and no error is thrown.
- **AC-8** (D-9): WHEN a code is typed that the catalog does not contain, on a 100_000
  order with no tier, THEN it is rejected `unknown`, coupon discount = 0,
  total = 104_900.
- **AC-9** (D-6, boundary): WHEN a gold customer's subtotal is exactly 50_000 and the
  10% coupon requires `minSubtotalKopecks: 50_000`, THEN it applies — the gross
  subtotal clears the bar inclusively even though the post-tier 45_000 would
  not: tier = 5_000, coupon = 4_500, total = 45_400.
- **AC-10** (D-6): WHEN the subtotal is 49_900 and the same coupon requires 50_000,
  THEN it is rejected `below-min-subtotal`, coupon discount = 0, total = 54_800.
- **AC-11** (D-5, D-5a): WHEN a gold customer orders fresh 40_000 + standard 60_000 with
  a 15% coupon scoped to `fresh`, THEN tier = 10_000, the fresh base after tier
  is 36_000, coupon = 5_400 (not 6_000 off the pre-tier category, and not
  13_500 off the whole order), total = 89_500.
- **AC-12** (D-15, boundary): WHEN the order has no items at all and a gold customer
  types a 10% code, THEN subtotal = 0, tier = 0, shipping = 0, total = 0, and
  the code is rejected `no-eligible-items`.
- **AC-13** (D-15): WHEN a coupon is scoped to `digital` and the order contains no
  digital item, THEN it is rejected `no-eligible-items` and the total is
  unchanged.
- **AC-14** (D-14): WHEN a 100_000 order with no tier carries `["SAVE10", "SAVE10"]`
  (order-wide 10%), THEN the first applies for 10_000, the second is rejected
  `duplicate-code`, total = 94_900.
- **AC-15** (D-3, D-13): WHEN a gold customer orders fresh 40_000 + standard 60_000 and
  types `["FRESH15", "SAVE100", "FRESH5"]` — FRESH15 = 15% on `fresh`, SAVE100 =
  fixed 10_000 order-wide, FRESH5 = 5% on `fresh` — THEN tier = 10_000,
  FRESH15 = 5_400, SAVE100 = 10_000 (against the remaining 84_600), FRESH5 is
  rejected `duplicate-scope`, `couponDiscountKopecks` = 15_400, total = 79_500.
- **AC-16** (D-19): WHEN any breakdown is produced, THEN
  `subtotal − tier − coupons + shipping === total`, `total >= shipping`, and
  every code in `order.coupons` appears exactly once across `appliedCoupons`
  and `rejectedCoupons`.
- **AC-17** (D-2): WHEN a gold customer orders 20_000 of digital-only items, THEN tier =
  2_000, shipping = 0 (existing waiver), total = 18_000 — there is no shipping
  to discount and none is invented.

## 5. Contract

New file `app/src/discounts.ts`. Reuses `subtotalKopecks`, `shippingKopecks`
and `tierPercent` from `app/src/pricing.ts`, and `Order` / `LineItem` /
`Coupon` from `app/src/types.ts` unchanged — no new shapes there.

```ts
import type { Order, Coupon } from "./types.js";

export type CouponRejectionReason =
  | "unknown"              // D-9  — code not in the catalog
  | "expired"              // D-8  — now >= expiresAt
  | "below-min-subtotal"   // D-6  — gross subtotal < minSubtotalKopecks
  | "duplicate-code"       // D-14 — same code entered twice
  | "duplicate-scope"      // D-3  — that scope already has a coupon
  | "no-eligible-items";   // D-15 — base is 0 / category absent

export interface AppliedCoupon {
  code: string;
  /** Discount actually granted, after clamping (D-7, D-12). */
  discountKopecks: number;
}

export interface RejectedCoupon {
  code: string;
  reason: CouponRejectionReason;
}

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  /** Sum of appliedCoupons[].discountKopecks (D-18). */
  couponDiscountKopecks: number;
  appliedCoupons: AppliedCoupon[];
  rejectedCoupons: RejectedCoupon[];
  shippingKopecks: number;
  totalKopecks: number;
}

/**
 * Pure (D-17). `catalog` resolves the codes in `order.coupons`;
 * `now` decides expiry (D-11). Never throws (D-8).
 */
export function priceOrder(order: Order, catalog: Coupon[], now: Date): PriceBreakdown;
```

Two deliberate deviations from the sketch in `docs/templates/spec-template.md`
(`priceOrder(order, coupons)`), recorded so they don't read as drift:

- `order.coupons` is `string[]` — codes the customer typed — so the second
  parameter is the **catalog** they resolve against, not the codes themselves.
  D-9 exists only because the two can disagree.
- `now` is a parameter, per D-11.

## 6. How to verify

```bash
cd app && npm test
```

Green, and the output lists a test per criterion above, named by its ID (e.g.
`AC-3: two coupons on the same category`). Look for: 17 AC-named tests plus
the original 8 in `pricing.test.ts`; `AC-16` asserted on every fixture, not
just once; and no test in `discounts.test.ts` that does not carry an AC ID —
a nameless test means behaviour this spec did not ask for. `npm run typecheck`
passes with no `any`.
