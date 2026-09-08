## 1. Scaffolding

- [ ] 1.1 Create `app/src/discounts.ts` importing `Order`, `Coupon` from
      `./types.js` and `subtotalKopecks`, `shippingKopecks`, `tierPercent`
      from `./pricing.js`; export the `PriceBreakdown` interface from
      `specs/discounts/spec.md`. Verify: file compiles (`npm run
      typecheck`).
- [ ] 1.2 Create `app/src/discounts.test.ts` with the shared `order`/`item`
      test builders (matching the style already used in
      `pricing.test.ts`) plus a `coupon()` builder. Verify: file compiles
      and an empty `describe` block runs under `npm test`.
- [ ] 1.3 Export `PriceBreakdown` and `priceOrder` from `app/src/index.ts`
      alongside the existing exports. Verify: `npm run typecheck` passes.

## 2. Coupon resolution

- [ ] 2.1 Implement resolution of `order.coupons` against the `coupons`
      catalog: catalog lookup by exact `code` (case-sensitive, D-14/spec),
      dedupe by first occurrence (D-11), drop codes with no catalog match
      (D-9), drop expired coupons using the `now` parameter (D-8/D-13),
      drop coupons whose `minSubtotalKopecks` exceeds the order's original
      `subtotalKopecks` (D-6). Verify: AC-4, AC-5, AC-9, AC-10 tests pass.

## 3. Discount calculation

- [ ] 3.1 Implement the order-wide bucket: sum `tierPercent(order)` and the
      percentages of resolved coupons with no `category`, cap at 100%,
      compute `floor(subtotalKopecks * percent / 100)`, then add the sum
      of resolved fixed-kind order-wide coupon values. Verify: AC-1, AC-2
      tests pass.
- [ ] 3.2 Implement per-category buckets: group resolved category-scoped
      coupons by `category`, compute each category's original subtotal
      from `order.items`, apply the same additive-percent-plus-fixed rule
      as 3.1 but against that category's subtotal. Verify: AC-3 test
      passes (two coupons, same category).
- [ ] 3.3 Handle a category coupon whose category has zero matching items
      (category subtotal is 0, contributes 0 to the discount, no special
      case needed if 3.2 is implemented generically). Verify: dedicated
      test for "category coupon with no matching items" passes.
- [ ] 3.4 Sum the order-wide bucket and all category buckets, cap the
      total at `subtotalKopecks` so the discounted subtotal is never
      negative (D-7). Verify: AC-6 test passes.
- [ ] 3.5 Round every bucket's percent-derived amount down (`Math.floor`),
      never per line item. Verify: AC-8 test passes (exact half-kopeck).

## 4. Assemble the price breakdown

- [ ] 4.1 Implement `priceOrder(order, coupons, now = new Date())`:
      compute `subtotalKopecks`, run coupon resolution (2.1) and discount
      calculation (3.1-3.5), compute `shippingKopecks(order)` unmodified
      (D-2), and return `{ subtotalKopecks, discountKopecks,
      appliedCoupons, shippingKopecks, totalKopecks }` with
      `totalKopecks = subtotalKopecks - discountKopecks +
      shippingKopecks`. Verify: AC-11 test passes (shipping does not
      affect the discount amount).
- [ ] 4.2 Verify `priceOrder` does not throw on an empty order (`items:
      []`). Verify: AC-7 test passes.

## 5. Full acceptance-criteria coverage and traceability

- [ ] 5.1 Confirm every AC-1..AC-11 from `docs/spec/pricing-discounts.md`
      has a corresponding test in `app/src/discounts.test.ts`, named after
      its AC id (e.g. `it("AC-3: two coupons on the same category", ...)`.
      Verify: `cd app && npm test` is green and the AC ids are visible in
      the test output.
- [ ] 5.2 Fill in `docs/traceability.md`: one row per AC mapping to the
      code location and the test that covers it, plus the reverse-check
      questions (behavior without an AC, AC without a test, test without
      an AC). Verify: no empty cells in the table.
