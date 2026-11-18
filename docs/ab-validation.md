# A/B: with the specification vs ad-hoc (Task D)

> Copied from `docs/templates/ab-validation.md`. The aim is not to prove that
> SDD is better, but to **measure** what it changes on this particular task.

**Feature:** discounts from `materials/feature-request.md`
**Host / model:** Cursor, Agents window / Grok 4.7 Medium (Context 256K). One prompt each, same structure; only the input (spec vs ticket) and the test-naming instruction differed. Run A: Fast off, confirmed by screenshot. Run B: Effort Medium confirmed; Fast was not confirmed by screenshot.

## Run A — with the specification

New chat. The agent was given `docs/spec/pricing-discounts.md` and told to implement it.

- **What came out:** `app/src/discounts.ts` (`priceOrder` + `PriceBreakdown` as in spec section 5), `app/src/discounts.test.ts` with 24 tests AC-1..AC-24, and a re-export from `app/src/index.ts`. 32/32 tests green (24 new + 8 existing), typecheck clean.
- **Decisions on the forks:** matched the spec on every fork. Inside D-13 (undefined behaviour) the agent itself listed two fill-ins: a duplicate catalog code → first wins; an unparseable `expiresAt` → ignored.
- **Tests:** 24 tests named after the real AC ids from that run, including the boundary cases in the spec (half-kopeck, exact threshold, expiry at `now`, empty order, discount larger than the goods).
- **Session:** 5 min (22:34–22:39), 1 message, 1 permission card, 0 corrections. The later reverse-check step (22:42–22:48), which added AC-25..AC-28 as a spec change, is not part of run A.

## Run B — ad-hoc

New chat, in an isolated git worktree from `origin/main`. At the start that tree had no `docs/spec/`, no `openspec/`, no `.agents/`, and no `discounts.ts`. The agent was given only `materials/feature-request.md`. Same host and model. B's code stayed in the worktree and was not committed.

- **What came out:** `app/src/discounts.ts`, `app/src/discounts.test.ts` (32 tests), and `app/src/index.ts` also exporting `AppliedCoupon`, `SkippedCoupon`, and `SkipReason`. 40/40 tests green (32 new + 8 existing), typecheck clean.
- **Forks it decided silently:** tier first, then every typed coupon in typed order on the remaining eligible goods (chained), so two codes on one category both apply and the result depends on typing order. Codes matched case-sensitively with no trim. First catalog row wins for a duplicate code. Floor rounding in integer/BigInt math, and every discount spread across lines by largest remainder. `minSubtotal` checked on the original whole-order subtotal with `>=`. Merchandise never below 0; total = remainder + shipping. Expired, unknown, below-minimum, and duplicate codes are skipped and reported in `skippedCoupons` with a reason; no throw. Unparseable `expiresAt` counts as expired. `now` is optional and defaults to the current time. A fractional percent is handled at 0.01-point precision, a percent above 100 is capped, and a non-integer fixed value becomes 0. Untyped catalog coupons never apply. Extra breakdown fields: `appliedCoupons`, `skippedCoupons`, `discountedSubtotalKopecks`.
- **Tests:** 32 tests the agent itself named "AC-1".."AC-32". No spec existed in that worktree; the numbering was invented from the AGENTS.md naming rule and is unrelated to our AC ids. The tests are green because they encode B's own choices, including boundary cases B invented (invalid percents, unparseable dates, skip reasons).
- **Session:** 8 min (23:05–23:13), 1 message, at least 2 permission cards (a `Test-Path` dependency check, then `npm test` / typecheck), 0 corrections.

## Decision comparison

One row per fork in `docs/spec/pricing-discounts.md`. "A (spec)" is what run A implemented. "B (ad-hoc)" is what run B's code does.

