## Context

See `proposal.md` — Why. The constraints that shape the approach:

- `app/src/pricing.ts` (`lineTotalKopecks`, `subtotalKopecks`, `shippingKopecks`, `tierPercent`) and the shapes in `app/src/types.ts` are a seeded contract: signatures and behaviour must not change, and the existing 8 tests in `app/src/pricing.test.ts` must stay untouched and green.
- The public entry point is fixed by `docs/spec/pricing-discounts.md` §5: `priceOrder(order: Order, coupons: Coupon[]): PriceBreakdown`. There is no clock parameter and no error field, so "now" comes from the system clock and an expired coupon can only be reported by throwing.
- Money is integer kopecks throughout. No runtime dependencies; the module stays a pure domain library, `vitest` for tests.
- Requirements and every worked number live in `specs/pricing-discounts/spec.md`. This document does not restate them.

## Goals / Non-Goals

**Goals:**

- One evaluation pass with a single mutable ledger, so "sequential" stacking is structural rather than something each branch has to remember.
- Every number in the spec's scenarios reproducible by reading the code, with no hidden rounding.
- Deterministic output for a given `(order, coupons)` pair and a fixed clock — no dependence on object key order or on category ordering in the input.

**Non-Goals:**

- Validating catalogue data: `percent` values outside 0–100, negative `value`, or a malformed `expiresAt` are outside the type contract and get no defensive handling.
- Coupon usage limits, per-customer caps, currency other than kopecks, and any i18n of the error message.
- Changing how shipping or the tier percentage are computed — both are read from the existing functions.

## Decisions

### Ledger of category buckets rather than a single running total

Evaluation state is a map from category to the kopecks still discountable in that category, seeded from the order's line totals; the order-wide remaining amount is the sum of the buckets. Every discount step reduces buckets and returns the amount it took.

*Why:* the spec needs two views of the same money at once — a category coupon computes from one category (AC-7, AC-13), while `minSubtotalKopecks` is checked order-wide (AC-8). A single running total cannot answer "what is left in `fresh`" after an order-wide discount, and a pair of independent counters can drift out of sync. Buckets keep one source of truth.

*Alternatives considered:* (a) recomputing each category's remainder from a list of applied discounts — same arithmetic, re-derived at every step, easier to get wrong; (b) tracking only the order-wide remainder and computing category coupons from the pre-discount category sum — simpler, but rejected as a spec decision because two 50% coupons could then zero out a category.

### Percentages are applied per bucket; only fixed order-wide amounts need allocating

An order-wide percentage takes its share from each bucket separately, each rounded up. Only an order-wide `fixed` coupon has an amount decided before it meets the buckets, so it is the single case that needs the largest-remainder allocation the spec describes.

*Why:* it keeps the allocation rule confined to one code path instead of applying it to every step. The cost is that a per-bucket ceiling can exceed a ceiling taken on the whole subtotal by a kopeck per category; with rounding defined as "up, in the customer's favour" that is the acceptable direction, and it is visible in the reported `tierDiscountKopecks`.

*Alternative considered:* compute each percentage once on the order-wide remainder and allocate it to buckets — one extra allocation per step, and the reported tier discount would then depend on the same tie-break rules as fixed coupons.

### Rounding as a single helper, used at every discount step

One `percentOfCeil(baseKopecks, percent)` helper, `Math.ceil((base * percent) / 100)`, is the only place a percentage becomes an amount. Base and percent are integers, so the product is exact for realistic order sizes and the division is the only non-integer step.

*Why:* D-4 plus the decision to round at each step means the ceiling must be unmissable and identical everywhere; a helper makes "rounded up, at each step" one line to review instead of a habit to maintain.

### Coupon resolution as a separate pass before evaluation

Typed codes are first turned into an ordered list of coupons — deduplicated by code, unmatched codes dropped, catalogue collisions resolved to the first entry — and expiry is checked during this pass so `ExpiredCouponError` is thrown before any arithmetic happens.

*Why:* it matches the spec's ordering (expiry outranks eligibility) and keeps the evaluation loop free of lookup concerns. Throwing before any mutation also means a rejected call cannot leave a half-computed breakdown behind.

### `ExpiredCouponError` as an exported class

A named `Error` subclass carrying `code`, rather than a plain `Error` or a sentinel in the return value.

*Why:* the spec makes the offending code part of the observable outcome; a class lets a caller (and a test) assert on `code` without parsing a message. `PriceBreakdown` has no error field, so a thrown value is the only channel available without changing the fixed contract.

*Alternative considered:* a plain `Error` with the code in the message — smaller surface, but the code would only be recoverable by string parsing.

### Expiry read from the system clock at call time

`Date.now() >= Date.parse(coupon.expiresAt)` means expired, matching "not valid on or after this instant" in `types.ts`.

*Why:* the signature admits no clock and must not change. Tests keep determinism by using `expiresAt` values far in the past or far in the future rather than by faking time.

### New module `app/src/discounts.ts`

`PriceBreakdown`, `ExpiredCouponError` and `priceOrder` live in a new file that imports from `pricing.ts` and `types.ts`, and are re-exported from `app/src/index.ts`. Tests go in `app/src/discounts.test.ts`, each named after the acceptance criterion it covers.

*Why:* it keeps the protected seeded file untouched, so a reviewer can see at a glance that the contract was extended and not edited.

## Risks / Trade-offs

- **Per-bucket ceilings make `tierDiscountKopecks` depend on how the order splits across categories** (a kopeck or two more than a single ceiling on the subtotal) → the direction always favours the customer, the rule is written down in the spec, and a scenario pins the arithmetic.
- **The largest-remainder allocation for order-wide fixed coupons is only observable through a later category coupon**, so a wrong tie-break could go unnoticed → AC-12 exercises exactly that sequence, with a deliberately non-divisible amount.
- **Reading the clock inside `priceOrder` makes expiry untestable at a boundary** → accepted, because the signature is fixed; tests stay away from the boundary instead of injecting time.
- **Skipping an over-large coupon whole rather than trimming it can surprise a customer** who sees a big coupon do nothing → it is a deliberate spec decision (D-7), and the error-free skip keeps checkout working.
- **Traceability drifts if the newly closed forks stay undocumented** → `tasks.md` records the new decisions and acceptance criteria back into `docs/spec/pricing-discounts.md` before implementation starts, so the spec stays the source of truth.
