# `spec-reviewer` output — verbatim

Task E, Path 3 evidence. This is the reviewer agent's report exactly as returned,
unedited, including the parts that turned out to be inaccurate (none were — see
the score in `docs/task-e-bonus.md`).

**Provenance.** Run as a subagent with a fresh context (same model, inheriting
nothing from the session that wrote the spec), in an isolated git worktree, given
the prompt in `docs/task-e/spec-reviewer-prompt.md` and read-only access. It never
saw `docs/traceability.md`, `docs/ab-validation.md` or `app/src/discounts.ts` —
all three were uncommitted at the time, so they existed in no branch and no git
object the worktree could reach.

**One deviation from plan, in the reviewer's favour to disclose:** the harness
checked the worktree out at `c339625` rather than at `HEAD`, so
`docs/spec/pricing-discounts.md` was not on its filesystem. The agent noticed and
read the blob out of the worktree's own object store
(`git show 6cbda10:docs/spec/pricing-discounts.md`) — the 17-criterion version, as
intended. It reported this itself in its first paragraph.

---

# Review: `docs/spec/pricing-discounts.md`

**Note on provenance:** the file is not present on this worktree's checked-out branch (`worktree-agent-a447d173a08e23825`, at `c339625`). It exists one commit ahead on `ws07/irakhmanov` (`6cbda10`), and I read it from this worktree's own object store via `git show 6cbda10:docs/spec/pricing-discounts.md`. Line references below are to that blob.

The specification is unusually tight on the forks the ticket named. Every finding below is in the territory the spec pushed out of scope, or in the seam between its prose and its algorithm.

---

## 1. The expiry comparison is written in a form that does not work, and each engineer must invent the bridge — money

**Where.** D-11 (line 58) and algorithm step 5.5.3 (line 82): "A coupon is invalid when `now >= expiresAt`". `now` is a `Date` (§5 contract, line 193); `expiresAt` is a `string` (`types.ts:36`, commented only as "ISO date"). No decision says how the two are reconciled.

The literal expression is broken TypeScript: `dateObject >= "string"` coerces the Date via `valueOf()` to a number and the string via `ToNumber` to `NaN`, so it is always `false` and nothing ever expires. Neither engineer will ship that, so both must invent a comparison the spec did not give them.

**The two readings.**
- **A:** `now.getTime() >= Date.parse(coupon.expiresAt)` — parse to an instant, compare instants.
- **B:** `now.toISOString() >= coupon.expiresAt` — lexicographic compare of ISO strings, avoiding `Date` parsing quirks entirely. Correct for normalized `…Z` strings, and a common shortcut when a field is documented as "ISO date".

**Separating input.** Order: one standard item, `subtotalKopecks` 100_000, `customerTier: "none"`, `country: "UA"`. Catalog: `{ code: "AUTUMN10", kind: "percent", value: 10, expiresAt: "2026-09-09T12:00:00+03:00" }`. `coupons: ["AUTUMN10"]`, `now = new Date("2026-09-09T10:00:00Z")`.
- **A:** `Date.parse` → `2026-09-09T09:00:00Z`; `10:00Z >= 09:00Z` → rejected `expired`. `couponDiscountKopecks` = 0, `totalKopecks` = **104_900**.
- **B:** `"2026-09-09T10:00:00.000Z"` vs `"2026-09-09T12:00:00+03:00"` → compares `"10"` < `"12"` → not expired, applies for 10_000. `totalKopecks` = **94_900**.

100 грн apart on a fully valid ISO 8601 input.

A second, independent fork lives in the same decision. Reading A also makes the result depend on the host timezone: per ECMAScript, a date-*time* string with no offset (`"2026-09-09T02:00:00"`) parses as **local** time, while a date-*only* string (`"2026-09-09"`) parses as **UTC**. So under A the same order prices differently on a Kyiv box than a UTC box — which contradicts D-17's purity claim and defeats D-11's own stated rationale ("makes its expiry tests unrepeatable"). Reading B is timezone-independent. And §2 (line 29) declares "an unparseable `expiresAt` is treated as given" without saying what that yields: under A, `NaN` comparison is `false`, so a coupon with `expiresAt: "whenever"` **never expires and applies**; an engineer failing closed rejects it `expired`. Same order as above: 94_900 vs 104_900.

