## 1. Contract scaffolding

- [ ] 1.1 Create `app/src/discounts.ts` exporting the `CouponRejectionReason` union, `AppliedCoupon`, `RejectedCoupon` and `PriceBreakdown` interfaces exactly as specified in `docs/spec/pricing-discounts.md` §5 — verify with `cd app && npm run typecheck` (no errors, no `any` in the public shape)
- [ ] 1.2 Implement and export `roundKopecks(value: number): number` as `Math.floor(value + 0.5)` with a comment citing D-4 — verify `roundKopecks(202.5) === 203`, `roundKopecks(202.4) === 202`, `roundKopecks(475.1) === 475`
- [ ] 1.3 Add the `priceOrder(order, catalog, now = new Date())` signature returning a stubbed breakdown — verify the file imports `subtotalKopecks`, `shippingKopecks`, `tierPercent` from `./pricing.js` and imports nothing else beyond `./types.js`

## 2. Core pricing pipeline

- [ ] 2.1 Compute `subtotalKopecks(order)` and seed the `remaining` accumulator; apply the tier discount as `min(remaining, roundKopecks(subtotal * tierPercent(order) / 100))` (D-1, D-15) — verify AC-1 and AC-2 pass
- [ ] 2.2 Call `shippingKopecks(order)` on the original order and add it only after all discounts; assemble `totalKopecks = remaining + shipping` (D-2, D-16) — verify AC-4 and AC-19 pass
- [ ] 2.3 Fold accepted coupons over the same `remaining` accumulator in `order.coupons` entry order, subtracting `min(raw, base, remaining)` each step (D-1, D-7, D-18) — verify AC-3 and AC-7 pass
- [ ] 2.4 Implement the category base as `roundKopecks(categorySubtotal * remaining / subtotal)`, guarded to 0 when `subtotal === 0`; order-wide coupons use `remaining` directly (D-5, D-19) — verify AC-5 and AC-14 pass

## 3. Coupon admission rules

- [ ] 3.1 Resolve each entered code against `catalog` by exact match, first entry winning on duplicates; unresolved codes reject as `unknown` (D-10, D-22) — verify AC-15 and AC-22 pass
- [ ] 3.2 Reject repeat occurrences of an already-seen code as `duplicate_code` (D-11) — verify AC-16 passes
- [ ] 3.3 Reject `percent` values outside 0–100, `fixed` values `<= 0`, and unparseable `expiresAt` as `invalid_value`, with no clamping (D-13, D-21) — verify AC-18 and AC-21 pass, and that AC-21 asserts `invalid_value` rather than `expired`
- [ ] 3.4 Reject coupons where `now >= Date.parse(expiresAt)` as `expired`, using the injected instant, never an ambient clock read (D-8, D-9) — verify AC-10 passes at both the `expiresAt` boundary and one second before it
- [ ] 3.5 Reject coupons whose `minSubtotalKopecks` exceeds the **pre-discount** subtotal as `below_min_subtotal`, inclusive comparison (D-6) — verify AC-8 and AC-9 pass, including the exact-threshold case
- [ ] 3.6 Track used scopes in a `Set` keyed by `coupon.category ?? "ORDER"`; reject later coupons in a used scope as `duplicate_scope` (D-3) — verify AC-6 passes
- [ ] 3.7 Reject coupons whose computed base is 0 as `no_matching_items`, while still admitting a non-zero base that rounds down to a 0 discount (D-12, D-14, design D-I) — verify AC-17 and AC-12 pass
- [ ] 3.8 Enforce the fixed check order `unknown → duplicate_code → invalid_value → expired → below_min_subtotal → duplicate_scope → no_matching_items` (D-17) — verify with a coupon that fails two checks at once that the earlier reason is the one reported

## 4. Test suite by acceptance criterion

- [ ] 4.1 Create `app/src/discounts.test.ts` using `vitest` (`describe`/`it`/`expect`, matching `pricing.test.ts`), with one test per criterion, each named with its id as the prefix (e.g. `AC-6: two coupons on the same category → duplicate_scope`) — verify every id `AC-1` … `AC-22` appears exactly once in the output of `npm test -- --reporter=verbose`
- [ ] 4.2 Cover the four boundary criteria explicitly: AC-11 (discount exceeds order), AC-12 (empty order), AC-13/AC-14 (half-kopeck rounding), AC-21 (malformed date) — verify each asserts concrete kopeck figures, not relative comparisons
- [ ] 4.3 Assert the AC-20 balance invariant as a shared helper applied to the result of every other test — verify it checks integrality, non-negativity, the subtotal/discount/shipping identity and the `appliedCoupons` sum
- [ ] 4.4 Re-export `priceOrder` and its types from `app/src/index.ts` — verify `npm test` still passes and the export resolves under NodeNext

## 5. Verification and traceability

- [ ] 5.1 Run `cd app && npm test` — verify all 8 pre-existing `pricing.test.ts` tests still pass alongside the new suite, with zero failures
- [ ] 5.2 Confirm the frozen contract is untouched — verify `git diff --stat app/src/pricing.ts app/src/types.ts` produces no output
- [ ] 5.3 Fill `docs/traceability.md` mapping each `AC-N` → implementing code location → test name, with no empty cells
- [ ] 5.4 Run the reverse check — verify that no behaviour exists in `discounts.ts` that no AC requires, that every AC has a test, and that every test maps to an AC; record any discrepancy and its resolution in `docs/traceability.md`
- [ ] 5.5 Run `openspec validate add-pricing-discount-engine --strict` — verify it reports the change as valid before archiving



