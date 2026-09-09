# Task B — SDD tool: OpenSpec

**Tool:** OpenSpec `1.12.0` (`@fission-ai/openspec`), run through `npx` — no
global install.
**Input:** the Task A specification, `docs/spec/pricing-discounts.md`
(19 decisions D-1…D-19, 17 acceptance criteria AC-1…AC-17).
**Scope of this task:** planning artifacts only. No implementation — that is
Task C, and OpenSpec's own `propose` skill enforces the same boundary
("This workflow creates planning artifacts only… Do not edit project code").

## Commands actually run

```bash
npx @fission-ai/openspec@latest init --tools claude,agents --no-animation
npx @fission-ai/openspec@latest new change add-order-discounts
npx @fission-ai/openspec@latest status --change add-order-discounts --json
npx @fission-ai/openspec@latest instructions proposal --change add-order-discounts --json
npx @fission-ai/openspec@latest instructions specs    --change add-order-discounts --json
npx @fission-ai/openspec@latest instructions design   --change add-order-discounts --json
npx @fission-ai/openspec@latest instructions tasks    --change add-order-discounts --json
npx @fission-ai/openspec@latest validate add-order-discounts --strict
npx @fission-ai/openspec@latest show add-order-discounts --json --deltas-only
npx @fission-ai/openspec@latest list
npx @fission-ai/openspec@latest doctor
```

## What it generated

`init` created **24 files**, none of which I had to write:

| Path | What it is | In the PR? |
|---|---|---|
| `openspec/config.yaml` | schema selector (`spec-driven`) + the project `context:` and per-artifact `rules:` hooks | yes |
| `openspec/specs/.gitkeep`, `openspec/changes/archive/.gitkeep` | the baseline-spec and archive homes, empty until a change is archived | yes |
| `.agents/skills/openspec-{propose,apply-change,update-change,sync-specs,archive-change,explore}/SKILL.md` | the six workflows as portable agent skills (1 231 lines) | yes |
| `.claude/commands/opsx/*.md` + `.claude/skills/openspec-*/SKILL.md` | the same six workflows as Claude Code slash commands and skills (12 files) | **no — `.gitignore` in this repo excludes `.claude/*`** |

`new change` scaffolded the change directory; the four artifacts inside it were
then written by me under the CLI's direction:

- `openspec/changes/add-order-discounts/proposal.md` — why + what + capabilities
- `openspec/changes/add-order-discounts/specs/order-discounts/spec.md` — the
  delta spec: **10 requirements, 19 scenarios**, AC ids preserved
- `openspec/changes/add-order-discounts/design.md` — the 19 decisions with
  rationale and rejected alternatives, plus the contract and the algorithm
- `openspec/changes/add-order-discounts/tasks.md` — **23 checkbox tasks**, each
  carrying its own verification

Two corrections to what I expected going in, worth recording because the
walkthrough warns that writing about these tools ages badly:

- There is **no `openspec/project.md`** in 1.12.0. Project context is a
  `context:` key in `openspec/config.yaml`, and the CLI injects it into every
  artifact's instructions.
- Despite `--tools claude,agents`, **`AGENTS.md` and `CLAUDE.md` were not
  touched** (`git diff` on both is empty). `agents` means the shared
  `.agents/skills/` directory; the CLI even reports "Commands skipped for:
  agents (no adapter)". The permission I asked for to edit those seeded files
  turned out not to be needed.

## What it added over a plain markdown spec

Five things I can point at, not assert:

1. **A dependency graph over the artifacts, served by the CLI.**
   `status --change X --json` returns `proposal → (specs, design) → tasks` with
   `requires` edges and `ready`/`blocked` states, and `applyRequires` naming what
   implementation depends on. A markdown spec has no notion of "you cannot write
   tasks yet".

