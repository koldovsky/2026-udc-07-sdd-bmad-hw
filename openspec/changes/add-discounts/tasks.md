## 1. Close the remaining forks in the source specification

- [x] 1.1 Add the decisions closed during this proposal to the table in `docs/spec/pricing-discounts.md` §3 as D-11…D-16 — rounding applied at each discount step and per category bucket; an unknown typed code is ignored; a repeated code applies once; a category coupon computes from that category's amount remaining after earlier discounts; an order-wide fixed coupon is allocated by largest remainder; an expired coupon throws `ExpiredCouponError`. Verify each row states the question, the decision, and why
- [x] 1.2 Add AC-9…AC-13 to `docs/spec/pricing-discounts.md` §4 with the concrete numbers from `specs/pricing-discounts/spec.md` (AC-9 rounding at each step, AC-10 repeated code, AC-11 unknown code, AC-12 order-wide fixed allocation, AC-13 tier discount reaching every category). Verify every scenario in the delta spec maps to exactly one AC id

## 2. Contract and helpers

- [x] 2.1 Create `app/src/discounts.ts` exporting the `PriceBreakdown` interface exactly as specified in `docs/spec/pricing-discounts.md` §5, and verify `npm run typecheck` passes with the file importing `Order`/`Coupon` from `./types.js`
- [x] 2.2 Add the exported `ExpiredCouponError` class carrying a `code` property and naming the code in its message, and verify a test asserts both `instanceof ExpiredCouponError` and `err.code`
- [x] 2.3 Add the internal `percentOfCeil(baseKopecks, percent)` helper as the single rounding site, and verify unit assertions cover an exact case and a fractional one (5% of 3 333 → 167)
- [x] 2.4 Add the internal category-bucket ledger — build buckets from line totals, expose the order-wide remaining amount, and deduct per bucket — and verify buckets for a mixed `standard`/`fresh` order sum to `subtotalKopecks(order)`

## 3. Coupon resolution

- [x] 3.1 Resolve `order.coupons` against the catalogue in typed order, dropping unknown codes and deduplicating by code, first catalogue entry winning on collision; verify with the AC-10 and AC-11 tests
- [x] 3.2 Reject expired coupons during resolution, before any eligibility or amount check, throwing `ExpiredCouponError` for the first expired code in typed order; verify with both AC-2 tests, including the expired-plus-unmet-threshold case

## 4. Discount evaluation

- [x] 4.1 Apply the tier discount per bucket using `tierPercent`, reporting the sum as `tierDiscountKopecks`; verify with the AC-1 tests, including that shipping stays outside the discount base
- [x] 4.2 Apply each resolved coupon in typed order against the ledger — percent per bucket, fixed by value, category coupons on their bucket only; verify with the AC-3, AC-7 and AC-13 tests
- [x] 4.3 Check `minSubtotalKopecks` against the order-wide remaining amount at the moment the coupon is reached, skipping silently when unmet; verify with the AC-6 and AC-8 tests
- [x] 4.4 Skip whole any coupon whose discount would exceed the amount available in its scope, leaving other coupons unaffected; verify with the AC-4 test
- [x] 4.5 Allocate an order-wide fixed discount across buckets by proportional share plus largest-remainder distribution, ties in the order `standard`, `fresh`, `digital`; verify with the AC-12 test
- [x] 4.6 Assemble the breakdown — pre-discount subtotal, tier discount, coupon discount, existing shipping, and the total as their sum — and verify the AC-5 empty-order test returns all zeros

## 5. Wire up and verify

- [x] 5.1 Re-export `priceOrder`, `PriceBreakdown` and `ExpiredCouponError` from `app/src/index.ts`, and verify a test imports them from the package entry point
- [x] 5.2 Write `app/src/discounts.test.ts` with one test per acceptance criterion, each test named after its AC id (e.g. `AC-3: two coupons on the same category`), and verify the AC ids are visible in `npm test` output
- [x] 5.3 Run `cd app && npm test && npm run typecheck` and verify the 8 pre-existing tests in `pricing.test.ts` still pass untouched alongside the new ones
- [x] 5.4 Grep the implementation for floating-point money handling and verify every returned amount is an integer — no `toFixed`, no non-kopeck units, and `percentOfCeil` the only division

## 6. Documentation

- [x] 6.1 Fill in `docs/traceability.md` with a row per acceptance criterion pointing at the real function and the real test name, plus the reverse check listing any code with no AC behind it; verify no AC row is empty
- [x] 6.2 Record the OpenSpec run in `docs/sdd-tool.md` — tool chosen, artifacts produced under `openspec/changes/add-discounts/`, and how the ambiguities were closed during proposal; verify the paths named in the doc exist