**Severity.** Money, and non-determinism across machines. AC-7 ("WHEN `now` is exactly the coupon's `expiresAt`") does not close it — "exactly" presupposes the instant equality the spec never defines, and a UTC-normalized `Z` fixture passes under both readings.

**Whose decision.** Business/spec author. It needs a statement that `expiresAt` is a zone-qualified instant compared via `Date.parse`, plus a rule for unparseable values — or a type change, which §2 forbids.

---

## 2. A percent coupon with `value > 100` is not clamped to its base, while §2 promises it is — money

**Where.** §2 (lines 28–31) names `value: 150` for `kind: "percent"` as trusted input and asserts "the clamps in D-7/D-12 keep the total sane regardless." Algorithm step 5.7 (line 86) applies `min(value, base)` **only** to fixed coupons; for percent it computes the rounding formula and then only `min(d, remaining)`. D-12 (line 59) is titled "A fixed coupon larger than its base." Nothing bounds a percent discount by the base it was computed from.

**The two readings.**
- **A:** Follow step 5.7 literally. A 150% category coupon yields 1.5× the category's value, capped only by the order-level `remaining`.
- **B:** Honour §2's promise. Since the spec asserts the clamps handle `value: 150`, and D-12 establishes "a discount is clamped to its base" as the principle, apply `min(d, base)` to percent too.

**Separating input.** Order: `fresh` 40_000 + `standard` 60_000, `customerTier: "none"`, `country: "UA"`. Catalog: `{ code: "FRESH150", kind: "percent", value: 150, category: "fresh", expiresAt: far future }`. `coupons: ["FRESH150"]`.
- **A:** `categoryBase[fresh]` = 40_000; `d = floor((40_000 × 150 + 50)/100)` = 60_000; `min(60_000, remaining 100_000)` = 60_000. `totalKopecks` = **44_900**. `appliedCoupons` reports a 60_000 discount against a 40_000 category, and `categoryBase[fresh]` goes to −20_000.
- **B:** `d = min(60_000, 40_000)` = 40_000. `totalKopecks` = **64_900**.

200 грн apart. No acceptance criterion touches `value > 100`.

**Severity.** Money, unbounded in principle (a bigger `value` widens the gap up to the whole order).

**Whose decision.** Engineer can settle it, but §2's assertion is the problem: it is a false claim about the algorithm, and the fix is either a clamp in D-7 or removing the promise.

---

## 3. Two catalog entries with the same code — no resolution rule at all — money

**Where.** Algorithm step 5.5.2 (line 81): "not in catalog → reject `unknown`". The spec never says how a typed code resolves to a `Coupon` when the catalog contains more than one match. §2 declines catalog validation, so duplicates are explicitly in-bounds as input.

**The two readings.**
- **A:** `catalog.find(c => c.code === code)` — first match wins.
- **B:** `new Map(catalog.map(c => [c.code, c])).get(code)` — last match wins. Both are the idiomatic one-liner; B is the natural choice for anyone indexing the catalog once outside the loop, which the spec's own step-4/step-5 structure encourages.

**Separating input.** Order: 100_000, no tier, UA. Catalog: `[{ code: "SAVE", kind: "percent", value: 10, expiresAt: future }, { code: "SAVE", kind: "percent", value: 20, expiresAt: future }]`. `coupons: ["SAVE"]`.
- **A:** `d` = 10_000, `totalKopecks` = **94_900**.
- **B:** `d` = 20_000, `totalKopecks` = **84_900**.

100 грн apart, on identical inputs, with both engineers pointing at the same sentence.

**Severity.** Money.