2. **Templates and rules delivered at the moment of writing.** Each
   `instructions <artifact> --json` returns `template`, `instruction`, the
   project `context` and `rules`, and a `resolvedOutputPath`. The `context:` I
   wrote once into `config.yaml` (protected functions, kopeck integers, "preserve
   the D-/AC- ids") came back injected into all four artifact instructions. That
   is the real difference from a convention living in a `CONTRIBUTING.md`
   nobody re-reads.

3. **A validator with teeth.** I probed it with three deliberate defects and
   restored the file afterwards (`diff` confirms byte-identical):

   | Defect | `validate --strict` result |
   |---|---|
   | `#### Scenario:` demoted to `### Scenario:` | **caught** — `[ERROR] ADDED "Tier and coupon discounts stack sequentially" must include at least one scenario`, plus an `[INFO]` naming the header it ignored and why |
   | a requirement with no scenario at all | **caught** — `[ERROR] ADDED "Orphan requirement with no scenario" must include at least one scenario` |
   | `## Purpose` cut to `Discounts.` (10 chars) | **not caught** — reported valid, although the tool's own instruction says `--strict` flags a Purpose under 50 characters |

   The enforced rule — *every requirement must carry at least one WHEN/THEN
   scenario* — is exactly the property this homework's rubric asks for, and it is
   now checked by a command rather than by my care.

4. **Machine-readable requirements.** `show --json --deltas-only` parses the
   markdown into 10 structured deltas (~20 KB of JSON) with each requirement's
   text and scenario list. `list` reports `add-order-discounts 0/23 tasks`, so
   progress through implementation is queryable rather than eyeballed.

5. **A baseline/delta lifecycle.** `changes/` holds the proposal as a delta
   against `specs/`, which stays empty until `archive` promotes the change into
   the deployed truth. On a repo that accumulates capabilities over years, this
   is the part a flat spec file cannot do. **Unproven here**: I have not archived
   anything, so I am reporting the mechanism, not a benefit I felt.

## What stayed manual

- **Every decision.** All 19 forks — sequential vs additive stacking, the
  rounding direction, the discount base, per-category bases, the discount floor,
  refusal reasons — were resolved by me in Task A. OpenSpec has no opinion on any
  of them and never asked. Its `propose` skill instructs the *agent* to ask about
  material ambiguity, which relocates the judgement into the model; the tool
  itself detects nothing.
- **Every number.** All 17 acceptance criteria and their kopeck figures were
  carried over from `docs/spec/pricing-discounts.md`. The validator checks that a
  requirement *has* a scenario; it cannot tell `13_500` from `13_499`.
- **All prose.** The CLI creates empty scaffolds and serves a template; the four
  artifacts are hand-written content.
- **Reconciling two formats.** The same requirements now exist twice — as the
  Task A spec and as a delta spec. I kept the D-/AC- ids identical in both and
  declared `docs/spec/pricing-discounts.md` authoritative, but this is real
  duplication: 19 scenarios restated in OpenSpec's shape.
- **Trusting the docs.** One documented `--strict` check did not fire; one
  documented failure mode ("using 3 hashtags will fail silently") behaves better
  than documented. Both directions of drift argue for probing the tool rather
  than quoting it.

## Verdict

For a feature this size, OpenSpec added **structure and enforcement, not
thinking**. The honest accounting: it cost about ten minutes of setup and
produced a validator that catches a real class of sloppiness (an unverifiable
requirement), a dependency order that stopped me writing tasks before specs, and
a machine-readable form of the requirements. It resolved zero of the 19
ambiguities that made this ticket hard — the entire value of Task A survived
independently of the tool.

Where I expect it to actually pay off is the part I did not exercise: a second
and third change landing against an accumulating `openspec/specs/` baseline,
where "what does the system do today" and "what is this change proposing" stop
being the same document. On a single-change homework, a good markdown spec plus
`grep` would have got me to the same place — with the one exception that the
validator caught structural defects that I would otherwise only have discovered
when a reviewer read the file.
