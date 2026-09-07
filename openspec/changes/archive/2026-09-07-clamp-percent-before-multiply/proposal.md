## Why

`discountFor` computes a percentage discount as `min(idiv(base * value, 100), base)`,
which is exactly what step 6 of `docs/spec/pricing-discounts.md` prescribes. For
every `value` inside the capacity bound of section 3 the result is correct. Past
it, the formula breaks in a way section 3 explicitly promised it would not.

`Number.isInteger(Number.MAX_VALUE)` is `true`, so D-27 does not reject such a
`value`. A catalog row carrying it makes `base * value` evaluate to `Infinity`,
`idiv(Infinity, 100)` returns `NaN`, and `Math.min(NaN, base)` is `NaN`. That
`NaN` reaches `couponDiscountKopecks` and `totalKopecks`, which contradicts
invariant I-2 (the breakdown adds up) and I-3 (every amount is a whole kopeck),
and it does so silently: no exception, no rejection, a total that renders as
`NaN` on the checkout page.

Section 3 argued the opposite in prose — the `value` ceiling is a *capacity*
bound, whose violation "does not affect the result, because what remains after
the clamp is `base`". That sentence is true only if the clamp happens before the
multiplication. As written, the multiplication happens first.

The defect was reported by the automated reviewer on the submission pull request
and reproduced against the engine before this change was written:

```
value=1.7976931348623157e+308  couponDiscountKopecks: NaN  totalKopecks: NaN
value=1e+308                   couponDiscountKopecks: NaN  totalKopecks: NaN
value=1e+15                    couponDiscountKopecks: 100000  totalKopecks: 4900
```

Section 11 of the specification prescribes the order of repair: decision and
criterion first, then the delta, then the test, then the code.

## What Changes

- **Modified** requirement `Every discount is a whole number of kopecks, rounded
  down`: a percentage `value` of 100 or more now yields exactly `base` without
  forming the product, so no input can put a non-finite number into the
  breakdown.
- **Modified** requirement `Exactly one coupon applies`: the claim that the
  result never depends on the order of entries in the catalog is narrowed to
  what the rest of the specification actually says. Two entries sharing a
  normalised code resolve to the first (AC-33, AC-54), which is a dependence on
  catalog order; the promise holds for every catalog whose normalised codes are
  unique. The two statements as they stood answered the same question
  differently.
- **New** scenario `AC-62`, pinning `Number.MAX_VALUE`.
- **New** decision D-34 and criterion AC-62 in `docs/spec/pricing-discounts.md`,
  with the capacity-bound paragraph of section 3, its closed exception list, step
  6, the `priceOrder` JSDoc list and the determinism clause of section 7 amended
  to agree.
- **Changed** production code: the percent branch of `discountFor` clamps before
  it multiplies.

Not a breaking change: for every `value` within the bounds of section 3 the
returned amounts are identical, because `min(idiv(base * value, 100), base)`
already equalled `base` for any `value >= 100`.

## Capabilities

- `order-discounts` — modified.

## Impact

- `docs/spec/pricing-discounts.md` — D-34, AC-62, five cross-reference sites.
- `openspec/specs/order-discounts/spec.md` — two requirements modified, one
  scenario added, on archive.
- `app/src/discounts.ts` — the percent branch of `discountFor`.
- `app/src/discounts.test.ts` — one test added.
- `docs/traceability.md` — one row added, counts and reverse check updated.
