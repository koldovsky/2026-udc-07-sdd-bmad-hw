## 1. Module skeleton

- [ ] 1.1 Add `app/src/discounts.ts` exporting `PriceBreakdown` and `priceOrder(order, catalog, asOf)` with the six integer fields; verify `cd app && npm run typecheck` succeeds
- [ ] 1.2 Re-export `priceOrder` and `PriceBreakdown` from `app/src/index.ts` using `.js` relative imports; verify the public barrel compiles and does not change `types.ts` or `pricing.ts` signatures

## 2. Engine

- [ ] 2.1 Implement integer half-up `percentToKopecks` privately and apply the Gold/Silver tier to goods via existing `subtotalKopecks` and `tierPercent`; verify AC-1, AC-9, and AC-10 in `discounts.test.ts`
- [ ] 2.2 Add shipping from existing `shippingKopecks` after remaining goods (never discount shipping); verify AC-1 (UA 4_900), AC-8 (empty cart 0), and AC-10 (PL 19_900)
- [ ] 2.3 Apply typed catalog codes sequentially on remaining goods (percent then fixed in input order, cap at remaining); verify AC-5 and AC-11
- [ ] 2.4 Resolve codes with trim + case-insensitive match, skip unknown/expired (`asOf >= expiresAt`)/duplicates/missing category, never throw; verify AC-2, AC-12, and AC-13
- [ ] 2.5 Category base from original category line totals, `minSubtotalKopecks` against original goods subtotal; verify AC-3, AC-6, AC-7, and AC-14
- [ ] 2.6 Floor remaining goods at 0; verify AC-4 (fixed 50_000 on 10_000 goods → total 4_900)

## 3. Tests and suite

- [ ] 3.1 Cover AC-1 … AC-14 as `it("AC-N: …")` in `app/src/discounts.test.ts` with the numbers from `docs/spec/pricing-discounts.md`; verify each ID appears in `cd app && npm test` output
- [ ] 3.2 Run `cd app && npm test` and confirm the original 8 `pricing.test.ts` cases stay green
