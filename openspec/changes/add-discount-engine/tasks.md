## 1. Module skeleton

- [ ] 1.1 Create `app/src/discounts.ts` exporting `RejectionReason`,
  `RejectedCoupon` and `PriceBreakdown` exactly as declared in section 6 of
  `docs/spec/pricing-discounts.md`, and verify `npm run typecheck` passes with
  no `any`
- [ ] 1.2 Add the `idiv(x, 100)` helper as `(x - (x % 100)) / 100` and verify by
  unit test that `idiv(999 * 50, 100)` is 499, so no floating-point division
  enters the arithmetic
- [ ] 1.3 Add a `categoryTotal` map built in one pass over `order.items` using
  `lineTotalKopecks` from `pricing.ts`, and verify an item whose category is
  outside the union lands in the subtotal but in no category total (AC-50)
- [ ] 1.4 Re-export the three types with `export type` and `priceOrder` with
  `export` from `app/src/index.ts`, and verify `npm run typecheck` passes

## 2. Typed-code normalisation

- [ ] 2.1 Normalise each entry of `order.coupons`: replace a non-string with an
  empty string, then `trim()` and upper-case; verify against AC-41
- [ ] 2.2 Drop entries that are empty after normalisation; verify against AC-22
- [ ] 2.3 Collapse duplicates keeping first-occurrence order, and retain the raw
  first-occurrence string for each unique code; verify against AC-9 and AC-29

## 3. Catalog lookup

- [ ] 3.1 Match each unique code against `catalog` on the normalised code,
  taking the first match; verify against AC-33 and AC-54
- [ ] 3.2 Reject a code with no match as `unknown`, carrying the raw typed
  string verbatim; verify against AC-8 and AC-29
- [ ] 3.3 Confirm lookup runs before every other check by verifying AC-45, where
  `now` is an `Invalid Date` and the reason is still `unknown`

## 4. Expiry

- [ ] 4.1 Reject every coupon as `expired` when `Number.isNaN(now.getTime())`;
  verify against AC-27
- [ ] 4.2 Reject `expiresAt` that matches neither accepted regex from section 6
  of the specification, including a non-string or missing value; verify against
  AC-17, AC-26 and AC-58
- [ ] 4.3 Reject a non-existent calendar day by rebuilding it with
  `setUTCFullYear` and checking the round trip; verify against AC-46 and confirm
  a real leap day survives with AC-49
- [ ] 4.4 Reject when `now.getTime() >= Date.parse(expiresAt)`; verify against
  AC-4 and confirm one rejection does not block other codes with AC-32

## 5. Minimum-subtotal threshold

- [ ] 5.1 Treat the threshold as present if and only if it is not `undefined`,
  and reject as `min-subtotal` without setting `minSubtotalKopecks` when it is
  not a finite non-negative integer; verify against AC-40 and AC-57
- [ ] 5.2 Compare the threshold with the original subtotal and reject as
  `min-subtotal` carrying that threshold when unmet; verify against AC-15,
  confirm the comparison ignores the coupon's category with AC-35, and confirm
  it uses the subtotal before the tier discount with AC-6
- [ ] 5.3 Confirm a threshold of 0 counts as present and met (AC-39) and that
  expiry is reported ahead of the threshold (AC-56)

## 6. Discount base and amount

- [ ] 6.1 Choose the base: `remainder` when `coupon.category === undefined`,
  otherwise `idiv(categoryTotal(category) * (100 - tierPercent(order)), 100)`;
  verify the `undefined` comparison with AC-51 and AC-52, the whole-order base
  with AC-2 and AC-23, and the category base with AC-5
- [ ] 6.2 Compute the discount in this order — non-integer `value` → 0,
  `value <= 0` → 0, `percent` → `min(idiv(base * value, 100), base)`, `fixed` →
  `min(value, base)`, any other `kind` → 0; verify against AC-37, AC-25 and
  AC-42, the fractional `fixed` value with AC-38, and the downward rounding of
  a percentage discount with AC-13
- [ ] 6.3 Confirm the clamp holds at both ends by verifying AC-12, AC-24,
  AC-53 and the fixed-value clamp to a category base with AC-20
- [ ] 6.4 Confirm the base rounds down exactly once by verifying AC-19 and AC-36

## 7. Selection and rejection

- [ ] 7.1 Reject every zero-discount coupon, choosing `no-effect` when
  `scopeTotal` is 0 and `too-small` when it is above 0; verify against AC-11,
  AC-18, AC-21 and AC-31
- [ ] 7.2 Select the largest remaining discount, breaking ties towards the code
  typed earlier, and reject the rest as `superseded`; verify against AC-3, AC-16
  and AC-55
- [ ] 7.3 Sort `rejectedCoupons` by the order the codes were typed rather than
  the order reasons arose; verify against AC-30
- [ ] 7.4 Set `appliedCouponCode` to the winning catalog entry's `code` verbatim,
  or `null`; verify against AC-10, AC-28 and AC-54

## 8. Breakdown assembly

- [ ] 8.1 Compute
  `totalKopecks = subtotal - tierDiscount - couponDiscount + shippingKopecks(order)`
  using the seeded `shippingKopecks`; verify against AC-1, AC-7 and AC-34
- [ ] 8.2 Return a freshly built object sharing no reference with `order` or
  `catalog`, and omit `minSubtotalKopecks` rather than setting it to
  `undefined`; verify by an object-equality assertion in AC-40
- [ ] 8.3 Confirm an empty order prices to 0 with and without a typed code
  (AC-14, AC-21) and that an empty catalog still prices correctly (AC-44)

## 9. Invariants and full-suite verification

- [ ] 9.1 Add the accounting test for I-1 and I-4 covering nine typed codes and
  six rejections; verify against AC-47
- [ ] 9.2 Add the purity, identity and safe-integer test for I-2, I-3 and I-5;
  verify against AC-48, and confirm the upper input bound with AC-43
- [ ] 9.3 Verify every criterion AC-1 through AC-58 has a test named after it and
  that `cd app && npm test` is green, including the 8 seeded `pricing` tests
- [ ] 9.4 Verify `app/src/pricing.ts`, `app/src/types.ts` and
  `materials/feature-request.md` are unchanged with `git diff --stat`

## 10. Traceability

- [ ] 10.1 Fill `docs/traceability.md` from the template with one row per
  criterion pointing at real code and a real test, and verify no cell is empty
- [ ] 10.2 Run the reverse check — behaviour in code no criterion asked for, a
  criterion with no test, a test mapping to no criterion — and record what was
  found and what was done about it
