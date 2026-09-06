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
| `tasks.md` | 110 | 34 checkbox tasks, each naming its own verification |

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
| The `## Purpose` section deleted | **valid** — despite the schema instruction requiring it |

So the validator checks structure at the *requirement* level and stops there. A
requirement that loses every scenario is caught; a requirement that loses most of
them is not. The dropped criteria are not entirely unannounced — each one draws
an INFO line naming the header — but that line is phrased as a heading-style
hint, `is not a "### Requirement:" header and is ignored by validation`, it is
not raised to a warning by `--strict`, and the verdict stays `Change is valid`
with exit code 0. Nothing in the output says that four acceptance criteria left
the parsed model. The schema's own instruction warns that a three-hashtag
scenario "will fail silently" — that warning is accurate at the level that
matters, and `--strict` does not lift it.

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
