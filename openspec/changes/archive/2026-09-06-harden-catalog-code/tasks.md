## 1. Specification

- [x] 1.1 Add decision D-33 to section 4 of `docs/spec/pricing-discounts.md`,
  stating that a non-string catalog `code` normalises to the empty string and is
  therefore unreachable, and verify the rationale column names the D-29 argument
  it mirrors
- [x] 1.2 Add D-33 to the closed exception list of section 3, to the `priceOrder`
  JSDoc list in section 6 and to the "Стійкість" list in section 7, and verify by
  grep that all four lists now carry the same set of decisions
- [x] 1.3 Add criterion AC-61 to section 5 covering both catalog arrangements,
  and update the count in section 11 from `AC-60` to `AC-61`

## 2. Delta

- [x] 2.1 Restate `Malformed catalog data never raises the total` as a `MODIFIED`
  requirement carrying its full updated text plus scenario AC-61, and verify
  `openspec validate harden-catalog-code --strict` reports the change valid
- [x] 2.2 Verify with `openspec show harden-catalog-code --json --deltas-only`
  that the parser attributes 8 scenarios to the modified requirement — the 7 it
  had plus AC-61

## 3. Test

- [x] 3.1 Add a test named `AC-61: a non-string catalog code is unreachable, not
  fatal` to `app/src/discounts.test.ts`, asserting both arrangements, and verify
  it fails against a deliberately unguarded `coupon.code.trim()` before it passes
  against the current engine
- [x] 3.2 Run `cd app && npm test` and verify every test is green, including the
  8 seeded `pricing` tests

## 4. Traceability

- [x] 4.1 Add the AC-61 row to `docs/traceability.md` pointing at
  `discounts.ts:normaliseCode` and the new test, and update the criterion counts
  and the mechanical AC-1…AC-61 completeness check
- [x] 4.2 Record in the reverse check that the behaviour existed in the code
  before the criterion existed in the specification, and that this is the second
  such finding after AC-59 and AC-60

## 5. Archive

- [x] 5.1 Run `openspec archive harden-catalog-code --yes` and verify
  `openspec/specs/order-discounts/spec.md` now holds the modified requirement
  with 8 scenarios and that `openspec list` reports no active changes