| Fork | A (spec) | B (ad-hoc) | Match? |
|---|---|---|---|
| D-1 stacking tier and coupons | Sequential: tier first on the item subtotal, coupons on the amount after the tier. | Tier first, then coupons. | yes |
| D-2 discount base | Items only. Shipping is added after and is never discounted. | Merchandise is discounted; total = remainder + shipping. | yes |
| D-3 several promo codes | All valid coupons may apply, but only one per scope (whole order, or one category): the larger kopeck discount wins. | Every typed coupon applies, including two codes on the same category, chained in typed order. | no |
| D-4 rounding | Each discount (tier, each coupon) is floored separately in integer kopecks. Breakdown is order-level; per-line allocation is out of scope. | Floor with integer/BigInt math, and every discount is spread across lines by largest remainder. | partial |
| D-7 negative total | No. Coupon discount is capped at the item amount after the tier; shipping is always charged. | Merchandise never below 0; total = remainder + shipping. | yes |
| D-5 category coupon base | `catSubtotal - floor(catSubtotal * tierPercent / 100)`. No per-line split. | Eligible goods of that category after earlier discounts, with each discount spread across lines by largest remainder. | partial |
| D-6 `minSubtotalKopecks` | Whole-order item subtotal before any discount; condition `subtotal >= minSubtotalKopecks`, including for category coupons. | Same: original whole-order subtotal, `>=`. | yes |
| D-8 expired coupon | Silently ignored (contributes 0), no error. User messaging is out of scope. | Skipped, no throw, and reported in `skippedCoupons` with a reason. | partial |
| D-9 expiry clock | Optional `now: Date`, default current time. Valid iff `now < expiresAt`. | Optional `now`, default current time; an expired coupon is skipped. | yes |
| D-10 code matching | Trim + case-insensitive match of typed strings to catalog codes. Unknown ignored. A code typed twice counts once. | Case-sensitive, no trim. Duplicate typed codes are skipped and reported. | no |
| D-11 fixed coupon vs its base | `min(value, base)`. A category missing from the order gives 0. | Merchandise never below 0, so a discount cannot exceed the remaining goods. No contrary behaviour recorded for a missing category. | yes |
| D-12 which categories get the tier | All item categories (`standard`, `fresh`, `digital`); not shipping. | Tier is applied before coupons; shipping is not discounted. No category exception recorded. | yes |
| D-13 invalid coupon data | Out of scope: undefined behaviour. Run A filled in two cases only: duplicate catalog code → first wins; unparseable `expiresAt` → ignored. | Defined: first catalog row wins; unparseable `expiresAt` = expired; fractional percent at 0.01-point precision; percent > 100 capped; non-integer fixed value → 0. | no |
| D-14 empty order | All amounts 0, total 0. | Same outcome: no items means nothing to discount and shipping stays 0. | yes |
| D-15 coupon not yet active | No start date on `Coupon`. Any non-expired coupon is active; start dates are out of scope. | No start-date gate. A non-expired coupon can apply. | yes |
| D-16 different scopes | Each coupon is computed from its own base after the tier, independently of the others; the sum is then capped. Result does not depend on typing order. | Chained: each coupon applies to the remaining eligible goods after the previous one, so typing order changes the amount. | no |
| D-17 untyped catalog coupon | A `Coupon` applies only if the customer typed its code. | Untyped catalog coupons never apply. | yes |
| API / contract | `priceOrder` returns `PriceBreakdown`: subtotal, tier discount, coupon discount, shipping, total. Re-export from `index.ts` only. | Same entry point, plus exports `AppliedCoupon`, `SkippedCoupon`, `SkipReason`, and extra fields `appliedCoupons`, `skippedCoupons`, `discountedSubtotalKopecks`. | no |
| Test naming | 24 tests named `AC-1`..`AC-24`, matching the spec ids that existed for this run. | 32 tests named `AC-1`..`AC-32` with no spec present. Invented numbering, unrelated to our AC ids. | no |

Evidence: B's engine was run on the spec scenarios (a temporary test in the worktree). A's figures are the spec values, already verified by A's tests. Amounts are kopecks (coupon discount / total).

| Scenario | A (spec) | B (ad-hoc) |
|---|---|---|
| AC-4 typed `[A, B]` | 6 000 / 48 900 | 11 000 / 43 900 |
| AC-4 typed `[B, A]` | 6 000 / 48 900 | 10 400 / 44 500 (depends on typing order) |
| AC-5 | 2 850 / 49 550 | 5 350 / 47 050 |
| AC-7, both typing orders | 16 200 / 78 700 | 15 480 / 79 420 |
| AC-19 `"  save10 "` | 2 000 / 22 900 | 0 / 24 900 |

## Time and effort

Spec preparation is Task A only (21:26–21:48), including four rounds of decision questions. OpenSpec (Task B) is not counted.

| | A (with the spec) | B (ad-hoc) |
|---|---|---|
| Preparation time (writing the spec) | 22 min | 0 |
| Implementation time | 5 min | 8 min |
| Iterations / corrections after the first answer | 0 | 0 |
| Total | 27 min | 8 min |

## Conclusion

Run B silently decided four forks differently from the spec (D-3, D-10, D-13, D-16) and two only partly (per-line allocation on D-4 and D-5, which the spec leaves out of scope, and D-8, where B adds `skippedCoupons` reasons that the spec treats as user messaging and out of scope), and it also shipped an API the spec did not ask for. The money impact is visible: on AC-4, B takes 50 UAH more off than A (11 000 vs 6 000 kopecks) and the amount changes with typing order (10 400 kopecks when B is typed first). On review without the spec the difference would likely go unnoticed: B's tests are green and even named AC-N, but they encode B's own choices. The spec cost 22 minutes against a 5–8 minute implementation; it paid off here because the diverging forks are business rules, but a good ticket that answered just D-3, D-10, D-13 and D-16 would likely have been enough for a feature this size.
