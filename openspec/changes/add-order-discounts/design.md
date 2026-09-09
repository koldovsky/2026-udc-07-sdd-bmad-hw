## Context

See `proposal.md` — Why. Constraints that shape the approach:

- `app/src/types.ts` and the four functions in `app/src/pricing.ts` are a
  protected contract: signatures, shapes and behaviour must not change. The
  engine composes them.
- `Order.coupons` is `string[]` — codes the customer typed, in typing order. The
  coupon definitions (`Coupon`) live outside the order, so resolving a code can
  fail.
- Money is whole kopecks. Floating-point arithmetic on amounts is prohibited, so
  every rounding site must be expressed in integers.
- The originating ticket (`materials/feature-request.md`) is deliberately
  ambiguous. The decisions below are the resolutions; the full record with
  reasons is `docs/spec/pricing-discounts.md` (D-1…D-19), whose ids this
  document preserves. Where the two disagree, that document wins.

## Goals / Non-Goals

**Goals:**

- One pure entry point that returns a complete, self-consistent breakdown, so a
  checkout page can render every line without recomputing anything.
- Every ambiguity resolved in a named, testable way — no behaviour decided
  implicitly by the code.
- Integer-only arithmetic with a single, stated rounding rule.

**Non-Goals:**

- Coupon-code normalization (trimming, case folding) — D-10.
- Validating the catalog (percent outside 0–100, negative or non-integer
  values) — D-15 of the decision record; the clamps make a malformed coupon
  harmless rather than rejected.
- A ceiling on total discount percentage — considered and rejected: the ticket
  gave no number, so inventing one would be a business decision.
- Free-shipping coupons, BOGO, usage limits, tax, non-UAH currency,
  persistence, API/UI concerns.

## Decisions

**D-1 — Sequential stacking, not additive.** Tier first, then coupons against
what remains. *Alternative:* sum the percentages (gold + 15% = 25%). Rejected:
on 1 000 грн it gives away 15 грн more per order, and the combined rate has no
upper bound as codes multiply. Sequential can never exceed the sum of the parts.

**D-2 — Discount base is the item subtotal; shipping is added afterwards.**
*Alternative:* discount items + shipping. Rejected: `shippingKopecks` is
protected and already has its own waiver rule; letting a product discount eat a
delivery fee silently changes that function's economics.

**D-3 — All valid coupons apply, one per scope.** Scope is the whole order for
an unscoped coupon, otherwise the named category. *Alternatives:* apply only the
best coupon (contradicts a ticket that invites several codes); apply all with no
scope limit (two 15% fresh codes compound to 27.75% off a category nobody
approved). One-per-scope keeps stacking meaningful and bounded.

