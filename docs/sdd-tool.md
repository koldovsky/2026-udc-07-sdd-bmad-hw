# Task B — SDD tool

## Tool

**OpenSpec `@fission-ai/openspec@1.12.0`**, schema `spec-driven`.

The choice was made by the runtime already on the machine. OpenSpec is a Node
CLI and this repository is already a Node project; Spec Kit and BMAD Method both
require `uv`, which is not installed here, so either would have meant installing
a second toolchain before the exercise could start. The tool is fed the
specification written in Task A (`docs/spec/pricing-discounts.md`: 32 decisions,
58 acceptance criteria, 5 invariants).

Commands run:

```bash
openspec init . --tools none --no-animation
openspec new change add-discount-engine --schema spec-driven \
  --description "Loyalty-tier and coupon discounts for order pricing"
openspec validate add-discount-engine --strict
openspec status --change add-discount-engine
```

`--tools none` was deliberate: the repository's `AGENTS.md` files are seeded
material, and `.claude/*` is gitignored here, so assistant-integration files
would either edit graded files or be invisible in the pull request. Telemetry was
disabled for every run with `OPENSPEC_TELEMETRY=0`.

## What the tool generated

`openspec init` created three things and nothing else:

```
openspec/config.yaml          # one line of content: schema: spec-driven
openspec/specs/.gitkeep
openspec/changes/archive/.gitkeep
```

`openspec new change` created a change directory with a two-line
`.openspec.yaml` (`schema`, `created`) and a `README.md` holding the name and
the description passed on the command line.

Everything else under `openspec/changes/add-discount-engine/` was written by
hand against the templates and per-artifact instructions carried in the schema:

| File | Lines | Content |
|---|---|---|
| `proposal.md` | 74 | Why, What Changes, Capabilities, Impact |
| `specs/order-discounts/spec.md` | 589 | 11 requirements, 58 scenarios — one per acceptance criterion |
| `design.md` | 242 | D-1…D-32 as decisions with rationale, risks, O-1…O-3 |
| `tasks.md` | 114 | 34 checkbox tasks, each naming its own verification and the criteria it is checked against |

The tool contributed the **shape** of those files, not their content: an
artifact graph (`proposal` → `specs` → `design` → `tasks`, with `tasks` blocked
until both `specs` and `design` exist), a template per artifact, a written
instruction per artifact, a delta vocabulary (`ADDED` / `MODIFIED` / `REMOVED` /
`RENAMED` Requirements), a parser, and `openspec validate`.

Final state: `4/4 artifacts complete`, `0/34 tasks`, `Change
'add-discount-engine' is valid` under `--strict`.

## What it added over a plain markdown specification

Four things, in descending order of how much they mattered here.

**1. A parsed model of the specification.** `openspec show --json
--deltas-only` returns the requirements and scenarios the tool actually parsed
out of the prose. That turned "did the port land?" into an arithmetic check:
11 requirements, 58 scenarios parsed, matching the 58 criteria of Task A exactly.
A plain markdown spec has no equivalent — `docs/spec/pricing-discounts.md` is
correct, but nothing outside a reader's attention confirms it.

**2. Enforced artifact order.** `openspec status` refused to treat `tasks` as
available while `specs` or `design` were missing. On this change the effect was
small, because the decisions already existed from Task A. On a change starting
from a blank page it is the difference between a task list derived from
requirements and a task list derived from a first guess.

**3. A validator, with a real and measurable ceiling.** This was tested rather
than assumed, by copying the finished change to a throwaway directory, breaking
one thing at a time, and running `openspec validate --strict`:

| Broken deliberately | `--strict` verdict |
|---|---|
| The `specs/` directory removed entirely | **ERROR** — "Change must have at least one delta", with a fix hint |
| A requirement left with zero scenarios (all 5 demoted from `####` to `###`) | **ERROR** — "must include at least one scenario", plus an INFO about the stray header |
| 4 of that requirement's 5 scenarios demoted, 1 left intact | **valid** — 54 scenarios parsed instead of 58, exit code 0; one INFO per demoted header, no warning and no error |
| The *first* 4 demoted, so the 5th sits under an ignored `###` header | **valid** — the requirement reaches **zero** parsed scenarios and 53 of 58 survive, with no error at all |
| The `## Purpose` section deleted | **valid** — despite the schema instruction requiring it |

So the validator checks structure at the *requirement* level and stops there, and
even that check is positional rather than absolute. Demoting all 5 headers raises
the ERROR, because the requirement's body then ends immediately. Demoting the
first 4 leaves the fifth attached to the ignored `###` section above it, so the
same requirement reaches zero parsed scenarios while the verdict stays `Change is
valid` — the "at least one scenario" rule counts what the parser attributed, not
what the author wrote. A requirement that loses most of its scenarios is never
caught. The dropped criteria are not entirely unannounced — each one draws
an INFO line naming the header — but that line is phrased as a heading-style
hint, `is not a "### Requirement:" header and is ignored by validation`, it is
not raised to a warning by `--strict`, and the verdict stays `Change is valid`
with exit code 0. Nothing in the output says that four or five acceptance
criteria left the parsed model. The schema's own instruction warns that a
three-hashtag scenario "will fail silently" — that warning is accurate at the
level that matters, and `--strict` does not lift it.

**4. A delta vocabulary.** `ADDED` / `MODIFIED` / `REMOVED` / `RENAMED`, with the
rule that a `MODIFIED` requirement must carry its full updated text. This change
is all `ADDED`, so the vocabulary cost nothing and bought nothing yet. It is the
one piece of the tool whose value is entirely in the second change, not the
first: an edit to a requirement becomes reviewable as an edit rather than as a
diff of a long document.

