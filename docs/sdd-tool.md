# SDD tool: OpenSpec

**Tool:** OpenSpec 1.11.0 (`@fission-ai/openspec`), schema `spec-driven`
**Run:** `openspec/changes/add-discounts/`, driven from Cursor via `/opsx-propose`
**Input:** `docs/spec/pricing-discounts.md` (Task A) + `materials/feature-request.md`
**Author of the decisions:** Yevhenii Savonenko — the tool asked, it did not decide

---

## 1. Why this tool is in the repo at all

Chosen because it is a Node CLI and this repo already runs Node — Spec Kit and BMAD
both need `uv`, which would have been a second runtime installed for one homework.
That is the cheap reason. The reason it earned its place is in §3: it refused to let
me start implementing while eight forks in my own specification were still open.

The thing that does the work is not the file format. It is the **planning boundary**:
`/opsx-propose` is allowed to write planning artifacts and nothing else, and its
guardrails say to ask the user about any ambiguity that would materially change
observable behaviour rather than assume it. My Task A spec looked finished — 10
decisions, 8 acceptance criteria, a contract. Running it through the artifact chain
turned it into 13 acceptance criteria and 16 executable scenarios, because writing
a *scenario* forces a number, and a number cannot be hedged.

## 2. What it generated

| Artifact | Path | Size | What it holds |
|---|---|---|---|
| Proposal | `openspec/changes/add-discounts/proposal.md` | 33 lines | Why, what changes, the one new capability `pricing-discounts`, blast radius |
| Delta spec | `openspec/changes/add-discounts/specs/pricing-discounts/spec.md` | 163 lines | 11 requirements, 16 `WHEN/THEN` scenarios, every amount in kopecks |
| Design | `openspec/changes/add-discounts/design.md` | 80 lines | Bucket ledger, one rounding helper, resolution pass, risks with mitigations |
| Tasks | `openspec/changes/add-discounts/tasks.md` | 37 lines | 20 checkboxes in 6 groups, each stating its own verification |
| Change metadata | `openspec/changes/add-discounts/.openspec.yaml` | 3 lines | Schema + creation date, used by `status`/`validate`/`archive` |
| Project config | `openspec/config.yaml` | 33 lines | Schema default, slots for project context and per-artifact rules (left empty) |

Also committed: `.cursor/commands/opsx-*.md` and `.cursor/skills/openspec-*/SKILL.md`
— six workflows (`explore`, `propose`, `update`, `apply`, `sync`, `archive`) that
`openspec init` installed into the IDE. They are the actual product; the CLI mostly
answers `status`, `instructions` and `validate` for them.

The dependency chain it enforced: `proposal → {specs, design} → tasks`. Artifacts
report `blocked` until their inputs exist, and `openspec instructions <artifact>`
hands over the template plus the completed dependencies to re-read from disk. I could
not write tasks before requirements existed, which is exactly the shortcut I take when
left alone with a markdown file.

## 3. What OpenSpec added beyond my own markdown spec

This is the honest part of the comparison. My spec closed 10 forks. It left 8 open
that a second engineer would have silently resolved differently — and all 8 surfaced
because an artifact demanded a number where my document had a word.

| # | My spec said | Still undecided | Decision now recorded |
|---|---|---|---|
| 1 | D-4: rounding "up" | Up **where** — per line, per step, or once at the end? | Ceil at each discount step, per category bucket |
| 2 | D-3: "all coupons apply" | Does the same code typed twice apply twice? | Deduplicate by code, apply once |
| 3 | — | A typed code that matches no coupon in the catalogue | Ignore it, no error, rest still apply |
| 4 | D-8: expired coupon → "error" | `PriceBreakdown` has no error field, so what is thrown? | Exported `ExpiredCouponError` carrying `code` |
| 5 | D-7 / AC-4: "the discount is not applied" | The offending coupon only, or every discount? Trimmed to fit, or dropped? | Skip that coupon whole; tier and other coupons unaffected |
| 6 | D-2: base is goods, not shipping | Does the floor sit on the goods or on the total? | Goods floor at 0; shipping is always charged |
| 7 | D-6: `minSubtotalKopecks` checked "after" | After the tier — measured order-wide or per category? | Order-wide remaining amount at that coupon's turn |
| 8 | D-1 sequential **vs** D-5 "from the category sum" | Two decisions in conflict: does a second `fresh` coupon see 50 000 or 40 000? | Category's remaining amount after the tier discount and earlier coupons |

