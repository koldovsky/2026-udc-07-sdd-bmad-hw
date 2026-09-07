# A/B: spec-driven versus ad-hoc (Task D)

**Feature:** loyalty and coupon discounts from `materials/feature-request.md`  
**Agent/tool:** OpenAI Codex  
**Model:** GPT-5.6 Terra  
**Reasoning mode:** Medium

The same agent, model, and reasoning mode were used for both runs. Run B used a
fresh clone and a new chat so it did not inherit Run A's specification or planning
artifacts.

## Run A — spec-driven

The agent received `docs/spec/pricing-discounts.md` and the OpenSpec change
`add-pricing-discounts` before implementation. It implemented `app/src/discounts.ts`,
exported `priceOrder`, added `app/src/discounts.test.ts`, and recorded traceability in
`docs/traceability.md`.

- **Decisions:** implemented the agreed discount base, ordering, category balances,
  rounding, floor, eligibility, structured rejection reasons, explicit expiry time,
  and pure result contract.
- **Tests:** 16 AC-named discount tests plus 8 pre-existing protected pricing tests;
  `npm test` passed with 24 tests across 2 files, and `npm run typecheck` passed.
- **Traceability:** every AC maps to code and an AC-named test. Reverse traceability
  found four specified behaviors that initially had no dedicated AC: conflicting
  coupon definitions, malformed expiry, zero-saving applied coupons, and
  `minimum_not_met`. They became AC-13 through AC-16 with matching tests.
- **Iterations:** 2 implementation iterations: the initial implementation, followed
  by the traceability correction.
- **Elapsed time:** not measured. The specification and OpenSpec preparation happened
  before implementation, so no honest elapsed-time comparison is available.

## Run B — ad-hoc

The agent received only `materials/feature-request.md`, without the agreed
specification or OpenSpec artifacts. It was instructed to make reasonable decisions
where the ticket was ambiguous instead of asking for clarification.

It implemented the discount engine, exported `priceOrder`, and changed
`app/src/discounts.ts`, `app/src/discounts.test.ts`, and `app/src/index.ts`. It also
created its own `docs/spec/pricing-discounts.md` and `docs/traceability.md`, despite
not receiving the spec-driven run's documents. That is useful evidence that the
ad-hoc agent independently introduced some formalization.

- **Chosen behavior:** tier discount on items first; shipping excluded; valid unique
  coupons sequentially in entered order; category coupons use remaining category
  value; minimum uses original subtotal; percentage savings round half-up; discounts
  stop at zero; expired/invalid coupons are silently ignored; repeated codes apply
  once; shared discounts allocate proportionally across eligible lines.
- **Tests:** `npm test` passed with 18 tests across 2 files; `npm run typecheck`
  passed. The available result does not establish the same AC-level edge coverage as
  Run A.
- **Iterations:** 1 implementation iteration.
- **Elapsed time:** not recorded. No numerical or approximate time is reported.

## Comparison of decisions

| Decision point | A — spec-driven | B — ad-hoc | Comparison |
|---|---|---|---|
| Discount base and shipping | Merchandise only; loyalty covers all categories; shipping is never discounted. | Tier discount applies to items first; shipping is never discounted. | Same core behavior. |
| Loyalty/coupon stacking | Loyalty first, then coupons on remaining eligible value. | Tier discount first, then valid coupons sequentially. | Same. |
| Multiple coupons and order | Apply all eligible coupons in customer input order; overlaps allowed. | Valid unique coupons apply sequentially in entered order. | Same for stated behavior. |
| Code normalization and repeats | Trim whitespace, compare case-insensitively, reject later duplicates structurally. | Repeated entered codes apply once; normalization details not recorded. | Partial overlap; A makes matching and duplicate outcome observable. |
| Supplied coupon definitions | Caller supplies `Coupon[]`; conflicting normalized definitions reject as `invalid_or_unknown`. | Coupon definition conflict behavior not recorded. | A specifies and tests an edge case absent from B's reported behavior. |
| Minimum subtotal | Inclusive original merchandise subtotal, before discounts, without re-evaluation. | Original item subtotal. | Same core base; A also makes equality and rejection observable. |
| Category percentage coupon | Remaining value of matching category after earlier discounts. | Remaining value of the coupon's category. | Same. |
| Fixed category coupon | Applies once across the category; caps there and never spills. | Discounts cannot reduce item cost below zero; fixed-category frequency/spill detail not recorded. | A is more explicit. |
| Shared discount allocation | Proportional by eligible value; leftover kopecks go to lines in input order. | Proportional allocation across eligible lines. | Same main approach; A adds deterministic remainder handling. |
| Percentage rounding | Round each operation once to nearest kopeck; exact halves up. | Half-up to whole kopecks. | Same core behavior; A fixes the operation-level stage. |
| Discount floor | Cap at remaining eligible value; no negative category or order balance. | Discounts cannot reduce item cost below zero. | Same core floor; A states category no-spill behavior. |
| Invalid, expired, and duplicate coupons | Skip without failing and return structured reasons with a defined priority. | Expired/invalid coupons silently ignored; repeated codes apply once. | Different observable result: A reports reasons; B does not. |
| Malformed expiry | Reject as `invalid_or_unknown`. | Not recorded. | A explicitly covers and tests it. |
| Zero-saving coupon | Remains `applied` with zero savings. | Not recorded. | A explicitly covers and tests it. |
| Below-minimum coupon | Reject as `minimum_not_met`. | Minimum uses original subtotal; rejection outcome not recorded. | A explicitly covers and tests it. |
| Evaluation time and purity | Caller supplies one explicit timestamp; pricing does not mutate inputs. | Not recorded. | A provides a deterministic contract. |
| Empty order | Valid zero-value breakdown. | Not recorded. | A explicitly covers a boundary case. |
| Feature boundary | Calculation only; no persistence, UI/API, campaign schedule, or redemption tracking. | Only discount-engine files were reported. | Compatible scope; A states it directly. |

## Time and effort

| | A — spec-driven | B — ad-hoc |
|---|---|---|
| Preparation | Specification and OpenSpec artifacts were prepared; exact time not measured. | None supplied to the agent. |
| Implementation time | Not measured. | Not recorded. |
| Implementation iterations | 2 | 1 |
| Test result | 24 passing tests: 16 discount AC tests + 8 protected tests. | 18 passing tests across 2 files. |
| Total elapsed time | Not measured; no numerical comparison can be made. | Not recorded; no numerical comparison can be made. |

## Conclusion

For the core arithmetic of a feature this size, the ad-hoc run produced behavior very
similar to the spec-driven run in one implementation iteration. It independently chose
loyalty before coupons, sequential input-order coupons, remaining category balances,
original-subtotal eligibility, shipping exclusion, half-up rounding, and a zero floor.
The demonstrated value of SDD here was not a radically different algorithm: it made
edge-case decisions explicit, gave them numeric acceptance criteria, and linked them
to code and tests. The reverse traceability check then exposed four behaviors that were
specified but not yet represented by an AC, enabling a focused correction. That benefit
must be weighed against the unmeasured preparation cost; this experiment does not show
that SDD is automatically faster or necessary for every similarly sized feature.
