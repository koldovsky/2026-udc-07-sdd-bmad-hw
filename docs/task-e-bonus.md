# Task E (bonus) — Path 3: my own agent / workflow step

> Paths 1 (multi-role pipeline) and 2 (second SDD tool) were deliberately not
> attempted: one path done properly beats three halves.

## What I built

An **adversarial specification reviewer** — an agent whose only question is
*"two competent engineers implement this spec independently; where do they ship
different behaviour?"* It is read-only, forbidden from writing code, and it must
produce, for every finding: the two defensible readings, **a concrete input that
separates them with actual numbers**, a severity, and whether an engineer or the
business owns the decision. A finding without a separating input must be labelled
speculative.

Then I did the part that usually gets skipped: **I scored it against a
pre-registered answer key.** Tasks C and D had already produced ground truth — the
reverse check found 5 defects, the A/B measured 4 behavioural divergences — so the
key (K1–K8 below) was written down *before* the reviewer ran, in the plan file.
Without that, "the reviewer found some things" is unfalsifiable.

**Prompt / config:** [`docs/task-e/spec-reviewer-prompt.md`](task-e/spec-reviewer-prompt.md)
— committed verbatim, including the frontmatter it would carry as
`.claude/agents/spec-reviewer.md` (that path is gitignored in this repo, hence the
copy under `docs/`).

The prompt deliberately contains **no hints**: it never mentions out-of-scope
hazards, decision interactions, coupon-code casing, malformed values, rounding
allocation or refusal precedence — every category where I already knew defects
lived. It says only *how* to look, never *where*. Excerpt:

> Take each decision and ask what it does **not** say. Take each acceptance
> criterion and ask what an implementation could do that still satisfies it. Take
> each claim the specification makes about itself and ask whether it is actually
> true. […] Be adversarial about your own findings too. If you cannot state the two
> divergent behaviours concretely, you have found a stylistic preference, not an
> ambiguity.

**Isolation.** Fresh context, same model, isolated git worktree. It reviewed the
**17-criterion** version of the spec (commit `6cbda10`) — the one I had marked
`agreed` — and could not reach `docs/traceability.md`, `docs/ab-validation.md` or
`app/src/discounts.ts`, all of which were uncommitted and therefore in no branch
and no git object. Full output: [`docs/task-e/reviewer-output.md`](task-e/reviewer-output.md).

One disclosure: the harness checked the worktree out one commit behind, so the
spec was not on its filesystem; the agent noticed and read the blob from the
worktree's own object store. It reported that itself, unprompted. The isolation
that mattered held — uncommitted files exist in no object store.

## What it found on my real spec

Every finding below was then **verified by running the input through
`app/src/discounts.ts`**, not accepted on the reviewer's authority. All seven
predictions matched to the kopeck.

| # | Finding | Verified behaviour | Impact |
|---|---|---|---|
| 1 | **`now >= expiresAt` compares a `Date` to a `string`.** The literal expression is always `false`, so both engineers must invent a bridge the spec never gave: `Date.parse` instants vs lexicographic ISO comparison | on `expiresAt: "2026-09-09T12:00:00+03:00"` with `now = 10:00Z`: parse → **expired** (104_900), lexicographic → **applies** (94_900) | **100 грн**, plus host-timezone dependence that breaks D-17's purity claim |
| 2 | **A percent coupon over 100% is never clamped to its base** — step 5.7 clamps only fixed coupons — while §2 names `value: 150` and promises the clamps handle it | `FRESH150` on a 40_000 fresh category: discount **60_000**, total **44_900** | **200 грн**; the discount exceeds the category it applies to |
| 3 | **Duplicate catalog entries have no resolution rule** — `find` (first wins) vs `Map` (last wins) are both idiomatic | two `SAVE` entries at 10% and 20%: 94_900 vs 84_900 | **100 грн** |
| 4 | **A negative `value` raises the price, and a non-integer one produces a fractional total** — §2's "the clamps keep the total sane regardless" and D-4's "every operation is integer" are both false | `percent: -10` → total **114_900** (100 грн *more* than no coupon); `fixed: 7.5` → total **104_892.5** | **money, wrong direction**, and it breaks the document's own whole-kopecks premise |
| 5 | **A coupon whose discount rounds to 0 is accepted and burns its scope,** blocking a later real coupon — step 5.5.6 tests `base`, D-15's rationale argues for testing the granted amount | 49-kopeck order, `[ONEPCT, SAVE49]`: ONEPCT applies for **0** and SAVE49 is refused `duplicate-scope`; total **4_949** instead of 4_900 | trivial money, materially wrong receipt |
| 6 | **`duplicate-code` fires even when the first occurrence was itself rejected** — the "seen" set is never defined | `["OLD","OLD"]`, expired: `[expired, duplicate-code]` vs `[expired, expired]` | no money; wrong reason shown to the customer |
| 7 | **AC-10 never states its customer tier.** "The same coupon" points at AC-9, whose customer is gold — under that reading the stated total is unreachable | gold → 49_810, not the stated 54_800 | no shipped difference; a wasted debugging cycle |

