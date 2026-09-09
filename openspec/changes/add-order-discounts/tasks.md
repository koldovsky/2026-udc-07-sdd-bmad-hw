## 1. Contract and helpers

- [x] 1.1 Create `app/src/discounts.ts` with the types from design.md — `CouponRejectionReason`, `AppliedCoupon`, `RejectedCoupon`, `PriceBreakdown` — importing `Order`/`LineItem`/`Coupon` from `./types.js` without altering them; verify `cd app && npm run typecheck` passes
- [x] 1.2 Add the integer rounding helper `roundHalfUp(base, percent) = Math.floor((base * percent + 50) / 100)` (D-4) and a per-category subtotal helper built on `lineTotalKopecks` from `./pricing.js`; verify AC-5 and AC-6 exercise the half-kopeck path once tests exist
- [x] 1.3 Confirm no float arithmetic on amounts anywhere in the file — grep for `/ 100` and `*` sites and check each stays integer; verify by review plus the AC-16 invariant assertions

## 2. Tier discount

- [x] 2.1 Compute `subtotalKopecks`, `shippingKopecks` and `tierPercent` by calling the existing `./pricing.js` functions rather than reimplementing them (protected contract); verify the 8 existing tests in `pricing.test.ts` still pass untouched
- [x] 2.2 Apply the tier percentage to the item subtotal, all categories included, and never to shipping (D-2, D-16); verify tests `AC-1`, `AC-5` and `AC-17` pass

## 3. Coupon resolution and refusal

- [x] 3.1 Resolve each code in `order.coupons` against the catalog by exact, case-sensitive match, preserving typing order (D-10, D-13); verify test `AC-8` (`unknown`) passes
- [x] 3.2 Refuse an expired coupon using `now >= expiresAt` with the injected `now` (D-8, D-11) without throwing; verify boundary test `AC-7` passes
- [x] 3.3 Refuse below-minimum coupons against the gross subtotal, inclusive `>=` (D-6); verify tests `AC-9` and `AC-10` pass
- [x] 3.4 Refuse a repeated code as `duplicate-code` and a second coupon on an occupied scope as `duplicate-scope` (D-3, D-14); verify tests `AC-14` and `AC-3` pass
- [x] 3.5 Refuse a coupon whose scope carries no amount as `no-eligible-items` (D-15); verify tests `AC-12` (empty order) and `AC-13` (absent category) pass

## 4. Coupon discounts

- [x] 4.1 Apply each accepted coupon sequentially to the amount remaining after the tier discount (D-1); verify test `AC-2` shows 13_500 rather than the additive 25% result
- [x] 4.2 Scope a category coupon to its own post-tier category base, decrementing that base as well as the running remainder (D-5, D-5a); verify test `AC-11` yields 5_400, not 6_000 or 13_500, and test `AC-15` reaches a total of 79_500 with three codes in typed order
- [x] 4.3 Clamp a fixed coupon to its scope's remaining amount and to the running remainder, reporting the clamped figure (D-7, D-12); verify boundary test `AC-4` reports 30_000 and a total of 4_900
- [x] 4.4 Floor the discounted item amount at 0 and add shipping afterwards so the total never dips below the shipping fee (D-7); verify `AC-4` and the `total >= shipping` clause of `AC-16`

## 5. Breakdown and invariants

- [x] 5.1 Return the full `PriceBreakdown` including per-coupon amounts and refusal reasons (D-18), keeping the function pure — no mutation of `order` or `catalog` (D-17); verify by asserting deep equality of the inputs before and after a call
- [x] 5.2 Assert the reconciliation invariant on every test fixture: `subtotal − tier − coupons + shipping === total`, `total >= shipping`, and each typed code appearing exactly once across applied and refused (D-19); verify test `AC-16` runs against all fixtures, not one
- [x] 5.3 Re-export the public surface from `app/src/index.ts`; verify `npm run typecheck` passes and the export is importable

## 6. Tests named after acceptance criteria

- [x] 6.1 Create `app/src/discounts.test.ts` with one test per criterion, each named `AC-N: <description>` so the spec link shows in vitest output; verify `cd app && npm test` lists AC-1…AC-19 and is green
- [x] 6.2 Confirm every number in the tests is taken from `docs/spec/pricing-discounts.md` §4 rather than from running the code; verify each expected figure against the AC table by review
- [x] 6.3 Check no test exists that maps to no acceptance criterion and no criterion lacks a test; verify by listing test names against AC-1…AC-19

## 7. Traceability and verification

- [x] 7.1 Fill `docs/traceability.md` from `docs/templates/traceability.md`: AC → code → test for all 19 criteria with no empty cells; verify every referenced symbol and test name exists
- [x] 7.2 Do the reverse check — behaviour in code no AC asked for, an AC with no test, a test with no AC — and record what was found and what was done about it; verify the section is filled in rather than asserted empty
- [x] 7.3 Run `cd app && npm test` and `npm run typecheck` green, and confirm `git diff` shows no change to `app/src/pricing.ts`, `app/src/types.ts` or `materials/feature-request.md`
