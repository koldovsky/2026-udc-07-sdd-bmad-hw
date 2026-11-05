# Task B · OpenSpec

I used OpenSpec 1.16.0 with the `spec-driven` schema for the `pricing-discounts` change. The [Task A specification](spec/pricing-discounts.md) supplied the business decisions, acceptance criteria, and API contract.

## What OpenSpec generated

- `openspec new change pricing-discounts` scaffolded the change directory and its `.openspec.yaml` metadata.
- `openspec instructions` supplied templates and writing rules for the [proposal](../openspec/changes/pricing-discounts/proposal.md), [delta spec](../openspec/changes/pricing-discounts/specs/checkout-discounts/spec.md), [design](../openspec/changes/pricing-discounts/design.md), and [tasks](../openspec/changes/pricing-discounts/tasks.md). I filled in all four artifacts from the source spec and the existing code.

## What it added beyond Task A

- The workflow made the artifact dependencies explicit. The proposal came first, then the delta spec and design, then the task checklist.
- The checklist turned AC-1 through AC-14 into individual, named Vitest tasks and made test execution and traceability explicit completion steps.
- OpenSpec reported all four planning artifacts complete, and `openspec validate pricing-discounts --strict` accepted the change.

## What I reviewed manually

- I checked the delta against D-1 through D-10 and carried over the fixtures and expected results for all 14 scenarios. CLI validation checked the artifact structure. Verifying that the scenarios still matched Task A required a manual comparison.
- I checked the seeded helpers and planned to reuse them. The design specifies `BigInt` for exact percentage intermediates because a safe-integer subtotal can exceed that range when multiplied by a rate.
- I mapped AC-14 to tests in both entry orders and to a review of the winner comparison, since the public breakdown does not expose the winning code.
