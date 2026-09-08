# SDD Tool Report: OpenSpec

## Tool Selected

**OpenSpec** (@fission-ai/openspec) — Node.js CLI for spec-driven development.

## What Was Generated

OpenSpec created a structured change proposal pipeline under `openspec/changes/add-pricing-discounts/`:

1. **proposal.md** — Motivation and capability inventory
   - Why: Problem statement (lack of flexible discounts)
   - What Changes: Feature list
   - Capabilities: Listed "pricing/discounts" as new capability
   - Impact: Affected modules, APIs

2. **specs/pricing/discounts.md** — Behavioral contract with 10 requirements and 25 scenarios
   - Requirement: Calculate tier loyalty discount
   - Requirement: Apply coupons sequentially
   - Requirement: Ignore expired coupons
   - Requirement: Respect minimum subtotal
   - Requirement: Apply coupon to category
   - Requirement: Base on subtotal only
   - Requirement: Round at final subtotal
   - Requirement: Never allow negative total
   - Requirement: Return breakdown
   - Requirement: Handle empty order

3. **design.md** — Technical approach with 7 decisions and rationale
   - Sequential discount application (tier then coupons)
   - Discount base (subtotal only, no shipping)
   - Category-specific calculation (% of category, not whole order)
   - Rounding strategy (once at end, 0.5→1)
   - Expired coupon handling (silent ignore)
   - Negative subtotal clamping (→ 0)
   - Minimum subtotal timing (checked before each coupon)
   - Plus: risks/trade-offs, migration plan, open questions

4. **tasks.md** — Implementation checklist with 18 verifiable tasks
   - Setup & core (3 tasks)
   - Coupon types & conditions (5 tasks)
   - Rounding & edge cases (3 tasks)
   - Price breakdown & API (2 tasks)
   - Integration & testing (4 tasks)
   - Documentation & finalization (3 tasks)

## What OpenSpec Added (Beyond Hand-Written Spec)

### ✅ Strengths

1. **Structured workflow** — Enforced a pipeline (proposal → specs → design → tasks) that encourages thinking through multiple angles:
   - Proposal separates *why* from *what*
   - Specs focus purely on behavior (observable, testable)
   - Design captures *how* with decision rationale
   - Tasks break implementation into verifiable units

2. **Explicit capability naming** — Forced declaration of "pricing/discounts" as a versioned capability, creating a contract point for future changes (what modifies this capability? why?).

3. **Requirement-scenario pairing** — Specs required ≥1 scenario per requirement, pushing concrete examples instead of abstract statements. Manual spec listed AC but not structured this tightly.

4. **Design decision structure** — Template explicitly asked for alternatives considered, rationale, and trade-offs. Produces more defensible decisions than "this is how we do it."

5. **Task granularity** — Generated task list grouped by concern (setup, types, rounding, integration) and included verification methods for each task, making progress trackable.

### ⚠️ Limitations

1. **Redundancy** — Specs and manual spec (`docs/spec/pricing-discounts.md`) cover largely overlapping ground (10 spec requirements vs. 13 decision points, 25 scenarios vs. 10 ACs). Required both to be written separately; could have consumed one to write the other.

2. **No code generation** — Unlike some SDD tools (BMAD, Spec Kit), OpenSpec generated no scaffolding or stubs. The `discountPrice()` function signature, tests, and module structure still had to be written by hand.

3. **Manual dependency tracking** — Spec requirements and tasks don't explicitly link to acceptance criteria or code. The traceability matrix (AC → code → test) was not auto-generated; must be manually maintained in Task C.

4. **No validation** — Tool checked that artifacts exist and structure is valid (YAML, markdown), but could not validate that:
   - Specs are testable (vs. aspirational)
   - Tasks actually cover all spec requirements
   - Design decisions are actually sound (that's on the reader)

5. **Lightweight schema** — Spec-driven schema is very permissive. Richer schemas (like BMAD or Spec Kit's structured models) might catch inconsistencies earlier (e.g., "this requirement has no scenario").

## What We Did Manually

1. **Wrote the hand-written spec** (`docs/spec/pricing-discounts.md`) with 13 decision points and 10 ACs — this was Task A and exists independently of OpenSpec.

2. **Filled out proposal/specs/design templates** — OpenSpec provided structure, but content came from understanding the problem, reviewing existing code, and making trade-off decisions.

3. **Populated tasks with verification methods** — Template was blank; we filled in concrete test names and success criteria.

4. **Will perform traceability manually** — No tool support for linking AC → code → test; will build `docs/traceability.md` by hand in Task C.

## Value Assessment

**Did OpenSpec earn its place?** Partially.

- **Pro:** Forced systematic thinking through proposal/spec/design/tasks pipeline. Produced more thorough decision documentation than typical ad-hoc planning. Useful for onboarding new contributors: they can read the change's "why" (proposal), "what" (specs), and "how" (design) without digging through code.

- **Con:** Generated 4 markdown files (~1,500 lines) that don't directly produce code or tests. A skilled engineer writing a thorough README + code structure might achieve the same clarity faster. No differentiation from a well-organized Google Doc with the same sections.

- **Verdict:** For this task (a single, bounded feature with clear requirements), OpenSpec added organizational rigor but not transformative insight. Where it might shine: a complex, multi-team change where specs must be versioned, divergent proposals compared, or requirements traced across multiple systems. For a 2-hour homework feature, it's more ceremony than necessity.

## Files Affected

- `docs/spec/pricing-discounts.md` — Hand-written spec (Task A)
- `openspec/changes/add-pricing-discounts/proposal.md` — Generated proposal
- `openspec/changes/add-pricing-discounts/specs/pricing/discounts.md` — Generated specs (15 requirements)
- `openspec/changes/add-pricing-discounts/design.md` — Generated design
- `openspec/changes/add-pricing-discounts/tasks.md` — Generated tasks
- `docs/sdd-tool.md` — This file

## Next Steps

Ready for Task C: use `openspec/changes/add-pricing-discounts/tasks.md` as implementation guide. Each task corresponds to a code change that must be tested and traced back to a spec requirement.
