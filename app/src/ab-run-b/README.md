# `ab-run-b/` — Task D evidence, not production code

This folder is the **B arm of the A/B experiment** described in
[`docs/ab-validation.md`](../../../docs/ab-validation.md). Nothing here is wired into
`app/src/index.ts` and nothing here should be used as the discount engine.

| File | What it is |
|---|---|
| `discounts.ts` | A second, independent implementation produced by an agent with a **clean context**, given only the business ticket from `materials/feature-request.md` — no spec, no decision table, no sight of `app/src/discounts.ts`. |
| `discounts.test.ts` | That agent's own 35 tests, asserting *its* decisions. |
| `ab-compare.test.ts` | Written afterwards: runs **both** engines over identical orders and pins every measured difference in kopecks. |

`ab-compare.test.ts` is the reason the numbers quoted in `docs/ab-validation.md` can be
trusted — it fails if either engine changes, so the write-up cannot silently go stale.

The production engine is `app/src/discounts.ts`, built from
`docs/spec/pricing-discounts.md` and traced in `docs/traceability.md`.

