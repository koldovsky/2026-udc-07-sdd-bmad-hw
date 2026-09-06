# Run B artifacts — evidence for Task D

Everything in this directory is the **output of the ad-hoc run**, copied here
verbatim so the A/B comparison in `docs/ab-validation.md` can be checked by
someone who only has this repository.

**None of it is part of the build.** It is not imported by `app/`, it is not
compiled, and `cd app && npm test` never sees it. The implementation this
homework delivers is `app/src/discounts.ts`.

| File | What it is |
|---|---|
| `discount-spec.md` | The specification Run B wrote for itself before coding (D1 … D11) |
| `discounts.ts` | Run B's discount engine — `quoteOrder(order, catalog?, now?)` |
| `discounts.test.ts` | Run B's tests: 37 of its own, green alongside the 8 seeded ones |
| `index.ts.diff` | The exports Run B added to the seeded `app/src/index.ts` |

## How it was produced

A separate working copy, built from the starter commit `c339625` — the last
commit before Task A of this branch. It contained the seeded `app/`,
`app/AGENTS.md` and `materials/feature-request.md`, and nothing else: no
`docs/`, no root `AGENTS.md` or `CLAUDE.md`, and the seeded `app/src/index.ts`
rather than this branch's, so the ad-hoc agent could not read the names
`priceOrder`, `PriceBreakdown` or `RejectionReason`.

New session, Claude Code / Opus 5 — the same host and model as Run A. One
message, quoted in full in `docs/ab-validation.md`, and no further answers to
anything the agent asked. Wall clock 4 min 26 s from the first record of the
session to the last.

The amounts in the divergence tables of `docs/ab-validation.md` were produced by
calling `priceOrder` from `app/src/discounts.ts` and `quoteOrder` from
`docs/run-b/discounts.ts` on identical inputs.
