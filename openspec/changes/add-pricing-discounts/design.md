## Context

The existing codebase (`app/src/pricing.ts`) has stable, well-tested functions for subtotal and shipping calculation, as well as tier percentage lookup. The new discount engine must plug in alongside these functions without modifying their signatures or behavior. All monetary values throughout the system are stored as whole kopecks (integers) to avoid floating-point precision loss.

## Goals / Non-Goals

**Goals:**
- Implement a composable, testable discount pipeline that applies tier loyalty and coupons sequentially
- Ensure kopeck-level precision with single-point rounding at the final subtotal
- Return a structured breakdown that checkout UI can display to customers
- Handle edge cases (expired coupons, missing categories, negative discounts, empty orders) with clear, predictable behavior

**Non-Goals:**
- Coupon creation, validation, or lifecycle management (admin/coupon services)
- Real-time coupon availability or inventory (assumed handled by lookup)
- Discount reporting or analytics (separate service)
- Currency conversion (assuming UAH throughout)
- Tier advancement or loyalty program logic (existing system)

## Decisions

### Decision 1: Sequential Application of Discounts
**Chosen:** Apply tier discount first, then each coupon in order, with each operating on the result of the previous discount.
**Rationale:** 
- Matches customer expectations: "get your tier benefit, then stack promo codes"
- Avoids the illusion of unlimited discounts (10% + 15% ≠ 25% for large orders)
- Simpler to explain in checkout UI and customer support
**Alternatives considered:**
- Additive (all discounts calculated from original): Creates large discounts at scale (can exceed 100% on multiple coupons), confusing for customers
- "Best discount only": Removes incentive for combining tier + promo, limits business flexibility
- Apply in reverse order: Arbitrary, adds cognitive load for both customers and support

### Decision 2: Discount Base = Subtotal Only (No Shipping)
**Chosen:** All percentage and fixed-amount discounts apply to items subtotal, not including shipping costs.
**Rationale:**
- Shipping is a separate operational cost (logistics), not a product value discount
- Industry standard (most e-commerce platforms structure it this way)
- Clearer UI: customers see "10% off products" and know shipping is separate
- Prevents conflicts with flat-fee shipping promotions (e.g., "free shipping over $X")
**Alternatives considered:**
- Discount applies to subtotal + shipping: Compounds shipping savings, inflates effective discount
- Allow per-coupon override: Adds complexity, fragile for category-specific coupons

### Decision 3: Category-Specific Coupons = Percent of That Category's Sum
**Chosen:** When a coupon targets a category, its discount is calculated from the sum of items in that category only.
**Rationale:**
- Aligns with coupon intent: "20% off fresh produce" means 20% of the produce section, not 20% of the whole order
- Prevents category-specific coupons from inflating when the cart is predominantly other categories
- Matches competitor behavior (Amazon, Instacart, etc.)
**Alternatives considered:**
- Percent of whole order: Misleading ("20% off fresh" on a 80% non-fresh cart is actually 4% off)
- Fixed amount per category: Doesn't scale with cart size

### Decision 4: Round Once at Final Subtotal, 0.5→1
**Chosen:** Perform discount calculations with full floating-point precision, then round the final subtotal to the nearest whole kopeck using standard rounding (0.5 and above → 1, below 0.5 → 0).
**Rationale:**
- Avoids rounding errors that compound across multiple discounts (rounding per discount can lose ±1 kopeck per operation)
- Single rounding point is simpler to test and explain
- Standard rounding (0.5→1) matches customer expectations and accounting norms
- Ensures totals are always whole kopecks for payment systems
**Alternatives considered:**
- Round per discount: Accumulates rounding errors, unpredictable final totals
- Floor (always down): Loses revenue on fractional kopecks
- Ceiling (always up): Overcharges customers

### Decision 5: Expired Coupons = Silent Ignore
**Chosen:** Coupons with `expiresAt` ≤ today are silently ignored in price calculation; no error is raised.
**Rationale:**
- Frontend already validates coupon codes and shows user-facing errors before checkout
- Backend should be defensive and not block orders on expired codes (time zone/sync edge cases)
- Graceful degradation: even if a coupon expires mid-second, order still processes
**Alternatives considered:**
- Raise HTTP 400 error: Disrupts checkout flow, support burden when clocks drift
- Filter at API entry point: Adds latency and state complexity, still doesn't guarantee sync

### Decision 6: Negative Subtotal → 0
**Chosen:** If total discounts exceed the subtotal, clamp the result to 0 kopecks (free order). Do not allow negative payment amounts.
**Rationale:**
- Operationally sound: can't charge negative amounts, payment systems don't support it
- Rare in practice (applies only when coupons are misconfigured or expire improperly)
- Simple rule for error cases: prevents cascading failures upstream
**Alternatives considered:**
- Reject the order: Creates support burden, order visible but unfulfillable
- Apply "credit to account": Adds complexity, liability tracking

### Decision 7: Minimum Subtotal Checked Against Current Base
**Chosen:** A coupon's `minSubtotalKopecks` is checked against the current subtotal (after tier + previous coupons), not the original subtotal.
**Rationale:**
- Respects coupon intent: a minimum of 100 грн means "customer's current cart must be worth this much"
- Allows tier discounts to make customers eligible for additional coupons
- Encourages cart growth ("add more to unlock promo")
**Alternatives considered:**
- Check against original subtotal: Tier discounts can disqualify coupons, contradicts tier benefit
- Check once at start: Inflexible, doesn't allow tiered promotions

## Risks / Trade-offs

**[Risk] Floating-point precision during calculation**
→ *Mitigation*: Use high-precision arithmetic (JavaScript numbers for percentages, convert to cents only for storage/comparison). Single rounding at the end prevents error accumulation.

**[Risk] Coupon misconfiguration (e.g., duplicate negative amounts, missing expiration)**
→ *Mitigation*: Validation happens in coupon CRUD operations (outside this feature). This engine assumes input is valid; garbage in, garbage out.

**[Risk] Time zone confusion with expiration dates (ISO format)**
→ *Mitigation*: Compare using UTC/ISO format consistently. Document that `expiresAt` is end-of-day UTC. Frontend responsible for converting user's local time to UTC.

**[Risk] Performance: sequential coupon application loops**
→ *Mitigation*: Expected coupon count is 1-5 per order; linear algorithm is acceptable. If this becomes a bottleneck (100+ coupons), revisit with memoization or compiled pipeline.

**[Risk] Rounding edge cases (0.5 exactly)**
→ *Mitigation*: Covered by extensive test suite (edge cases AC-8, AC-10). Rounding behavior is explicitly documented in the spec.

## Migration Plan

**Rollout:**
1. Deploy `discountPrice()` function alongside existing pricing functions (no changes to existing APIs)
2. Checkout frontend gradually routes orders to new `discountPrice()` function via feature flag
3. Monitor order totals, payment success rates, customer feedback
4. Gradually increase traffic share, roll back via feature flag if issues detected

**Rollback:** Feature flag off → old pricing path restored (no database migration needed, new function is read-only)

**Data:** No schema changes; discounts are calculated at checkout time, not stored. Existing orders are unaffected.

## Open Questions

- Should the system support negative fixed-amount coupons (e.g., add-on fees as "negative discounts")? → Defer to business policy, spec allows it via `value` sign.
- What happens if coupon database lookup fails (network error)? → Assumed that's handled by calling code; this function receives `Coupon[]` already populated.