**D-4 — Round half away from zero, per discount, in integers.** Implemented as
`floor((base * percent + 50) / 100)`. *Alternatives:* round at the end (the
breakdown's parts then fail to sum to the total, hiding a residue); banker's
rounding (defensible, but harder to explain to support and no upside here);
floor (silently favours the house on every half kopeck).

**D-5 / D-5a — A category coupon is computed on its own category, after the tier
percentage is applied to that category.** Per-category base is
`categorySubtotal − floor((categorySubtotal * tierPercent + 50) / 100)`, computed
independently. *Alternative:* allocate the single rounded `tierDiscount` across
categories proportionally. Rejected: allocation needs an arbitrary ordering and
leaves a stray kopeck in whichever category is last. The per-category figure is
only ever a base and a cap — never a reported amount — so a ≤1 kopeck divergence
from the reported tier discount cannot reach the customer or break the
reconciliation invariant.

**D-6 — Minimum-subtotal is checked against the gross subtotal, inclusively.**
*Alternative:* check the post-discount amount. Rejected: the threshold is what
the promo terms advertise, and a post-discount check makes one code's
eligibility depend on which other codes were typed first.

**D-7 — Item amount floors at 0; shipping is still charged.** *Alternative:*
allow a negative total (a refund) or waive shipping when items reach 0.
Rejected: we never pay a customer to order, and shipping is money already spent.

**D-8 — Invalid coupons are reported, never thrown.** The breakdown carries a
refusal list with one machine-readable reason each. *Alternative:* throw on the
first invalid code — a stale code then blanks the whole checkout price;
*alternative:* skip silently — the UI cannot explain why nothing happened.

**D-9 / D-10 — Unresolvable codes are refused as `unknown`; matching is exact
and case-sensitive.** *Alternative:* normalize case and whitespace here.
Rejected as unrequested behaviour that belongs to the input layer.

**D-11 — The evaluation instant is a parameter.** A coupon is invalid when
`now >= expiresAt`, the direction `types.ts` documents. *Alternative:* read the
clock inside the function. Rejected: it makes the function impure and its expiry
tests unrepeatable.

**D-12 — A fixed coupon clamps to its scope's remaining amount, and the clamped
figure is what gets reported.** Reporting the face value would put a number on
the receipt that was never granted.

**D-13 — Application order is the customer's typing order.** It is the only
ordering the domain carries; under D-1 the order changes the result, so any
re-sort (by value, by scope) would be invented policy.

**D-14 — A repeated code is refused as `duplicate-code`,** distinct from
`duplicate-scope`, so support can tell a double-paste from two conflicting
promotions.

**D-15 — A coupon whose scope carries no amount is refused as
`no-eligible-items`,** rather than applied for 0 — an "applied" 0 грн discount
reads as success while nothing happened.

**D-16 — The tier discount excludes no category.** The ticket named no
exclusions; adding one would be behaviour no requirement asked for.

**D-17 — `priceOrder` is pure:** no mutation of its inputs, no I/O, no clock, no
logging. Makes every scenario a plain input → output test.

**D-18 — Report both the coupon total and the per-coupon amounts,** so checkout
can render "SAVE100 −100 грн" while the total keeps the invariant checkable in
one assertion.

**D-19 — "Kopecks must not drift" is discharged as a stated invariant:**
`subtotal − tier − coupons + shipping = total`, `total >= shipping`, and every
typed code accounted for exactly once. The last clause is what catches a coupon
being dropped rather than refused.

### Contract

```ts
export type CouponRejectionReason =
  | "unknown"              // D-9
  | "expired"              // D-8, D-11
  | "below-min-subtotal"   // D-6
  | "duplicate-code"       // D-14
  | "duplicate-scope"      // D-3
  | "no-eligible-items";   // D-15

export interface AppliedCoupon { code: string; discountKopecks: number; }
export interface RejectedCoupon { code: string; reason: CouponRejectionReason; }

export interface PriceBreakdown {
  subtotalKopecks: number;
  tierDiscountKopecks: number;
  couponDiscountKopecks: number;
  appliedCoupons: AppliedCoupon[];
  rejectedCoupons: RejectedCoupon[];
  shippingKopecks: number;
  totalKopecks: number;
}

export function priceOrder(order: Order, catalog: Coupon[], now: Date): PriceBreakdown;
```

`catalog` rather than `coupons` because `order.coupons` already holds the codes;
the second parameter supplies what they resolve to. `now` per D-11.

### Algorithm

The ordering is itself a decision — D-1, D-3 and D-5a only yield one answer once
the sequence is fixed:

1. `subtotal = subtotalKopecks(order)`, `shipping = shippingKopecks(order)`,
   `pct = tierPercent(order)` — all three reused unchanged from `pricing.ts`.
2. `tierDiscount = roundHalfUp(subtotal, pct)`; `remaining = subtotal − tierDiscount`.
3. For each category present, `categoryBase[c] = categorySubtotal(c) − roundHalfUp(categorySubtotal(c), pct)`.
4. For each code in `order.coupons`, in order: refuse on already-seen
   (`duplicate-code`), unresolvable (`unknown`), `now >= expiresAt` (`expired`),
   gross subtotal below minimum (`below-min-subtotal`), scope already used
   (`duplicate-scope`), or a zero/absent base (`no-eligible-items`). Otherwise
   compute `roundHalfUp(base, value)` for a percent coupon or `min(value, base)`
   for a fixed one, clamp to `remaining`, subtract from `remaining` and from the
   category base, mark the scope used, and record the granted amount.
5. `total = max(0, subtotal − tierDiscount − couponDiscount) + shipping`.

Where `roundHalfUp(base, percent) = Math.floor((base * percent + 50) / 100)`.

## Risks / Trade-offs

- **The per-category tier base (D-5a) can differ from the reported tier discount
  by up to one kopeck per category** → contained by construction: that figure is
  only a base and a cap, never a reported amount, and the reconciliation
  invariant (D-19) is asserted on every scenario, so a leak would fail a test
  rather than reach a customer.
- **Typing order changes the total** (D-1 + D-13): the same three codes in a
  different order can differ by a kopeck or two → accepted deliberately, and made
  visible by AC-15 pinning one exact order. The alternative (re-sorting) would
  be policy nobody asked for.
- **`priceOrder` grows a third parameter (`now`)**, so callers must supply a
  clock → accepted for determinism; a wrapper can default it at the edge of the
  system, outside this pure core.
- **The requirements now exist in two places** — `docs/spec/pricing-discounts.md`
  and this change — and can drift → mitigated by naming the former
  authoritative, keeping the D-/AC- ids identical in both, and recording the
  duplication as a real cost in `docs/sdd-tool.md`.
- **A malformed catalog entry is not rejected** (`percent: 150`) → the D-7/D-12
  clamps keep the total sane, but the receipt would show an unusually large
  discount. Accepted as out of scope; validation belongs where the catalog is
  authored.
