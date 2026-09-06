## Why

`docs/spec/pricing-discounts.md` answered one question twice, and differently.

Section 3 lists `coupon.code` as a caller guarantee ("`coupon.code` — рядок")
and then names the closed set of decisions that survive a broken level-2 value:
D-20, D-24, D-25, D-27, D-28, D-29, D-30, D-31, D-32. A catalog `code` that is
not a string is in none of them, so by section 3 the behaviour is undefined.
Section 7 and the `priceOrder` JSDoc say the opposite, in bold: *any* bad value
inside a correct shape never throws, and "зіпсований запис у каталозі не обвалює
сторінку оформлення ніколи".

Step 5 compares catalog codes normalised. An implementer following section 3
writes `entry.code.trim().toUpperCase()` and a `TypeError` escapes `priceOrder`
on `code: null`, taking the checkout page down with it. An implementer following
section 7 writes `String(entry.code ?? "")` and prices the order. Both can cite
the document.

This is the same argument D-29 already makes for the other side of the same
comparison — `order.coupons` — where the fork was closed explicitly. The catalog
side was left open.

The gap was found by the specification-ambiguity reviewer built for Task E
(`docs/task-e/spec-ambiguity-reviewer.md`), reading the specification alone with
no access to the code. Section 11 of the specification prescribes the order of
repair: decision and criterion first, then the test, then the code.

## What Changes

- **Modified** requirement `Malformed catalog data never raises the total`: a
  catalog entry whose `code` is not a string is now specified as unreachable
  rather than undefined — it normalises to the empty string, matches nothing,
  and raises no exception.
- **New** scenario `AC-61`, covering both a corrupt entry sitting in front of a
  valid one and a corrupt entry alone in the catalog.
- **New** decision D-33 and criterion AC-61 in `docs/spec/pricing-discounts.md`,
  with the exception lists of sections 3, 6 and 7 amended to agree.
- **New** test named `AC-61` in `app/src/discounts.test.ts`.
- **No** production-code change is expected: `normaliseCode` in
  `app/src/discounts.ts` already accepts `unknown` and returns `""` for a
  non-string. The engine chose the safe branch that the specification did not
  require; this change makes the requirement match the behaviour and pins it
  with a test.

Not a breaking change: no behaviour that exists today changes.

## Capabilities

- `order-discounts` — modified.

## Impact

- `docs/spec/pricing-discounts.md` — D-33, AC-61, four cross-reference lists.
- `openspec/specs/order-discounts/spec.md` — one requirement modified, one
  scenario added, on archive.
- `app/src/discounts.test.ts` — one test added.
- `docs/traceability.md` — one row added, counts updated.
- `app/src/discounts.ts` — unchanged, verified against the new criterion.