**Whose decision.** Engineer can pick a rule, but which one is a data-integrity question — in a real campaign the two entries are typically old and new terms for the same code, and picking wrong honours the wrong promotion.

---

## 4. Negative and non-integer `value` — §2's and D-4's self-claims are both false, and the divergence is a charge increase — money

**Where.** §2 (lines 29–31): "a negative or non-integer `value` … is treated as given … the clamps in D-7/D-12 keep the total sane regardless." D-4 (line 50): "Nothing else rounds — every other operation is integer." Both are untrue of the algorithm as written, which is what splits the implementations.

**The two readings.**
- **A:** Implement steps 5.7–5.8 literally. `d` is never floored at 0, so a negative `value` produces a negative discount that *raises* the total; a non-integer fixed `value` flows through `min(value, base)` unrounded into `totalKopecks`.
- **B:** Treat §2's "keeps the total sane" and D-4's "every operation is integer" as normative and clamp: `d = max(0, min(d, remaining))`, rounding fixed values by D-4's half-up rule.

**Separating inputs.** Order 100_000, no tier, UA in both.
- Catalog `{ code: "NEG", kind: "percent", value: -10, expiresAt: future }`, `coupons: ["NEG"]`. **A:** `d = floor((100_000 × −10 + 50)/100)` = −10_000; `couponDiscountKopecks` = −10_000; `totalKopecks` = `max(0, 100_000 − (−10_000)) + 4_900` = **114_900** — the customer is charged 100 грн *more* than with no coupon, and D-19's invariant plus `total >= shipping` both still hold, so no test catches it. **B:** `d` = 0, `totalKopecks` = **104_900**.
- Catalog `{ code: "HALF", kind: "fixed", value: 7.5, … }`. **A:** `d = min(7.5, 100_000)` = 7.5; `totalKopecks` = **104_892.5** — a fractional kopeck total, contradicting the spec's own header (line 7, "Money is whole kopecks everywhere in code"). **B:** `d` = 8, `totalKopecks` = **104_892**.

A third variant sits inside the same formula: D-4 states the rule as "**half away from zero**" but supplies `floor((base × percent + 50) / 100)`. These agree for non-negative operands but not once `value` is negative, and an engineer implementing the prose (`Math.sign(x) * Math.round(Math.abs(x))`) or substituting truncation (`Math.trunc`, `| 0`) for `floor` gets a third answer — e.g. `base` 1, `value` −50: formula → 0, prose → −1, trunc → 0. "Half away from zero" is only distinguishable from "half up" on negatives, so the spec chose the phrase precisely where it is untestable and left the one case it describes open.

**Severity.** Money in reading A's direction (overcharge), plus a non-integer total that breaks the document's foundational premise.

**Whose decision.** Business/spec. §2 traded away validation in exchange for a safety guarantee it does not actually provide; either the guarantee becomes a real clamp or the out-of-scope note must say the total may exceed the subtotal.

---

## 5. A coupon whose computed discount is 0 is accepted and consumes its scope — small money plus a wrong receipt

**Where.** Step 5.5.6 (line 85) rejects `no-eligible-items` when **`base`** is 0; step 5.7 can still produce `d = 0` from a non-zero base by rounding; step 5.8 (line 87) then accepts it and "mark[s] the scope used". D-15 (line 62) justifies its rejection with "An 'applied' discount of 0 грн reads as success in the UI while nothing happened" — a rationale that argues for checking `d`, not `base`.

**The two readings.**
- **A:** Literal algorithm — check `base` only. A coupon with `d = 0` is accepted with `discountKopecks: 0` and burns its scope.
- **B:** Honour D-15's stated purpose — reject when the granted discount is 0, so the scope stays free.

