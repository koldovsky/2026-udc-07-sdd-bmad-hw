## Context

The repository already fixes several things that constrain this design and are not negotiable:

- `app/src/types.ts` defines `Order`, `LineItem`, `Coupon`. `Coupon` carries only `code`,
  `kind`, `value`, `expiresAt`, and the optional `category` / `minSubtotalKopecks`. There is no
  usage counter, no start date, no per-customer binding — so those cannot be designed for.
- `app/src/pricing.ts` already implements `subtotalKopecks`, `shippingKopecks` and `tierPercent`
  and is covered by 8 passing tests. Signatures and behaviour are frozen.
- `Order.coupons` is `string[]`, documented as "in the order they typed them". That entry order
  is the only ordering signal available, and it is the one the spec uses.
- Money is integer kopecks. The engine must never let a fractional value reach a returned field.
- Toolchain is `vitest` on TypeScript, ESM with NodeNext resolution, zero runtime dependencies.

The decision table `D-1..D-20` in `docs/spec/pricing-discounts.md` already settled the product
questions. What remains here is the *shape* of the code that carries them.

## Goals / Non-Goals

**Goals:**

- One pure function as the entire public surface, so the whole capability is testable without
  fixtures, clocks, or I/O.
- A return value that is auditable: a reader can reconstruct the total from the parts, and can
  see why each rejected coupon was rejected.
- Determinism: same order + same catalogue + same instant ⇒ byte-identical result.
- An integer-only money path, structurally enforced rather than remembered.
- Traceability by construction — decision ids in the code comments, AC ids in the test names.

**Non-Goals:**

- Coupon persistence, lookup service, or catalogue validation at rest. The catalogue is an
  argument.
- Finding the optimal coupon combination. Entry order wins (D-18); search is explicitly rejected.
- Localised or user-facing rejection messages. The engine emits reason codes; wording is the
  caller's problem.
- Extensibility hooks, plugin registries, or a rules DSL for future discount kinds. Two kinds
  exist; a third is a spec change, not a design accommodation.
- Any change to shipping, subtotal or tier behaviour.

## Decisions

### D-A. A single pure function, `priceOrder(order, catalog, now?)`

Alternative considered: a `DiscountEngine` class configured with the catalogue. Rejected — it
adds construction state to a calculation that has none, and makes every test set up an object
before it can assert a number. A free function keeps the test body equal to the acceptance
criterion. `catalog` is a parameter rather than a module-level registry for the same reason.

### D-B. `now` is an explicit optional parameter, defaulting to `new Date()`

Alternative considered: reading the clock inside, and freezing time in tests. Rejected — fake
timers are a shared mutable global and make AC-10 (the exact `expiresAt` boundary) flaky.
Passing the instant makes the boundary assertion a plain comparison. The default keeps the
common call site short.

### D-C. Return a `PriceBreakdown` record, not a single number

The spec requires the caller to be able to show the customer what happened (D-8: rejections are
visible, not silent). A bare total cannot carry that. The record therefore carries
`subtotalKopecks`, `tierPercent`, `tierDiscountKopecks`, `couponDiscountKopecks`,
`discountedGoodsKopecks`, `shippingKopecks`, `totalKopecks`, plus `appliedCoupons` and
`rejectedCoupons` in entry order. AC-20's balance invariant is then checkable on the returned
value alone.

### D-D. Rejection reasons are a closed string-literal union, checked in a fixed order

`CouponRejectionReason` is a union of seven literals. A closed union means adding a reason is a
compile-time event across every consumer, and it lets the tests assert on a stable token rather
than on prose. The evaluation order is fixed by D-17 precisely because a coupon can fail two
checks at once; without a fixed order, that coupon's reported reason would be an implementation
detail — that is, untestable.

### D-E. Rounding lives in one exported helper, `roundKopecks`

`Math.round` in JavaScript rounds `-0.5` toward zero, which is not half-up away from zero. Since
every intermediate here is non-negative the difference never bites, but the rule is stated as
"half-up away from zero" (D-4) and the implementation should say what the rule says rather than
rely on the sign never going negative. One helper, `floor(x + 0.5)`, exported so AC-13 and AC-14
can test the rule directly instead of inferring it from a total.

