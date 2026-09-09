# A/B: with the specification vs ad-hoc (Task D)

**Feature:** discounts from `materials/feature-request.md`
**Host / model:** Claude Code / Opus 5 (1M context), same model for every run
**Runs:** one with the spec (**A** = Task C), two without (**B1**, **B2**)

Every claim below is checkable. Run B's code is committed verbatim under
`docs/ab-validation/`, and each numeric difference was produced by executing both
implementations on the same input, not by reading them.

## Method and provenance

Run A is Task C: I implemented `docs/spec/pricing-discounts.md` directly.

For Run B, I could not honestly play an agent that has never seen the spec — I
wrote it. So each B run is a **separate agent with a fresh context** (same model,
inheriting nothing from the session that produced the spec), working in an
isolated git worktree checked out at **`c339625`** — the commit *before* Task A,
where `docs/spec/`, `openspec/` and `app/src/discounts.ts` do not exist on disk.
Each was given `materials/feature-request.md`, the code, `AGENTS.md` and
`app/AGENTS.md`, and was told to decide autonomously rather than ask.

**Two deviations from a literal "new chat", stated because they bound the
result:** a subagent is a fresh context rather than a new interactive session, and
being told to decide autonomously suppresses the questions a real chat might have
asked. Both B runs listed the questions they *would* have asked instead — see
below, because that list is itself a finding.

### Run B1 was partially contaminated, which is why there are two B runs

B1 read the **main** repo's `app/src/index.ts` through an absolute path. Because
Task C had already added exports there, it saw the names `priceOrder`,
`PriceBreakdown`, `AppliedCoupon`, `RejectedCoupon`, `CouponRejectionReason` — and
its own report credits that file for its contract shape. It never read the spec or
my implementation (verified against its transcript: the only repository files it
opened were `materials/feature-request.md`, both `AGENTS.md`, `types.ts`,
`pricing.ts`, `pricing.test.ts`, `index.ts`, `package.json`, `tsconfig.json`), so
its resolution of the *business* forks is untainted — but its type names are not
independent evidence.

