## Context

The engine implements step 6 of `docs/spec/pricing-discounts.md` literally:

```ts
if (coupon.kind === "percent") return Math.min(idiv(base * coupon.value), base);
```

Three guards run before it. `Number.isInteger(coupon.value)` rejects `NaN`,
`Infinity` and fractions (D-27); `coupon.value <= 0` rejects zero and negatives
(D-23). Neither rejects a finite integer that is merely enormous, and
`Number.MAX_VALUE` is such a number.

Section 3 classifies the `value` ceiling (10 000 for `percent`) as a *capacity*
bound rather than a *correctness* bound. The difference is defined in that
section: violating a capacity bound may make the calculation slower or its
intermediate numbers larger, but the result stays right. The justification given
was that the clamp `min(…, base)` absorbs any oversized `value`.

That justification does not survive the transition from "large" to "non-finite".
IEEE-754 multiplication saturates to `Infinity`, and every operation downstream
inherits it: `idiv(Infinity, 100)` is `NaN` because `Infinity % 100` is `NaN`,
and `Math.min(NaN, base)` is `NaN`. The clamp cannot absorb what it can no
longer compare.

## Goals / Non-Goals

- **Goal:** no input matching the argument shapes of section 3 can put a
  non-finite value into any field of `PriceBreakdown`.
- **Goal:** the amounts returned for every in-bounds input stay bit-identical.
- **Non-Goal:** validating the catalog. D-18 stands — a broken row costs a
  discount, and is repaired in the catalog, not in the engine.
- **Non-Goal:** raising an error for an oversized `value`. The engine has one
  failure direction, stated in D-18, D-27, D-28, D-33: give no discount, never
  break the page.

## Decisions

### D-34 — clamp the percentage before multiplying

`value >= 100` returns `base`. Otherwise the discount is `idiv(base * value, 100)`
as before.

**Why 100 and not the section 3 ceiling of 10 000.** 100 is the point at which
the answer stops depending on `value` at all: a percentage of 100 or more of
`base` is `base`, and the clamp was already producing exactly that. Choosing the
capacity ceiling instead would leave the products between 100 and 10 000 being
formed for no reason, and would tie the arithmetic to a bound that section 3
describes as a soft one.

**Why not `Number.isSafeInteger` in the D-27 guard.** That would reject the
oversized `value` earlier and give the same total by a different route — the
coupon would be rejected as `too-small` rather than applied at `base`. It was
not chosen because it changes the answer for values between `MAX_SAFE_INTEGER`
and the overflow point, where the current engine applies the coupon at `base`
and the specification's D-18 says an oversized `value` "gives exactly `base`,
however large it is". Clamping keeps that promise; tightening the integer guard
would break it.

**Why the alternative of computing in a different order was rejected.**
`idiv(base, 100) * value` avoids `Infinity` for a wider range but changes the
result for in-bounds inputs — it rounds before multiplying, which is precisely
what D-4 and D-5 forbid.

## Risks / Trade-offs

- The engine now has a branch that no in-bounds input reaches, which is a branch
  that could rot. It is pinned by AC-62 and visible in the coverage report; the
  reverse check of `docs/traceability.md` records it.
- The fix hides an input that is, by section 3, a caller defect. It stays hidden:
  the coupon still applies at `base`, so a catalog row carrying `MAX_VALUE`
  behaves like any other oversized percentage. Detecting bad catalog rows is O-3,
  which the specification leaves open on purpose.

## Migration Plan

None. No stored data, no API shape and no in-bounds amount changes.

## Open Questions

None. O-3 of the specification — who owns catalog validation — already covers
the input that produced this defect.
