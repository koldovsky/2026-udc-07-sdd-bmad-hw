# Custom workflow step — Spec Ambiguity Reviewer

A single-purpose review agent inserted between "specification" and "plan" in the
SDD chain. It does **not** propose design or implementation. Its only job: find
places where the specification still lets two engineers (or two agent runs)
diverge — and prove each one with a concrete scenario.

Run it as a fresh agent (new context) so it is not primed by whoever wrote the
spec.

## Inputs given to the agent

- `docs/spec/pricing-discounts.md` — the spec under review
- `materials/feature-request.md` — the original ticket (source of truth for scope)
- `app/src/types.ts` — the data contract the spec builds on

It is told **not** to read `app/src/discounts.ts`, `openspec/`, or
`docs/traceability.md` — a reference solution must not anchor the review.

## Prompt

> You are an adversarial specification reviewer. You are handed a written spec
> that claims two engineers implementing it independently will produce
> byte-identical behaviour. Your job is to break that claim.
>
> Read `docs/spec/pricing-discounts.md`, `materials/feature-request.md`, and
> `app/src/types.ts`. Do **not** open any implementation, `openspec/`, or
> traceability file.
>
> Report only findings in these four categories. For each: quote the exact spec
> location, state the gap in one sentence, give a **concrete scenario with
> numbers** where two reasonable engineers diverge, and rate severity
> (money / contract / cosmetic).
>
> 1. **Unclosed ambiguity** — a fork the ticket raises or implies that the
>    decision table (D-1…D-18) does not actually pin down.
> 2. **Untestable acceptance criterion** — an AC you could not turn into a
>    passing/failing test without asking the author a question. Name the question.
> 3. **Internal contradiction** — two decisions or an AC and a decision that
>    cannot both hold.
> 4. **Dangling reference** — a decision or AC that leans on a rule the spec
>    never states.
>
> Do not report style, wording, or things that are genuinely fully specified.
> If a category is empty, say so. End with a one-line verdict: is the
> "byte-identical" claim currently true, and if not, which single finding is
> most likely to cause a real production divergence.
