# SDD tool: OpenSpec

Task B write-up. It is based on what happened in this session, not on the
OpenSpec README. The spec that went in was `docs/spec/pricing-discounts.md`
(decisions D-1..D-17, AC-1..AC-24).

## 1. Tool and why

I used **OpenSpec CLI 2.1.0** (`@fission-ai/openspec`), hosted in Cursor (Agents
window) with Claude Opus 5.5 Medium driving it. I picked it because the repo is
Node/TypeScript and OpenSpec needs only Node, while Spec Kit and BMAD both need
`uv`. I used the default `spec-driven` schema
(`openspec/config.yaml`) with no project `context` or `rules`.

## 2. What it generated

From `openspec init --tools cursor --scope project --no-copilot-cloud --no-animation`:

- `openspec/config.yaml`: sets `schema: spec-driven`. The context and rules
  blocks are only commented-out examples.
- `openspec/specs/.gitkeep`: the main spec store. It is empty and stays empty
  until a change is archived.
- `openspec/changes/archive/.gitkeep`: the archive folder, also empty.
- `.agents/skills/`: six Cursor skills, `openspec-propose`,
  `openspec-apply-change`, `openspec-archive-change`, `openspec-explore`,
  `openspec-sync-specs` and `openspec-update-change`.

From `/openspec-propose`, under `openspec/changes/add-order-discounts/`:

- `.openspec.yaml`: change metadata (`schema: spec-driven`, `created: 2026-11-18`).
- `proposal.md`: why, what changes, one new capability `order-discounts`,
  impact (`discounts.ts`, `discounts.test.ts`, re-exports in `index.ts`), and a
  restated out-of-scope list.
- `specs/order-discounts/spec.md`: the delta spec. It has 17 `ADDED`
  requirements in SHALL/MUST form, one per runtime decision, and 24 scenarios
  named `AC-1: …` to `AC-24: …` in WHEN/THEN form with the same numbers as the
  source spec. The shared fixture sits in `## Purpose`.
- `design.md`: the pipeline, the integer floor, code matching, expiry
  comparison, purity, and risks.
- `tasks.md`: 12 checkbox tasks in 4 groups. Tests land with the group that
  needs them, not in a final testing group.

## 3. What it added beyond the markdown spec

**Legend:** **New** means the content is not in `docs/spec/pricing-discounts.md`.
**Re-encoded** means the same content in OpenSpec's format.

| Item | New / Re-encoded |
|---|---|
| Requirements and AC scenarios in SHALL + WHEN/THEN form, grouped one requirement per decision | Re-encoded. No decision was added, changed or dropped. |
| Out-of-scope list and contract in `proposal.md` | Re-encoded |
| Per-task plan: 8 of 12 tasks name their decision ids and AC ids (e.g. 3.2: D-3, AC-4/5/6). The other 4 are setup and integration tasks (1.1, 1.2, 4.1, 4.2). Every task has its own verification step (a typecheck, named AC tests, or a `git diff` check). | **New.** The spec has no implementation order. The task-to-AC mapping is a ready-made skeleton for `docs/traceability.md`. |
| Pipeline order inside `priceOrder` (8 steps: reuse pricing helpers → tier → resolve codes → filter → base and discount → per-scope winner → cap → total) | Mostly re-encoded. The order follows from D-1, D-3, D-6, D-7 and D-16. Writing it as one sequence is new. |
| Exact integer floor `(n - n % 100) / 100` instead of `Math.floor(n / 100)` (alternative recorded) | **New.** This is an implementation choice. It does not change results for realistic amounts. |
| Alternative considered and rejected: applying coupons sequentially to a running amount | Re-encoded. It is D-16's rationale restated as a rejected design. |
| Code normalisation with `trim().toLowerCase()` on **both** the typed string and the catalog `Coupon.code` | **New assumption.** D-10 only says "after trim + case-insensitive comparison". See the open questions below. |
| Risk: an invalid `expiresAt` makes `Date.parse` return `NaN`, and `now < NaN` is false, so the coupon is treated as expired | **New observation.** It is deliberately left unhandled because D-13 makes it undefined behaviour. |
| Risk: amounts above `Number.MAX_SAFE_INTEGER` overflow | **New.** It is dismissed as unreachable and no BigInt is used. |
| Risk: per-category tier flooring may differ from the order-level tier discount by up to 1 kopeck | Re-encoded. D-5 already accepts this. |
| Open question: whether the catalog `Coupon.code` is also trimmed | **New.** It is a real gap in D-10 wording. D-13's "unique after trim + case-folding" suggests yes. |
| Open question: there is no AC for the default `now`, for input immutability, or for the D-3 tie-break order (AC-6 only proves that one coupon applies) | Partly new. The spec admits the tie-break is unobservable. Missing ACs for the `now` default and immutability were not flagged before. The catalog-code trim, the default `now`, and input immutability were resolved in Task C (AC-25..AC-28). |
| `openspec validate --strict` caught a requirement over 500 characters | **New.** It is a format check, not a semantic one. The agent fixed it by moving the shared fixture into `## Purpose`, and the next two runs passed. |

