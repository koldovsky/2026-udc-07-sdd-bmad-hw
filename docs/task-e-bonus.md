# Task E (bonus) — Path 3: a custom specification-ambiguity reviewer

## What was built

A single-purpose review agent whose only job is to find places in a
specification where two competent engineers, both following the text honestly,
could ship different behaviour. It was run against
`docs/spec/pricing-discounts.md` — the Task A document, 33 decisions, 61
acceptance criteria, 5 invariants — after that document had already survived the
OpenSpec cycle of Task B, the implementation and reverse traceability check of
Task C, and the A/B comparison of Task D.

Four constraints shape it, and each exists because of a failure mode observed in
the earlier tasks.

**It reads the specification and nothing else.** The implementation, the tests,
`docs/traceability.md`, the OpenSpec artifacts and the original ticket are all
off limits. An agent with the code in context stops reviewing the document and
starts describing the code, and every finding it produces then reads "the spec
does not mention what the code does" — which is a different question, already
answered by the Task C reverse check.

**Findings must fall into one of five named categories** — underspecified,
conflict, unbound term, unpinned rule, order dependence. The list is closed, and
wording, structure, formatting and "could be clearer" are excluded explicitly. A
reviewer allowed to report prose quality reports prose quality, because there is
always some.

**Each finding must pass a two-readings test.** The agent has to write out
reading A and reading B as concrete behaviours the same text permits, and the
observable difference between them. A finding that cannot name the second
reading is not reported. This is the single rule that does the most work: it
converts "this is vague" into "these two implementations both comply".

**A `Checked and closed` section is mandatory.** Every place that looked
ambiguous and is not must be listed with the text that closes it. Without this
section a short report is indistinguishable from a shallow one, and the reader
cannot tell whether silence means "nothing there" or "did not look".

## Prompt / config

`docs/task-e/spec-ambiguity-reviewer.md` — the full system prompt and the way it
was invoked.

## What it found on the real specification

One run: 4 findings, 28 entries in `Checked and closed`, ~8 minutes, 101 516
tokens, 3 tool calls. Every finding was then verified by hand against the
document before anything was changed.

### Confirmed: a non-string catalog `code` is specified twice, incompatibly

The document answers one question in two places and gives two different answers.

- Section 3 lists `coupon.code` as a caller guarantee and then names the closed
  set of decisions that survive a broken level-2 value — D-20, D-24, D-25, D-27,
  D-28, D-29, D-30, D-31, D-32 — adding that this is "**єдиний** повний перелік".
  A catalog `code` that is not a string is in none of them, so the behaviour is
  undefined.
- Section 7 and the `priceOrder` JSDoc say the opposite in bold: *any* bad value
  inside a correct shape never throws, and "зіпсований запис у каталозі не
  обвалює сторінку оформлення ніколи".

Step 5 requires catalog codes to be compared normalised. An implementer
following section 3 writes `entry.code.trim().toUpperCase()`; a `TypeError`
escapes `priceOrder` on `code: null` and the checkout page renders nothing. An
implementer following section 7 writes `String(entry.code ?? "")` and prices the
order. Both can cite the specification.

The finding is sharpened by what the document already contains: D-29 makes
exactly this argument — "один розробник напише `String(c ?? "").trim()`, інший
`c.trim()`, і обидва скажуть, що виконали специфікацію" — for `order.coupons`,
the other side of the same comparison. The catalog side was left open.

**Was it a real find:** yes, and it had survived three earlier checks.
`openspec validate --strict` called the delta `valid` with the contradiction
open, because a disagreement between two present statements is not a structural
defect. The Task C reverse check examined this exact branch and recorded a
deliberate decision *not* to pin it with a criterion, reasoning from section 3 —
that is, from one of the two sections that disagree. Branch coverage of 100%
showed the branch as covered, because the engine was already on the safe side
of it.

**What was done**, in the order section 11 of the specification prescribes:

1. Decision **D-33** added to section 4 — a non-string catalog code normalises
   to the empty string and is therefore unreachable, never fatal. The three
   other lists (section 3 exceptions, the section 6 JSDoc, the section 7
   robustness clause) were amended to carry D-33 so that all four now name the
   same set.
2. Criterion **AC-61** added to section 5, covering both arrangements: the
   corrupt entry in front of a valid one, and the corrupt entry alone.
