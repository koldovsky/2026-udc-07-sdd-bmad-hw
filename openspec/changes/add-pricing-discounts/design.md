## Context

See `proposal.md` for motivation and `specs/pricing-discounts/spec.md` for the
behavior contract. The app is a dependency-free TypeScript domain library. It already
provides protected pure helpers for subtotal, shipping, and tier percentage; it has no
discount engine.

## Goals / Non-Goals

**Goals:**

- Add one pure pricing entry point that composes the existing helpers with the agreed
  discount rules.
- Preserve per-line remaining balances only as needed to determine later category
  coupon bases and deterministic proportional allocation.
- Make each of the sixteen source acceptance criteria directly testable.

**Non-Goals:**

- Change seeded types or protected pricing behavior.
- Add storage, a coupon service, checkout integration, dependencies, or validation
  beyond the agreed coupon outcomes.

## Decisions

### Single pure discount module

Add `app/src/discounts.ts` with the `priceOrder` contract from the source spec and
export it through `app/src/index.ts`. Keep `Coupon[]` lookup within this function.

Alternative: extend `pricing.ts`. Rejected because its existing functions are
protected and already represent fully specified behavior.

### Remaining value tracks line/category effects

Calculate original line totals with the existing helper, apply each discount to
remaining eligible balances, and retain enough line information to calculate a later
category coupon after an order-wide discount. Allocate order-wide savings
proportionally and give leftover kopecks to eligible lines in input order, as required
by the agreed specification.

Alternative: retain only one order-wide remaining total. Rejected because it cannot
determine the remaining value of a category after an unrestricted discount.

### Coupon evaluation produces outcomes instead of errors

Normalize entered codes, resolve supplied definitions, evaluate the documented
rejection priority, and append one result for every entered code. A rejected coupon
does not alter balances; a valid zero-saving coupon remains applied.

Alternative: throw on an invalid coupon. Rejected because the agreed behavior allows
later valid coupons to continue.

### Exact integer result handling

Keep returned money in integer kopecks. Calculate each percentage operation on its
full eligible balance, then apply nearest-kopek, half-up rounding once before reducing
balances.

Alternative: round each line independently. Rejected because it conflicts with the
source specification's operation-level rounding rule.

## Risks / Trade-offs

- [Order-wide discounts need later category balances] → Retain per-line remaining
  balances and cover the proportional-allocation scenario in AC-6.
- [Coupon rules can become opaque] → Keep evaluation in input order with a small,
  explicit rejection-priority check and AC-named tests.
- [Changes to protected pricing helpers] → Import and compose them; do not modify
  their signatures or behavior.

## Migration Plan

No data migration or deployment sequence is required. The change is additive: add the
module, export it, add its tests, and preserve the existing test suite.