**Net:** the tool added a task plan with verification steps, one real wording
gap (catalog code trimming), two missing-AC observations, and a format
validator. It added no product decisions. Everything behavioural is the
human's Task A work restated.

## 4. What stayed manual

- **Finding the forks and making the decisions.** All 17 decisions and the 8
  gap resolutions were made by the human in Task A, before the tool ran. The
  tool assumes the thinking is already done.
- **Writing the spec itself.** The propose skill was told to treat
  `docs/spec/pricing-discounts.md` as the single source of truth and not to
  decide anything the spec leaves open.
- **Approving permission cards.** The propose run showed 7 permission cards
  for its CLI calls. Each was approved with **Run**, never **Always Run**.
- **Setup friction.**
  - The entry command is `/openspec-propose`, not `/opsx:propose` as on the
    lecture slides.
  - Cursor needed a restart to see the new skills.
  - Six more workflows exist only via `openspec config profile`.
  - Telemetry is on by default.
- **Deciding what to commit.** I commit `.agents/skills/` so a fresh clone gets
  the `/openspec-*` commands. It sits outside CodeRabbit's `path_filters`, so
  it does not add review noise.

## 5. Costs and caveats

- **The spec now exists twice.** `docs/spec/pricing-discounts.md` (the graded
  Task A deliverable) and `openspec/changes/add-order-discounts/specs/` say the
  same thing in different formats. Any later decision change must be made in
  both, and nothing checks that they stay in sync.
- **`openspec/specs/` stays empty.** The main spec is only populated on
  archive. Archive was not run, and the Definition of Done does not require it.
- **Version drift vs the slides.** The command names (`/openspec-propose` vs
  `/opsx:propose`) and the default skill set differ from the lecture material.
- **Time.** About 24 minutes passed from `openspec init --help` to a validated
  change (21:57 to 22:21). Most of it went to waiting on permission cards and
  artifact generation, not to thinking.
- **The CLI is a scaffold; the content comes from the model.** The CLI
  supplied the templates, instructions and validation. The design choices and
  risks above were written by the agent following those instructions, so
  their quality depends on the model, not on OpenSpec.

## 6. Verdict

For a single-module feature whose spec already pins every decision with
numbers, OpenSpec added little behaviourally. The 17 requirements and 24
scenarios are a faithful re-encoding, not new understanding. Its real value
was structure: a dependency-ordered task list keyed to AC and decision ids,
with a verification step on each task, plus a design note that surfaced one
genuine wording gap (catalog code trimming) and two missing ACs. That is worth
about 25 minutes here mainly because it pre-builds the traceability for Task C.
The cost is a duplicated spec to keep in sync, which would matter more than
the structure on a feature this small if decisions kept changing.