3. OpenSpec change `harden-catalog-code` — a `MODIFIED` requirement carrying the
   full updated text of `Malformed catalog data never raises the total` plus the
   new scenario. `openspec validate --strict`: valid. `openspec archive`:
   `Totals: + 0, ~ 1, - 0, → 0`; the live capability spec now holds 11
   requirements and 61 scenarios.
4. Test `AC-61: a non-string catalog code is unreachable, not fatal` added to
   `app/src/discounts.test.ts`.
5. `docs/traceability.md` updated: the AC-61 row, the counts, the mechanical
   `seq 1 61` completeness check, and a rewrite of the paragraph that had
   recorded the decision to leave this case unpinned.

**Production code was not changed.** `normaliseCode` already accepts `unknown`
and returns `""` for a non-string, so the engine was doing the right thing for
no stated reason. To confirm the new test is not decorative, the guard was
removed temporarily — `const key = (coupon.code as string).trim().toUpperCase()`
— and the test run:

```
FAIL  src/discounts.test.ts > catalog lookup > AC-61: a non-string catalog code is unreachable, not fatal
TypeError: Cannot read properties of null (reading 'trim')
 ❯ indexCatalog src/discounts.ts:196:41
```

The guard was restored and the full suite is green: 69 tests, 8 seeded `pricing`
plus 61 named after criteria AC-1 … AC-61.

### Not confirmed: three findings that failed verification

| # | Claim | Verdict |
|---|---|---|
| F-2 | The calendar-existence probe (D-20) might be implemented for date-only strings, letting `"2026-02-30T10:00:00Z"` become an eternal coupon | **Rejected.** Step 5 states the probe applies to `y`, `m`, `d` "вичитані з `expiresAt`", with no branch on the form. The second reading contradicts the text rather than being permitted by it. What survives is thinner: no criterion uses a long-form impossible date, so an implementer who got it wrong would not be caught by the suite. Recorded here, not acted on. |
| F-3 | `categoryTotal(c)` is defined by a formula that contradicts the two sentences following it, for an item and a coupon that share an out-of-union category | **Real contradiction, no consequence.** The formula "сума … де `i.category === c`" does yield the item's total, while the next two sentences say such an item enters no `categoryTotal` and that `categoryTotal` of an out-of-union value is 0. Step 6 resolves it unconditionally ("Для `coupon.category` поза обʼєднанням `categoryTotal` дорівнює 0"), and D-31's guarantee that an unknown category "може лише **зменшити** знижку" only holds under that reading. The implementation is pinned; the notation sentence is loose. Left as is: rewriting it risks disturbing text that four criteria depend on, for no behavioural gain. |
| F-4 | "верхній регістр" does not fix `toUpperCase` against `toLocaleUpperCase`, so a Turkish default locale would break code matching | **Rejected.** Section 1 states the amount due follows from `order` + `catalog` + `now` and that "інших входів у розрахунку немає" (I-5). Host locale would be another input. The closure is in prose rather than in a checkable criterion — AC-48 compares two calls in one process and would not catch it — but the document does answer the question. |

## Was it worth it

**Precision was 1 in 4**, and that number is the honest headline. Three findings
had to be checked against the document and discarded, which took longer than
reading the one that held. An agent of this kind does not reduce the reading;
it directs it.

**The one confirmed finding was worth the whole exercise**, because of what it
had already got past: a strict validator, a 100%-branch-coverage suite, a
deliberate reverse-traceability pass over the exact same branch, and an
independent ad-hoc implementation in Task D. All four look for *absence* — a
missing scenario, an uncovered branch, an unpinned behaviour. This defect was not
an absence. It was two present statements disagreeing, and the only thing that
finds that class of defect is something reading the document as a whole with the
question "can this be read twice".

**The `Checked and closed` section did more work than expected.** Twenty-eight
entries, each quoting the text that closes the question, made the report
auditable in a way the findings alone would not have been: it showed which forks
were examined and rejected, so a thin report could be told apart from a lazy one.
It is also the part that confirmed the Task A decision table was doing its job —
almost every closure quotes a `D-` row and its rationale.

**Where this sits against the rest of the homework.** Task B measured what an SDD
tool adds over a good markdown specification and found: structure, an artifact
order, a parsed model, a delta vocabulary — and no opinion about the domain.
Task E measured what a purpose-built agent adds over the same specification and
found the opposite shape: no structure at all, one real defect in the content,
and three false alarms to sift. Neither replaces reading the document. The
reviewer is the cheaper of the two to build — one prompt file, no toolchain —
and it is the only one of the two that found something.
