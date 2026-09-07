## Context

`app/src/pricing.ts` already provides `lineTotalKopecks`, `subtotalKopecks`,
`shippingKopecks`, `tierPercent` — pure, integer-kopeck, and frozen by the
seeded contract. There is no discount engine. `Order.coupons` is a `string[]`
of codes in the order the customer typed them; the `Coupon` objects (kind,
value, `expiresAt`, optional `category` / `minSubtotalKopecks`) come from a
catalog the caller supplies. All decisions referenced below (D-1..D-21) are
resolved in `docs/spec/pricing-discounts.md`.

## Goals / Non-Goals

**Goals:**

- One pure function `priceOrder(order, catalog, now?)` returning `PriceBreakdown`.
- Every intermediate amount stays an integer kopeck; rounding happens once per
  discount step (D-4).
- Deterministic given `(order, catalog, now)` — no `Date.now()` inside the hot
  path, no dependence on catalog array order beyond code lookup.
- Total function: never throws, whatever the catalog contains (D-8, D-9, D-16).

**Non-Goals:**

- No new module layout or dependency; a single `discounts.ts` beside `pricing.ts`.
- No caller-facing error channel or i18n message for rejected coupons — the
  only signal is absence from `appliedCoupons` (see proposal Non-Goals).
- No change to how shipping or the tier percentage themselves are computed.

## Decisions

- **Single running `remaining`, seeded from `subtotal - tierDiscount`, floored
  at 0.** Each coupon subtracts `min(computed, remaining)` from it. This makes
  D-1 (sequential), D-7 (non-negative) and the fixed-coupon cap (D-15) fall out
  of one invariant instead of three special cases. Alternative — track a list
  of discount lines and reconcile at the end — was rejected as harder to prove
  non-negative and order-correct.

- **Category coupons read a separately computed `categorySubtotalKopecks`, not
  the running remainder (D-5).** Rationale in the spec: a "−25% on fresh" code
  must mean 25 % of the fresh lines regardless of tier or other codes. The
  result is still `min`-capped by `remaining` so the invariant holds.

- **`minSubtotalKopecks` compared to the raw `subtotalKopecks(order)` (D-6),
  captured once before the loop.** Keeps the gate independent of coupon order.

- **Rounding helper `percentOf(base, pct) = Math.round(base * pct / 100)` with
  `pct` clamped to `[0, 100]` (D-4, D-16).** `base` and `pct` are integers so
  `base * pct` is exact; the single `/100` + `Math.round` is the only place a
  fraction appears and it is resolved immediately. `Math.round` is half-up for
  the non-negative values this engine deals in.

- **Expiry via `now.getTime() >= Date.parse(coupon.expiresAt)`, `now`
  defaulting to `new Date()` (D-11).** A `NaN` parse result counts as expired —
  an unusable date cannot prove validity. Injecting `now` is what makes AC-12
  deterministic.

- **Dedupe by first occurrence with a `Set<string>` over `order.coupons`
  (D-10); one-per-category with a `Set` of categories that have already taken a
  discount > 0 (D-3, D-14).** A coupon that passes every gate but computes to 0
  is not pushed to `appliedCoupons` and does not claim its category slot.

- **`catalog` indexed into a `Map<code, Coupon>` once.** If a code appears
  twice in the catalog, the last wins; catalog hygiene is out of scope (D-16).

## Risks / Trade-offs

- **[Float rounding of `base * pct / 100`]** → `base` is bounded by realistic
  order sizes (< 2^37 kopecks) and `pct <= 100`, so `base * pct` stays well
  inside `Number.MAX_SAFE_INTEGER`; the only division is immediately rounded.
  AC-11 pins the half-cent case.
- **[Category base ignores prior order-level coupons]** → by design (D-5); can
  in principle let `tier% + categoryCoupon%` exceed the value of those specific
  items, but the global `remaining` cap means the order total is still correct
  and non-negative. Documented, accepted.
- **[Silent coupon rejection]** → a mistyped or expired code gives the customer
  no feedback from this layer. Accepted: messaging is a separate concern
  (proposal Non-Goals); `appliedCoupons` lets the caller diff intended vs
  applied and show its own message.
- **[`appliedCoupons` semantics]** → "applied" means "reduced the total > 0",
  not "passed validation". Chosen so the reverse-traceability check has no
  phantom entries; noted in D-14 so a second implementer makes the same choice.

## Open Questions

None. The forks that would change specs, approach or tasks were resolved with
the decision author before this document (D-1..D-21).