### D-F. Discounts are folded over a single `remaining` accumulator

The alternative — computing all discounts against the subtotal and reconciling at the end —
cannot express sequential composition (D-1) and makes the "never negative" cap (D-7) a
post-hoc correction. A single monotonically non-increasing accumulator makes both properties
structural: each step subtracts `min(discount, remaining)`, so `remaining >= 0` holds by
construction and the AC-20 balance falls out for free.

### D-G. Category scoping is a scaling factor, not a per-line ledger

Alternative considered: allocating the tier discount across individual line items and tracking a
per-line remaining amount. Rejected — it forces a remainder-distribution rule (largest-remainder
or similar) for something no acceptance criterion observes, and it makes results depend on line
ordering. Scaling the category total by `remaining / subtotal` and rounding once (D-5) is
order-independent and needs one line of arithmetic.

### D-H. Scope key is `coupon.category ?? "ORDER"`, tracked in a `Set`

Cheapest possible encoding of D-3's "one coupon per scope". The literal `"ORDER"` can never
collide with a `LineItem["category"]` value because that type is the closed union
`"standard" | "fresh" | "digital"` — a compile-time guarantee, not a convention.

### D-I. Zero-base is a rejection, not a zero-value application

When the computed base is 0 the coupon is rejected as `no_matching_items` (D-12, D-14) rather
than recorded as applied with a 0 discount. This keeps `appliedCoupons` meaning "these gave the
customer money" — otherwise a receipt would list discounts worth nothing. Note the deliberate
asymmetry: a *non-zero* base that rounds down to a 0 discount (e.g. 0.4 kopecks) still counts as
applied and still consumes the scope, because the coupon did match.

### D-J. `discounts.ts` is a new module; `index.ts` only re-exports

Nothing in `pricing.ts` changes, so nothing needs to move. Keeping the engine in its own file
makes the diff for this change reviewable in isolation and keeps the "did you touch the frozen
file?" check trivial — `git diff --stat app/src/pricing.ts` must be empty.

## Risks / Trade-offs

| Risk | Assessment | Mitigation |
|---|---|---|
| Entry-order dependence means two customers with the same coupons in different orders can pay different amounts. | Real, and accepted (D-18). Searching for the best combination is unpredictable for the customer and costly. | Documented in the spec; AC-7 pins the ordered result so nobody "fixes" it silently. |
| Step-wise rounding can drift up to ~0.5 kopeck per discount step versus rounding once at the end. | Accepted (D-4). Bounded by a few kopecks per order; the readability and exact-balance win is worth more. | AC-20 asserts the balance identity holds regardless. |
| No cap on total discount (D-20) — a generous catalogue can drive goods to 0. | Accepted. The floor at 0 (D-7) bounds the loss at the order value; a cap was not requested. | AC-11 pins the floor behaviour. Adding a cap is a spec revision, not a hotfix. |
| The scaling factor in D-G is unintuitive: a category coupon's effective base shrinks as other discounts grow. | Real. Support may field "why was my 20% not 20% of the category price?" | Worked example with explicit arithmetic in AC-5 and AC-14; `PriceBreakdown` exposes the per-coupon amount so the receipt can show it. |
| `Date.parse` on a malformed `expiresAt` yields `NaN`, and every comparison against `NaN` is false — such a coupon would silently read as expired. | **Found here, at design time.** Genuine hole: the original `invalid_value` decision covered `value`, not `expiresAt`. | **Resolved:** escalated to the spec owner and closed as **D-21 / AC-21** — an unparseable `expiresAt` is `invalid_value`, checked before expiry. No longer an open question. |
| Catalogue may contain duplicate `code` entries; the spec did not say which wins. | Low impact, but the result would differ between a `find`-based and a `Map`-based implementation — i.e. untestable. | **Resolved:** closed as **D-22 / AC-22** — first entry in `catalog` wins. Catalogue integrity itself stays out of scope. |