It also attempted two writes into the main repo (`app/src/discounts.ts`,
`app/src/discounts.test.ts`). **Both were blocked** by the worktree isolation; it
then wrote to its own tree. My Task C files were verified intact afterwards
(mtimes unchanged, 27 tests still green, none of B1's markers present).

Run B2 repeated the exercise with explicit path confinement ("use only relative
paths; if a tool result shows a path outside `.claude/worktrees/`, you have
escaped"). It stayed inside its tree and reported so. **B2 is the clean run**;
B1 is retained because two independent ad-hoc runs answer a question one cannot:
*how stable are an un-spec'd agent's silent choices?*

> Methodological finding worth more than it cost: isolating an agent from your own
> work is harder than it looks. Forbidding a directory is not enough when the
> agent can construct an absolute path to a sibling checkout — the isolation has to
> be structural (a tree where the file does not exist), and even then it needs
> verifying afterwards, not assuming.

## Run A — with the specification

- **What came out:** `app/src/discounts.ts` (176 lines) —
  `priceOrder(order, catalog, now): PriceBreakdown`, composed from the existing
  `subtotalKopecks` / `shippingKopecks` / `tierPercent` / `lineTotalKopecks`.
  `app/src/discounts.test.ts` with 19 tests, plus exports in `index.ts`.
- **Decisions on the ambiguities:** all 20 taken from the spec (D-1…D-19 incl.
  D-5a); no deviation, and none re-litigated during coding. Every branch in the
  code carries the `D-n` marker of the decision that put it there.
- **Tests:** 19, one per acceptance criterion, named `AC-N: …`; 6 boundary cases;
  the AC-16 reconciliation invariant asserted inside all 19 rather than once.
- **What the process caught that the code did not:** the reverse check in
  `docs/traceability.md` found two decisions (D-10 exact matching, D-17 purity)
  that were specified and implemented but untested, and two more that were left
  deliberately open. AC-18 and AC-19 were added as a result.

## Run B — ad-hoc, no specification

### B1

- **What came out:** `app/src/discounts.ts` (301 lines),
  `priceOrder(order, catalog = [], now = new Date())`, 40 tests. Green on the
  first `npm test`; typecheck clean first time.
- **Approach:** category "buckets" with a `remainingKopecks` field; the rounded
  tier discount is distributed across buckets by **largest-remainder allocation**;
  7 rejection reasons in `snake_case`.
- **Forks it resolved silently:** 22, listed in a header comment block in its own
  code, keyed to `AC-1…AC-13` ids it invented for its own test names — i.e. it
  spontaneously produced a miniature spec *inside* the implementation.

### B2 (the clean run)

- **What came out:** `app/src/discounts.ts` (348 lines),
  `priceOrder(order, catalog?, now?)` returning a
  `PriceBreakdown` whose `discounts: DiscountLine[]` treats the tier discount as
  just another line (`source: "tier" | "coupon"`), 44 tests, and an additive edit
  to `index.ts`. Green on the first `npm test`; **0** edit→test cycles.
- **Forks it resolved silently:** 25, written as `D-1…D-13` in a header block,
  with every test referencing its D-id. It also independently invented the
  decision-record-in-the-code pattern.
- **Where it went further than either A or B1:** case-insensitive, trimmed coupon
  lookup; echoing the catalogue's canonical spelling on success and the
  customer's typed spelling on rejection; omitting zero-amount discount lines
  entirely; first-entry-wins for duplicate catalog codes.

## Comparison of decisions

A = the spec's choice. **same** = reached independently; **differs** = a visibly
different behaviour. Money differences were measured by running both engines on
the same order.

| Fork | A (per spec) | B1 | B2 | Match |
|---|---|---|---|---|
| D-1 stacking | sequential, tier first | sequential | sequential | same / same |
| D-2 discount base | items only, shipping never | items only | items only | same / same |
| D-3 several coupons | all, one per scope | all, one per scope | all, one per scope | same / same |
| D-4 rounding | half-up, per discount, integer | half-up, per discount | half-up, per step | same / same |
| D-5 category coupon base | that category only | that category only | that category only | same / same |
| **D-5a tier → category base** | **recompute per category** | largest-remainder allocation | largest-remainder allocation | **differs / differs — 1 kopeck** |
| D-6 min subtotal | gross, inclusive `>=` | gross, inclusive | gross, inclusive | same / same |
| D-7 lower bound | items floor 0, shipping charged | same | same | same / same |
| D-8 invalid coupon | reported, never thrown | reported | reported | same / same |
| D-9 unknown code | refused `unknown` | `unknown_code` | `unknown-code` | same / same |
| **D-10 code matching** | **exact, case-sensitive** | exact, case-sensitive | **case-insensitive + trimmed** | same / **differs — 10 000 kopecks** |
| **D-11 evaluation instant** | **required parameter** | optional, defaults to `new Date()` | optional, defaults to `new Date()` | **differs / differs (purity)** |
| D-12 fixed coupon clamp | clamp to base | clamp, and floor at 0 | clamp, and floor at 0 | same+ / same+ |
| D-13 application order | typed order | typed order | typed order | same / same |
| D-14 repeated code | `duplicate-code` | `duplicate_code` | `duplicate-code` | same / same |
| D-15 zero base | refused `no-eligible-items` | split into 2 reasons | `no-items-in-category` | same / same |
| D-16 tier category exclusions | none | none | none (but flagged as a question) | same / same |
| D-17 purity | pure, no clock | pure (asserted by a test) | pure | same / same |
| D-18 reporting | total + per coupon | + base and scope per coupon | tier as a discount line too | same / same |
| D-19 invariant | reconciliation + accounting | balance + integrality | balance + integrality | same / same |

**Forks the ad-hoc runs handled that the spec had declared out of scope:**

| Case | A (per spec §2) | B1 | B2 | Measured |
|---|---|---|---|---|
| unparsable `expiresAt` | coupon **applies** | refused `expired` | refused `expired` | Δ 10 000 kopecks |
| negative fixed `value` | **total rises to 109 900** | clamped to 0 | clamped to 0 | Δ 5 000 kopecks |
| `percent: 150` | clamped by the 0-floor | clamped to 100 | clamped by 0-floor | same outcome |
| duplicate catalog entries | undocumented (first wins) | first wins | first wins, stated | same |
| order-wide **then** category coupon | category base untouched | allocated across buckets | allocated across buckets | **Δ 2 000 kopecks** |

### The four measured differences, concretely

1. **Order-wide coupon followed by a category coupon — 2 000 kopecks (20 грн).**
   On fresh 40 000 + standard 60 000 with a fixed 10 000 order-wide code then a
   50% fresh code: A charges 74 900, both B runs charge 76 900. A's algorithm
   decrements only the running remainder for an unscoped coupon, so `fresh` is
   effectively discounted 60% by a 50% coupon plus its share of the order-wide
   one. **This is a fork my spec resolved implicitly in its algorithm and never
   tested** — no AC covers the interaction, so the Task C reverse check missed it.
   The A/B found it. Both ad-hoc runs chose the more coherent behaviour.
2. **Unparsable `expiresAt` — 10 000 kopecks.** A applies the coupon
   (`now >= NaN` is false); both B runs fail closed. The spec put catalog validation
   out of scope; neither ad-hoc run granted itself that permission.
3. **Negative fixed `value` — A prices the order 5 000 kopecks *higher* than no
   coupon at all** (109 900 vs 104 900), because the discount goes negative. The
   AC-16 invariant test passes throughout — the components still reconcile
   perfectly. The spec's §2 states "the clamps in D-7/D-12 keep the total sane
   regardless"; that sentence is **measurably false**, and an invariant I wrote
   specifically to catch drift is satisfied by a coupon that raises the price.
4. **Case-sensitivity — 10 000 kopecks, and the two ad-hoc runs disagree with each
   other.** A and B1 refuse `save10` against a `SAVE10` catalog; B2 applies it. On
   a 1 000 грн order that is 100 грн, decided differently by two runs of the same
   model on the same ticket.

## Effort

| | A (with spec) | B1 (ad-hoc) | B2 (ad-hoc) |
|---|---|---|---|
| Preparation (writing the spec) | **~15–25 min (estimated)** | 0 | 0 |
| Implementation + tests | **148 s (measured)** | 338 s (measured) | 204 s (measured) |
| Iterations after the first attempt | **1 test run, 0 red** (measured) | 1 run, 0 red (self-reported) | 1 run, 0 red (self-reported) |
| Tests produced | 19 | 40 | 44 |
| Clarifying questions asked | 0 | 0 (14 listed unasked) | 0 (10 listed unasked) |

A's implementation window is `git` commit time → test-file mtime (137 s), plus
~11 s to green. A's preparation is **not instrumented** — Task A was not timed —
so it is an estimate bounded by what the session shows: reading six files, three
clarifying questions to the user, a 215-line spec, and an independent reference
implementation written to verify the AC arithmetic. It is the largest cost in the
table and the least precisely known; I would rather say that than invent a figure.

Note the direction: **with the spec, implementation was faster than either ad-hoc
run** (148 s vs 204 s and 338 s) — the deliberation had already happened — but it
produced fewer tests, because it tested exactly the 19 criteria rather than
everything the implementer thought of.

## Conclusion

Of 20 forks, the un-spec'd runs matched the spec on **16**, differed on **D-5a**
(1 kopeck) and **D-11** (a defaultable clock), and B2 alone differed on **D-10**
(100 грн per affected order). On the five cases my spec declared out of scope, both
ad-hoc runs implemented protective behaviour I had explicitly licensed myself not
to write — and in one of those, A is strictly worse: a negative coupon value makes
my implementation *increase* the price. So the honest count of "silent decisions I
would have disliked" is close to **one** (case-sensitivity), while the count of
places where the un-spec'd runs were *better* than the spec-driven one is **three**.

Would I have caught the difference at review without the spec? The 20-грн
order-wide-then-category interaction: almost certainly not — it needs a two-coupon
basket and arithmetic, and it is the difference my own reverse check also missed.
The 100-грн case-sensitivity question: yes, but only because I would have asked
"are codes case-sensitive?", which is exactly what both agents put on their
would-have-asked lists. That, not the code, is where an un-spec'd agent actually
leaks: **both runs produced coherent, defensible, well-tested engines and a list of
10–14 questions nobody answered.** Coherence is not agreement.

Was the spec worth it *on this feature*? **No, if you measure it in implementation
outcomes.** A good ticket plus a competent agent got ~90% of the way, and the
ticket itself helped enormously — its "Що з цим не так" section names eight of the
forks outright, so no run was blind to their existence, only to their resolution.
Both ad-hoc runs independently invented a decision-record header comment and
AC-numbered tests, which is to say: the practice the exercise teaches is one a good
agent already reaches for. Meanwhile the spec cost roughly 6–10× the
implementation time and saved perhaps a minute of deliberation.

Where it *did* pay, and this is not nothing:

1. **Reproducibility over agreement.** Three runs produced three different
   contracts (`PriceBreakdown` shapes, 6 vs 7 rejection reasons, three naming
   conventions). Only A's is fixed in a document a second engineer can implement to
   the same kopeck. B1 and B2 each documented their choices *after* making them,
   in code, where nobody negotiated them.
2. **The reverse check.** It found two decisions that were implemented but
   untested, which no amount of green tests would have surfaced.
3. **Named accountability for money.** D-1's 15 грн and D-10's 100 грн are
   business decisions. The spec makes them someone's decision on a dated document;
   the ad-hoc runs make them an implementation detail with a plausible comment.

Where the spec became a liability: the **out-of-scope section**. "Catalog
validation is out of scope, the clamps keep the total sane" was a claim I did not
test and that turned out to be false. Neither ad-hoc run had the authority to
declare a hazard out of scope, so neither shipped the bug. A specification's
permission to *not* handle something is the most dangerous sentence in it.

At what size would this flip? The moment a second capability touches the same
rules — a free-shipping coupon kind, a discount cap, per-customer usage limits —
because then "what does the system do today" has to be answerable without reading
three implementations. On a single 176-line engine implemented once, a sharp ticket
and a reverse check would have been the better trade.
