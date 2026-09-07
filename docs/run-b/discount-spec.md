# Discount engine — specification

Derived from `materials/feature-request.md` (Head of Growth, autumn campaign).
The ticket is a business request; it does not imply a unique implementation.
This document closes every fork it leaves open. Each decision has an ID; the
tests in `app/src/discounts.test.ts` are named after these IDs.

Money is whole kopecks (integers) everywhere. 1 грн = 100 копійок.

## Public surface

```ts
quoteOrder(order: Order, catalog: readonly Coupon[], now?: Date): PriceBreakdown
```

`Order.coupons` holds the codes the customer typed, in typing order. `catalog`
is the set of coupons the system knows about; a typed code that is not in the
catalog is rejected, not ignored silently. `now` defaults to `new Date()` and
exists so expiry is testable.

The result is a full breakdown — never a bare number — because rejections have
to reach the customer (see D8).

## Decisions

### D1 — Discounts apply to goods only; shipping is never discounted

The discount base is the items subtotal (`subtotalKopecks`). Shipping is added
after all discounts. *Why:* shipping is a pass-through cost; discounting it
turns a 10% tier benefit into a variable margin loss that depends on
destination.

### D2 — Tier first, then coupons in typed order, applied sequentially

Percentages are **not** added. Each discount is computed against what remains
after the previous one. Gold + a 15% coupon on 1 000 грн is
−100 грн then −15% of 900 грн = −135 грн, total −235 грн, not −250 грн.
*Why:* sequential application is bounded — the order can never be discounted
below 0 by stacking, and the customer still "feels both" as the ticket asks
(point 3). Tier goes first because it is the entitlement the customer already
owns; coupons are campaign-specific and layer on top.

### D3 — Round half-up, once per discount, on the aggregate base; allocate by largest remainder

Each discount computes one rounded amount from the sum of its eligible lines'
remaining value, rounding **half-up** (0.5 kopeck → up). That single amount is
then split back across the eligible lines by the largest-remainder method, so
the parts sum to the whole exactly. *Why:* rounding per line and then summing
loses kopecks against the headline percentage; rounding once and allocating
exactly means no residue exists at any level. Half-up is the rounding people
expect on a receipt.

### D4 — One coupon per scope; the first typed one wins

A coupon's scope is its `category`, or `"order"` when it has none. At most one
coupon is applied per scope, so at most one order-wide coupon plus one per
category. A later coupon claiming an already-claimed scope is rejected as
`scope-conflict`. *Why:* answers "several coupons?" (point 5) with a rule the
customer can predict without knowing our margin table — all of them apply,
except ones that collide, and typing order decides collisions. Only *applied*
coupons claim a scope; a rejected coupon leaves its scope free.

### D5 — A category coupon's percentage is taken from that category only

Not from the whole order. A 20% "fresh" coupon on an order with 300 грн fresh
and 700 грн standard discounts 60 грн, not 200 грн. The base is that
category's *remaining* value at the time the coupon is applied (per D2).

### D6 — A fixed coupon is capped at its eligible remaining base

A 500 грн fixed coupon against 300 грн of remaining eligible goods discounts
300 грн. The excess is not carried to other categories and not refunded.

### D7 — `minSubtotalKopecks` is checked against the original items subtotal

Before any discount, tier or coupon, and before shipping. *Why:* the threshold
is a promise about what the customer put in the basket. Checking it after other
discounts would make a coupon's validity depend on typing order and on tier,
which is impossible to explain at checkout.

### D8 — Expired means `now >= expiresAt`, and rejection is explicit

The coupon is not valid on or at its `expiresAt` instant. Every rejected coupon
is returned in `rejectedCoupons` with a reason — nothing is dropped silently,
and nothing throws. *Why:* silent failure produces support tickets; throwing
would discard an otherwise valid quote over one bad code. An unparseable
`expiresAt` counts as expired (fail closed).

### D9 — The total has a floor; it can never go negative

Every discount is capped at the remaining value of its eligible lines, so
discounted goods floor at 0. `totalKopecks = discountedSubtotal + shipping`,
which is therefore always ≥ shipping ≥ 0.

### D10 — Rejection reasons, in evaluation order

The first matching reason wins:

| # | reason | condition |
|---|--------|-----------|
| 1 | `unknown-code` | the code is not in the catalog |
| 2 | `duplicate-code` | the same code was typed earlier in this order |
| 3 | `expired` | `now >= expiresAt`, or `expiresAt` does not parse (D8) |
| 4 | `below-min-subtotal` | items subtotal < `minSubtotalKopecks` (D7) |
| 5 | `scope-conflict` | an applied coupon already holds this scope (D4) |
| 6 | `no-effect` | the discount would be 0 kopecks — no items in the category, nothing left to discount, or a value that rounds to 0 |

### D11 — Catalog values are clamped, not trusted blindly

`percent` is clamped to 0–100, `fixed` to ≥ 0. A non-finite value is treated as
0 and the coupon lands in `no-effect`. *Why:* a bad campaign row should cost
nothing, not give the store away.

## Worked example

Order: 700 грн standard + 300 грн fresh, UA, gold, coupons `["FRESH20", "SAVE15"]`
where `FRESH20` is 20% on `fresh` and `SAVE15` is 15% order-wide.

| step | base | amount | remaining goods |
|------|------|--------|-----------------|
| subtotal | — | — | 100 000 |
| tier gold 10% (D2) | 100 000 | 10 000 | 90 000 |
| `FRESH20` 20% of fresh remaining 27 000 (D5) | 27 000 | 5 400 | 84 600 |
| `SAVE15` 15% of order remaining (D2) | 84 600 | 12 690 | 71 910 |
| shipping UA (D1) | — | +4 900 | — |

`totalKopecks` = 76 810 (768.10 грн).
