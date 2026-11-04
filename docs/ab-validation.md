# A/B Validation: Checkout Discounts

**Feature:** [Discount request](../materials/feature-request.md)

**Host and model:** Codex desktop, `gpt-6.1-sol` in both successful runs.

## Run A: With the Specification

- The Task C chat implemented [the Task A specification](spec/pricing-discounts.md) using the OpenSpec plan; its result is commit `ca9bfc6`.
- `app/src/discounts.ts` selects the best eligible coupon, applies loyalty to the remainder, and adds shipping unchanged.
- All 22 tests passed on rerun: eight seeded tests and 14 acceptance tests, including empty basket, oversize discount, half-kopeck rounding, and minimum threshold boundaries. The original run also passed type checking.
- The [traceability audit](traceability.md) found gaps in direct coverage, but no behavior outside the specification or need to edit it.

## Run B: Ticket Only

- A fresh Codex chat used an isolated worktree at starter commit `c339625`. It received the ticket path and instructions to use only the ticket and starter app files as feature context.
- It added `discounts.ts` and `discounts.test.ts`, and exported the function from `index.ts`. Its pricing function takes a `Date`, whereas A takes epoch milliseconds.
- It stacked unique eligible codes in entry order. To support a category coupon after an order-wide coupon, it distributed the preceding discount proportionally across category balances, with remainder placement determined by category traversal order.
- All 15 tests passed on rerun with `npm test -- --no-cache`: eight seeded and seven new. The agent also passed type checking. Its suite covered expiry equality, minimum equality, a missing category, an oversize fixed discount, and half-kopeck rounding, but did not directly test an empty basket.

## Decision Comparison

| Decision | A: With specification | B: Ticket only | Match? |
|---|---|---|---|
| D-1: Coupon and loyalty | Coupon first, loyalty on remainder. | Same phase order and loyalty base. | Yes |
| D-2: Shipping | Excluded from discounts and minimum; added unchanged. | Same. | Yes |
| D-3: Multiple coupons | Pick the largest capped candidate; earliest wins a tie. | Apply each unique eligible code in entry order, including overlapping coupons. | No |
| D-4: Rounding | Half up once per aggregate percentage candidate and once for loyalty. | Half up once per aggregate applied coupon and once for loyalty. | Yes for the rounding rule; bases can differ |
| D-5: Category base | Original subtotal of the target category. | Remaining category balance, reduced by earlier category and order-wide coupons. | No |
| D-6: Minimum | Original whole-order merchandise subtotal; inclusive. | Same. | Yes |
| D-7: Floor and fixed caps | Cap each fixed coupon at its original eligible base before selection; no credit. | Cap each fixed coupon at the remaining eligible balance when applied; no credit. | Partial: same floor, different cap timing |
| D-8: Expiry | Ignore the code at or after the expiry instant. | Same. | Yes |
| D-9: Code matching | Exact matching; ignore unknowns; repeats cannot increase the discount. | Exact matching and unknowns ignored; explicitly deduplicates repeats before stacking. | Yes for the matching and repeat rules |
| D-10: Empty order | Return five zeros. | Returns five zeros by inspection; no direct empty-basket test. | Yes |

For AC-3's 10,000 fresh plus 10,000 standard basket, A's test expects a 1,500 coupon discount. B's implementation would take 1,000 for the 10% coupon, then 1,350 for the 15% coupon on the remaining fresh balance, for a combined 2,350. Both suites pass because they assert different coupon policies.

## Time and Effort

| Measure | A | B |
|---|---|---|
| Specification and planning prep | Not reliably recorded | 0 |
| Initial implementation turn, including its own verification | 2m 40s | 1m 17s |
| Post-answer implementation corrections | 0; two follow-up turns reran checks and reviewed traceability without edits | 0 |
| Active turn time through verification and review, excluding commit and prep | 3m 14s | 1m 17s |

Times use Codex turn durations, rounded to seconds; they exclude gaps between turns. B's first launch failed before implementation because of an unsupported default model; the successful turn used A's model, and the failed launch is excluded. This compares the full Task C workflow with a ticket-only implementation, so it does not isolate the cost of the specification from the cost of OpenSpec and traceability.

## Conclusion

The runs agreed on seven decisions, differed on two, and partly agreed on one. The spec made the coupon policy reviewable: without it, B's stacking behavior could reasonably pass review against the ticket even though it gives away 850 extra kopecks on AC-3's basket. B was faster to implement, but the unrecorded preparation time prevents a full cost comparison. For a feature this size, a ticket that explicitly settles coupon selection and category bases and gives numeric boundary examples might deliver most of the same benefit.
