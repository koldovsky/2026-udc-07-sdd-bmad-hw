# Task B: OpenSpec

**Tool:** OpenSpec, using the repository's `spec-driven` schema.

## Artifacts

The OpenSpec change is `add-pricing-discounts` and contains:

- `openspec/changes/add-pricing-discounts/proposal.md` — why the discount engine is
  needed, the new capability, and its intended impact.
- `openspec/changes/add-pricing-discounts/specs/pricing-discounts/spec.md` — a
  delta specification that maps the 16 agreed acceptance criteria into testable
  OpenSpec scenarios.
- `openspec/changes/add-pricing-discounts/design.md` — the implementation approach
  for composing protected pricing helpers and retaining category balances.
- `openspec/changes/add-pricing-discounts/tasks.md` — ordered implementation and
  verification tasks. All tasks remain unchecked because implementation has not
  started.

## What OpenSpec added

`docs/spec/pricing-discounts.md` remains the source business specification.
OpenSpec added a change-level structure around it: a concise motivation and impact
statement, a capability-scoped behavior delta, a technical approach, and a dependency-
ordered task list with verification for each step. It also validates that the planning
artifacts required before implementation are present.

## Manual decisions

No product decisions remained open: the source specification already resolves
discount ordering, eligibility, category behavior, rounding, rejection results,
expiry, and boundary behavior. Manual work was still needed to choose the capability
name, identify the existing protected modules, and keep the plan limited to the
agreed contract rather than introducing an external coupon service or checkout work.

## Validation

The completed change passed:

```sh
openspec validate add-pricing-discounts --type change --strict
```

The artifacts are planning only. Implementation begins only after an explicit apply
request.
