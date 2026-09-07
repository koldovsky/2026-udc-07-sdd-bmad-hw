## 1. Specification

- [x] 1.1 Add decision D-34 to section 4 of `docs/spec/pricing-discounts.md`,
  stating that a percentage `value` of 100 or more yields `base` without forming
  the product, and verify the rationale names the `Infinity` → `NaN` chain it
  removes
- [x] 1.2 Correct the capacity-bound paragraph of section 3, which claimed an
  oversized `value` cannot affect the result, and add D-34 to the closed
  exception list of section 3 and to the `priceOrder` JSDoc list in section 6
- [x] 1.3 Rewrite the percent branch of step 6 so the clamp precedes the
  multiplication
- [x] 1.4 Narrow the determinism clause of section 7: catalog order affects the
  result in exactly one defined case — two entries sharing a normalised code,
  where the first wins (D-18, AC-33, AC-54)
- [x] 1.5 Add criterion AC-62 to section 5 and update the count in section 11
  from `AC-61` to `AC-62`

## 2. Delta

- [x] 2.1 Restate `Every discount is a whole number of kopecks, rounded down` as
  a `MODIFIED` requirement carrying its full updated text plus scenario AC-62
- [x] 2.2 Restate `Exactly one coupon applies` as a `MODIFIED` requirement whose
  order-independence sentence agrees with AC-33 and AC-54
- [x] 2.3 Verify `openspec validate clamp-percent-before-multiply --strict`
  reports the change valid, and that `openspec show --json --deltas-only`
  attributes 6 scenarios to the first modified requirement and 4 to the second

## 3. Test

- [x] 3.1 Add a test named `AC-62: an out-of-range percentage cannot make the
  total NaN` to `app/src/discounts.test.ts`, asserting the discount equals the
  base and every numeric field satisfies `Number.isSafeInteger`
- [x] 3.2 Verify the test fails against the pre-change formula and passes against
  the clamped one

## 4. Code

- [x] 4.1 Clamp before multiplying in the percent branch of `discountFor` in
  `app/src/discounts.ts`, and update the decision ids in the file header and the
  `priceOrder` JSDoc
- [x] 4.2 Run `cd app && npm test` and `npm run typecheck`; verify all tests are
  green and branch coverage of `discounts.ts` is still 100%

## 5. Traceability

- [x] 5.1 Add the AC-62 row to `docs/traceability.md`, update the counts and the
  mechanical AC-1…AC-62 completeness check
- [x] 5.2 Record in the reverse check that this finding came from the automated
  reviewer on the pull request, and that it is a false promise in the
  specification rather than a missing criterion

## 6. Archive

- [x] 6.1 Run `openspec archive clamp-percent-before-multiply --yes` and verify
  `openspec/specs/order-discounts/spec.md` carries both modified requirements and
  62 scenarios, and that `openspec list` reports no active changes