**Separating input.** Order: one `standard` item, `unitPriceKopecks: 49`, `quantity: 1`, no tier, UA. Catalog: `{ code: "ONEPCT", kind: "percent", value: 1, expiresAt: future }` and `{ code: "SAVE49", kind: "fixed", value: 4_900, expiresAt: future }`, both order-wide. `coupons: ["ONEPCT", "SAVE49"]`.
- **A:** ONEPCT: `base` = 49, `d = floor((49 + 50)/100)` = 0 → accepted, `order` scope consumed. SAVE49 → rejected `duplicate-scope`. `couponDiscountKopecks` = 0, `totalKopecks` = **4_949**. Receipt shows "ONEPCT −0 грн" as a success and the real coupon as a conflict.
- **B:** ONEPCT rejected `no-eligible-items`, scope free. SAVE49: `d = min(4_900, 49)` = 49. `totalKopecks` = **4_900**.

49 kopecks here; the gap is bounded (a base under `100/value` is required for `d` to round to 0), so under 1 грн. But it is money, and the reason strings and `appliedCoupons` contents differ outright.

**Severity.** Trivial money; materially wrong receipt and rejection reason.

**Whose decision.** Engineer, guided by D-15's existing rationale — this is a one-word fix ("`base` is 0" → "the granted `d` would be 0").

---

## 6. `duplicate-code` when the first occurrence was itself rejected — reason only

**Where.** Step 5.5.1 (line 80): "seen already → reject `duplicate-code`", placed **first**, before the catalog and expiry checks. D-14 (line 61) defines it as "First occurrence applies; every later occurrence is rejected `duplicate-code`" — a description whose premise fails when the first occurrence did not apply. The spec never says what populates the "seen" set.

**The two readings.**
- **A:** "Seen" is every code string encountered, per the check's position at the top of the sequence.
- **B:** "Seen" is codes that were *accepted*, per D-14's wording and its rationale (distinguishing a double-paste from "two genuinely conflicting codes" — a code that never worked is neither).

**Separating input.** Order 100_000, no tier, UA. Catalog `{ code: "OLD", kind: "percent", value: 10, expiresAt: "2020-01-01T00:00:00Z" }`. `coupons: ["OLD", "OLD"]`, `now = 2026-09-09`.
- **A:** `rejectedCoupons` = `[{ OLD, "expired" }, { OLD, "duplicate-code" }]`.
- **B:** `rejectedCoupons` = `[{ OLD, "expired" }, { OLD, "expired" }]`.

`totalKopecks` = 104_900 in both. The same fork applies to `["NOPE", "NOPE"]` (`unknown` then `duplicate-code`, vs `unknown` twice) and to a code rejected `below-min-subtotal` twice. AC-14 does not cover it: its fixture uses a code that applies on the first pass, satisfying both readings.

**Severity.** No money. Changes a reason surfaced to the customer and to support — the exact thing D-14 exists to make legible.

**Whose decision.** Engineer, but D-14's rationale is a support-facing requirement, so worth a line from the business.

---

## 7. AC-10 does not state its customer tier — fixture only

**Where.** AC-10 (lines 122–123): "WHEN the subtotal is 49_900 and **the same coupon** requires 50_000, THEN it is rejected `below-min-subtotal`, coupon discount = 0, total = 54_800." "The same coupon" points back to AC-9, whose customer is **gold**. The tier is never stated.

**The two readings.**
- **A:** Carry AC-9's gold customer. `tierDiscountKopecks = floor((49_900 × 10 + 50)/100)` = 4_990; `totalKopecks` = 49_900 − 4_990 + 4_900 = **49_810** — the test fails against the stated 54_800.
- **B:** `customerTier: "none"`. `totalKopecks` = 49_900 + 4_900 = **54_800** ✓.

**Separating input.** Given above. The stated total does disambiguate it, so an engineer who writes A will see red and switch the fixture rather than the implementation — which is why this is low severity rather than a money bug.

**Severity.** Nothing observable ships differently; it costs a debugging cycle and, in the worst case, invites someone to "fix" the tier rounding to reach 54_800.

**Whose decision.** Engineer. AC-10 should say `customerTier: "none"` outright.