## What stayed manual

**Every decision.** The tool asked for none of the forks and resolved none of
them. The order the two discounts apply in, the rounding direction, the discount
base for a category coupon, which of several coupons wins, whether `null` counts
as a set category, what an unreadable expiry date means — all 32 came from Task A
and would have had to come from somewhere regardless of the tool. OpenSpec
supplied headings for them; it did not supply one number.

**The entire text.** All four artifacts were written by hand. The templates are
comment-only skeletons; `openspec new change` produced two lines of YAML and a
two-line README.

**The English port.** `docs/spec/pricing-discounts.md` is in Ukrainian, and the
tool's format has no place for a rationale column, so the decisions were
restated as `design.md` and the criteria as scenarios. Nothing in the tool
performs or checks that translation.

The tool does have a lever here that was not used: `openspec init --language uk`
writes a `context:` block into `openspec/config.yaml` — "All artifacts must be
written in uk. Keep OpenSpec structural headings and SHALL/MUST keywords in
English" — which is advisory text for whoever writes the artifacts, not a
translator. English was chosen anyway, because everything this repository puts on
disk is English and the delta spec is read alongside the code. The flag would
have removed the translation, not the restatement: the rationale column still has
no home in the format, and nothing on either setting checks one document against
the other.

**Cross-document consistency.** Nothing in OpenSpec knows that
`docs/spec/pricing-discounts.md` exists, so nothing detects it drifting away from
`openspec/changes/add-discount-engine/specs/`. The 58 scenario ids were chosen to
be the Task A criterion ids precisely because that is the only mechanism by which
the drift can be found — and it is a mechanism this repository added, not one the
tool provides.

## Conclusion

For this change OpenSpec added a parsed model, an artifact order and a
requirement-level validator on top of a specification that was already complete.
That is real but modest: measured against the effort, the specification did the
work and the tool checked the filing.

The measurement is not neutral, though, and it is worth saying which way it
leans. Task A produced an unusually thorough document, so the tool was given the
least favourable case — everything it exists to prompt for had already been
answered. Its enforced order and its templates are aimed at the opposite
situation, where the decisions do not exist yet, and none of that could show
itself here.

A second bias runs the same way and is this repository's own doing. `openspec
init --tools none` switched off the assistant-integration files, which are the
part of OpenSpec that drives the requirements → specification → plan loop from
inside an agent; what remained was the CLI, the schema and the validator. The
reasons are given above and still hold, but they mean "the tool supplied shape,
not content" describes the configuration that was actually run, not OpenSpec at
its full extent.

A third limit is scope. OpenSpec's cycle does not end at the plan: `openspec
instructions apply` guides the implementation and `openspec archive` folds a
finished change into `openspec/specs/`. Task B stopped at the task list, so
neither was run at the time this section was written, and nothing above is
evidence about them. `openspec archive` was run in Task C once the tests were
green; what it did is recorded in the addendum below. The verdict above covers
the planning and validation phases only.

Two costs are worth recording against it. The full-fidelity port duplicated a
940-line specification into a 589-line English delta, and the two can now drift;
that duplication was a deliberate choice, taken so `openspec/` would be a working
artifact for Task C rather than a demonstration, but it is a genuine maintenance
cost and not a free one. And the validator gives more assurance than it earns:
"`Change is valid`" is compatible with most of a requirement's scenarios having
silently disappeared, which was verified above rather than assumed. Anyone
relying on that line as a completeness check would be relying on something it
does not do.

The honest summary: the tool paid for itself in structure and in the parsed
model, it did not think about the domain at all, and its assurances need to be
read for what they actually cover.

## Addendum — the third phase, run in Task C

Everything above was measured at the end of Task B. Task C implemented the
change and then closed the cycle, so two facts stated above have moved.

**The criterion count is now 60, not 58.** The reverse check of Task C found two
behaviours the prose of the specification required and no criterion pinned: an
`expiresAt` that is absent or not a string, and a `value` of `Infinity`. Both
were added as AC-59 and AC-60 — to `docs/spec/pricing-discounts.md` first and to
the delta second, in the order section 11 of the specification mandates. Every
count of 58 above is the Task B state; the archived spec holds 60 scenarios
across the same 11 requirements. Nothing in OpenSpec found this or could have:
the delta was `valid` under `--strict` with both gaps open, because a missing
criterion is not a structural defect. It was found by reading the code back
against the criterion list by hand.

**`openspec archive add-discount-engine --yes` was run** once `npm test` was
green. It reported `Task status: ✓ Complete`, applied `+ 11 added` requirements,
moved the change to `openspec/changes/archive/2026-09-06-add-discount-engine/`
and created `openspec/specs/order-discounts/spec.md`. `openspec list` now says
`No active changes found`; `openspec list --specs` says
`order-discounts requirements 11`.

What that adds over the planning phases is one thing, and it is a real one: the
delta stops being a document about a change and becomes the current description
of the capability, with the change kept beside it as history. The `ADDED` /
`MODIFIED` vocabulary that "cost nothing and bought nothing yet" now has
something to modify — the second change to discounts will be reviewable as an
edit against this file rather than as a diff of a long document. That is the
mechanism, not a measurement: this repository has one change, so the payoff is
still promised rather than observed.

What it does **not** add is any check that the archived spec matches the code.
`archive` verified that the task list was ticked, and the task list was ticked by
hand. Nothing in the tool ran the tests, and nothing in it knows
`app/src/discounts.ts` exists. The link between the specification and the
implementation is still `docs/traceability.md` and the criterion ids in the test
names — both of which this repository added.