It also demonstrated that **`max(0, …)` in the algorithm's final step is dead
code** for all non-negative inputs, and refuted a self-claim in D-5a: the spec says
the ≤1-kopeck per-category drift "can never reach the customer", but with three
4-kopeck categories at gold the third coupon **reports `discountKopecks: 3` for a
category worth 4** — verified.

### Score against the pre-registered key

| Key item | Result |
|---|---|
| K1 — D-10 decided but no AC pins it | **missed** (out of remit: unambiguous, merely untested) |
| K2 — D-17 purity decided but no AC pins it | **partial** — found a *live threat* to it (timezone path, finding 1) rather than the coverage gap |
| K3 — refusal precedence untested | **found** (finding 6), stated more precisely than my own version |
| K4 — unparsable `expiresAt` waved away | **found** (inside finding 1), same numbers |
| K5 — negative value raises the price; §2's claim false; AC-16 still passes | **found** (finding 4), independently derived, including the "no test catches it" detail |
| K6 — order-wide then category coupon interaction | **correctly ruled closed** — the spec is unambiguous here; my Task D finding was divergence from *other* implementations, not ambiguity. Its counter-example arithmetic checks out |
| K7 — D-5a drift | **found and improved** — refuted the spec's own "can never reach the customer" claim with a constructed case |
| K8 — D-10 as a business decision worth escalating | **missed** (out of remit for the same reason as K1) |

**4 found, 1 partial, 1 correctly-closed, 2 missed — and 6 novel real defects
(findings 1, 2, 3, 5, 6, 7) that neither the reverse check nor the A/B had caught.
Zero false positives across seven verified predictions.**

The two clean misses share a shape: K1 and K8 are *coverage and escalation* gaps,
not ambiguities. An unambiguous decision with no test is invisible to "where would
two engineers diverge?", because both engineers implement it identically. That is
not a defect in the reviewer; it is the boundary of the question I gave it, and it
says something useful — **an ambiguity hunter and a traceability check are not
substitutes.** Each found what the other structurally cannot.

## Was it a real find?

Yes, and finding 2 is the one that settles it. In Task D I tested a percent value
of 150 and recorded "same outcome" — because I happened to use an **order-wide**
coupon, where the running-remainder cap hides the bug. The reviewer used a
**category** coupon, where nothing caps it, and produced a 60_000 discount against
a 40_000 category. My A/B had the right idea and the wrong fixture; a fresh
adversarial reader found the fixture I should have chosen. Finding 1 is arguably
worse: my spec's central expiry rule is written as an expression that, taken
literally, never fires, and I never noticed across three passes over the document.

Cost: one prompt (~90 lines), one agent run of about 11 minutes, and the verification
script. Against that, six real defects in a document that had already survived a
reverse traceability check and a two-run A/B. This is the cheapest defect-per-minute
step in the whole exercise — and unlike the SDD tool in Task B, it produced
*judgement* rather than structure.

**Where I would put it in the loop:** immediately after the spec is drafted and
*before* any code exists, because five of the seven findings are one-line document
edits at that point and behaviour changes afterwards. And it should be run by an
agent with no memory of writing the spec — the whole value is that it does not
know what I meant.

**What I did with the findings:** nothing yet, deliberately. Findings 2, 4 and 5 are
the same class as the negative-value case already recorded in
`docs/traceability.md` (#5) and `docs/ab-validation.md` — hazards that §2 of the
spec declares out of scope — and the standing decision on that class is to
document rather than patch, so that the Task D measurements keep matching the
shipped code. Findings 1, 3, 6 and 7 are genuine specification gaps whose fix is
one sentence each; they are recorded here rather than silently closed, so the
score above stays checkable against the artifact the reviewer actually read.