---

## Checked and found closed

I attacked these specifically and could not construct two defensible implementations:

- **Sequential vs additive stacking.** D-1 plus AC-2's explicit "**not** 79_900" leaves no room. Recomputed: tier 10_000, coupon 13_500 off the remaining 90_000, total 81_400. Correct.
- **Discount base excludes shipping.** D-2, step 6's `+ shipping` outside the `max(0, …)`, AC-1 and AC-17 all agree. No reading discounts shipping.
- **One coupon per scope, including the `order` scope.** I tried reading "at most one per scope" as covering only categories (D-3's rationale talks about two fresh codes compounding), which would let two order-wide codes stack. D-3 explicitly enumerates "Scopes: `order` (no `category`) and one per `category`", closing it.
- **Scope consumed only on acceptance.** Step 5.8 marks the scope used inside the accept branch; a coupon rejected `no-eligible-items` or `below-min-subtotal` leaves its scope free for a later code. Unambiguous (finding 5 is the one place a *zero* discount reaches that branch at all).
- **Order-wide coupons deliberately do not reduce `categoryBase`.** I expected a fork here — a later category coupon works off a base that ignores the order-wide discount already taken. Step 5.8's "if scoped" clearly attaches only to the `categoryBase` clause, and D-5a explicitly rejects allocation, so both engineers land on the same behaviour. Verified with `["SAVE50K", "FRESH50"]` on fresh 40_000 + standard 60_000: 50_000 then 20_000, total 34_900, identical either way.
- **Rounding is per discount, not per line item.** The ticket's fork was "each line or the subtotal"; step 2 computes the tier against the whole `subtotal` and step 4 against category subtotals, never per line. Closed by the algorithm, not just by D-4.
- **The half-up formula on the stated boundaries.** Recomputed AC-5 (12_345 × 10% = exactly 1_234.5 → 1_235, total 16_010) and AC-6 (12_350 × 5% = exactly 617.5 → 618, total 16_632). Both correct and unambiguous for non-negative operands.
- **`minSubtotalKopecks` for a *category*-scoped coupon.** I expected this to be open — category threshold or order threshold? Step 5.5.4 says `subtotal` (gross order), D-6 says "against the gross item subtotal", and `types.ts:40` says "the order subtotal must reach this". Three independent statements, all the same. AC-9/AC-10 pin the `>=` inclusivity at exactly 50_000.
- **The floor at zero, and whether `max(0, …)` is reachable.** Since `d = min(d, remaining)` and `remaining` decrements on each accept, the sum of accepted discounts can never exceed `subtotal − tier` for non-negative values, so the `max(0, …)` in step 6 is provably dead code rather than a divergence point. Verified with AC-4 (30_000 order, fixed 50_000 → clamped to 30_000, total 4_900) and with three 100% category coupons.
- **D-5a's per-category rounding drift.** I hunted for a case where `Σ categoryBase > remaining` lets coupons over-discount. Found one — three categories of 4 kopecks each with gold: per-category tier rounds to 0 each so `Σ categoryBase` = 12, while `remaining` = 11 — but the `min(d, remaining)` cap absorbs it. Total stays 4_900 and D-19's invariant holds (12 − 1 − 11 + 4_900). Not a fork. Worth flagging to the author that D-5a's claim the drift "can never reach the customer" is *false* in this case: the third coupon reports `discountKopecks: 3` where its category was worth 4. Both implementations agree on the wrong-looking number, so it is an inaccurate self-claim rather than an ambiguity.
- **Empty order.** AC-12 plus the note at lines 68–71 pin subtotal 0, tier 0, shipping 0 (`every()` on `[]` is vacuously true — confirmed against `pricing.ts:21`), total 0, code rejected `no-eligible-items`.
- **Exact, case-sensitive code matching.** D-10 states it and gives the rationale for stating it. §2 reinforces with "no trimming, no case folding, no aliasing." Closed.
- **Application order.** D-13 fixes it to `order.coupons` order, corroborated by `types.ts:26`. AC-15 exercises a three-code sequence where the order is load-bearing; I recomputed the whole chain (tier 10_000; fresh base 36_000; FRESH15 = 5_400; SAVE100 = 10_000 against the remaining 84_600; FRESH5 `duplicate-scope`; total 79_500) and it is correct to the kopeck.
- **D-19 read as a set vs a multiset.** AC-16's looser wording ("every **code** … appears exactly once") would fail AC-14's `["SAVE10", "SAVE10"]` fixture, since SAVE10 then appears in both arrays. D-19's precise wording ("every **entry** of `order.coupons`") forces the multiset/positional reading, and the AC-14 contradiction makes the choice unavoidable. Closed by cross-reference.
- **Fixed `value` units.** The original request says "фіксовану суму в **гривнях**" while `types.ts:33` says fixed `value` is whole kopecks. The spec never restates this explicitly, but its header note ("Every number below is kopecks unless it says грн") plus the seeded type resolve it, and AC-4's 50_000 fixed coupon is consistent with kopecks. A engineer reading грн would be contradicting `types.ts`, not exploiting a gap.
- **Both of §6's factual claims are true.** I verified `app/src/pricing.test.ts` contains exactly 8 `it()` blocks (1 + 2 + 4 + 1), matching "the original 8", and that `app/package.json` defines a `typecheck` script (`tsc -p tsconfig.json`), matching "`npm run typecheck` passes."
- **Every one of the 17 acceptance criteria recomputed** against the stated algorithm. All arithmetic is correct; AC-10 (finding 7) is the only one whose inputs are under-stated.
- **Reverse-check against the ticket.** All eight forks the request explicitly lists (`materials/feature-request.md:40–52`) are answered by D-1 through D-8, and all six numbered asks map to decisions. I found no fork named in the request that the spec leaves open — the open ones are all in territory the request never reached.

## Confidence

- **Findings 1–4 and 6–7 I am confident in**; each has a concrete separating input I traced through the algorithm by hand, and none is contradicted by an acceptance criterion.
- **Finding 5** rests on how strongly an engineer weights D-15's rationale against step 5.5.6's literal wording. The literal reading (A) is clearly the stronger one, so treat B as the less likely branch — but the money and receipt differences are real, and the fix is trivially cheap.
- **Finding 2's reading B** is the one I would most want a second opinion on. Step 5.7 is explicit that `min(value, base)` is fixed-only, so a careful engineer ships A. I keep the finding at high severity because §2 *names* `value: 150` and promises the clamps handle it — the spec actively invites the wrong reading, and the money gap is large.
- **Not verified:** I did not read `docs/templates/spec-template.md`, so I cannot confirm the claim at lines 196–202 that the sketch there is `priceOrder(order, coupons)`. It has no bearing on behaviour — §5 states the signature outright, which is what an implementer follows.
- **Read beyond the four listed files:** `app/package.json` and `app/src/pricing.test.ts`, solely to check §6's two factual assertions about the existing suite. Both hold.
- **What would settle the rest:** the OpenSpec delta spec and design at `openspec/changes/add-order-discounts/` (also in commit `6cbda10`) may already close findings 1, 3 and 5 — the design doc records rejected alternatives and could name the expiry-comparison and catalog-resolution rules. I did not read them, being outside my assigned scope. If they do, the fix is to hoist those rules into `pricing-discounts.md`, since §5 presents that file as the contract an implementer works from.

---

Every file I read was inside a path containing `.claude/worktrees/` — specifically `.../.claude/worktrees/agent-a447d173a08e23825/`: `materials/feature-request.md`, `app/src/types.ts`, `app/src/pricing.ts`, `app/src/pricing.test.ts`, `app/package.json`, and the specification itself, read as a git object (`6cbda10:docs/spec/pricing-discounts.md`) from that same worktree's repository rather than from any filesystem path outside it.