Fork 8 is the one I would defend the tool over on its own. D-1 and D-5 were both
reasonable, both written down, and **mutually inconsistent** — with the literal
reading of D-5, two 50% coupons on one category make that category free. A prose
spec hid the conflict because the two rows sat in different paragraphs. A scenario
that has to print one number could not.

Two rules also had to be **invented** and written down, because the spec's model was
underdetermined once discounts became per-category:

- The tier discount is rounded up per category bucket, so `tierDiscountKopecks` can
  exceed a single ceiling on the subtotal by a kopeck per category. Direction always
  favours the customer (consistent with D-4), and AC-13 pins it.
- An order-wide **fixed** coupon needs an allocation rule across categories, or a
  later category coupon is non-deterministic: proportional shares rounded down,
  leftover kopecks to the largest bucket first, ties `standard → fresh → digital`.
  AC-12 exercises it with a deliberately indivisible 10 001.

One smaller finding, from mapping decisions onto scenarios: **D-9 and D-10 answer a
question the type contract already forecloses.** `Order.customerTier` is a single
union value, so loyalty tiers cannot stack and there is no "most favourable of
several" to choose. Neither row could produce a distinct scenario; both collapsed
into one requirement ("exactly one tier applies"). Two of my ten decisions were
answering a hypothetical.

What the tool contributed structurally, on top of the decisions:

- **`validate --strict` as a format gate.** Scenarios must use exactly four hashes,
  every requirement needs at least one scenario, a new capability needs a Purpose of
  50+ characters. Silent-failure formats are caught before review, not during.
- **A verification clause per task.** The template refuses "implement discounts" and
  wants "…and verify the AC-4 test passes". 20 tasks, 20 checks.
- **Traceability that was already half-built.** Every scenario carries its AC id, so
  `docs/traceability.md` is a transcription job rather than an archaeology job.
- **A path for the spec after this change.** `specs/…/spec.md` here is a *delta*;
  `openspec archive` folds it into `openspec/specs/` as living documentation. My
  Task A document has no such lifecycle — it is a snapshot of one decision session.

## 4. What it did not do, and what I did by hand

- **It did not find the ambiguities.** Locating the eight open forks meant reading my
  spec against `types.ts` and the seeded contract. OpenSpec supplies a guardrail that
  says "ask instead of assuming"; it does not know that `minSubtotalKopecks` has two
  plausible bases. The tool asks questions when a human decides one is needed.
- **It did not check arithmetic.** Every kopeck in all 16 scenarios was computed and
  cross-checked by hand. `validate --strict` reports the document as valid whether the
  total is 94 900 or nonsense — it validates shape, never semantics.
- **It did not reconcile the two specifications.** `docs/spec/pricing-discounts.md`
  and the delta spec are now two sources of truth, and the tool has no notion of the
  first one. Tasks 1.1 and 1.2 exist to write D-11…D-16 and AC-9…AC-13 back into the
  Task A document by hand — otherwise the deliverable graded for Task A would be
  missing six decisions that the implementation depends on.
- **It did not write prose.** Templates arrive as section headers with instruction
  comments. Every requirement, rationale, risk and mitigation was written from the
  domain, not generated from the ticket.
- **Minor friction:** `openspec validate` takes the change as a positional argument
  while `status` and `instructions` take `--change`; the inconsistency costs one
  failed command. `config.yaml` also offers a project-context block that would have
  fed `AGENTS.md` constraints into every artifact automatically — left empty here,
  which meant restating the kopecks-and-protected-signatures constraints by hand.

## 5. Verdict

For a feature this size, the format contributed less than the interrogation did. Had I
written the same 13 acceptance criteria into a plain markdown file, the implementation
would be equally well specified — the artifacts are not magic, and roughly 300 lines of
them describe a function that will be about 120 lines of TypeScript.

What a plain markdown file would not have done is **stop me**. The value landed in one
specific place: a workflow that is permitted to plan and forbidden to implement, that
treats an unresolved ambiguity as a blocker rather than a footnote, and that makes the
cost of a vague answer immediate — you cannot write `#### Scenario` without a number.
Eight forks and one direct contradiction between my own decisions came out of that,
before a line of code existed to be attached to them.

The cost was around 25 minutes and a duplicated source of truth to keep in sync. On
this feature that trade paid off, mostly because of fork 8: shipping D-1 and D-5 as
written would have been a real bug — a category made free by two coupons — discovered
in production rather than in a table.
