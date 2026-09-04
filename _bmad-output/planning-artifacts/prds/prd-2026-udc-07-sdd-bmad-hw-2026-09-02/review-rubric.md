# PRD Quality Review — Checkout discounts (loyalty + coupons)

## Overall verdict
This PRD does the job of an internal Task E reconstruction: Winston can consume capabilities, glossary, non-goals, and success checks without reopening stacking, silent-skip, or goods-vs-shipping forks. Trade-offs are named with money, FRs carry testable consequences that cite spec AC/D ids, and the shape is a domain-library capability spec rather than a fake consumer product. The residual risk is a second arithmetic surface — glossary rounding, expiry parsing, and restated AC kopiyky — sitting next to a Document Purpose that promised those would live only in `docs/spec/pricing-discounts.md`. Architect is safe if they obey “the spec wins”; they are not safe if they implement from §3 or FR worked examples.

## Decision-readiness — strong
A decision-maker can act. §8 *Why Now* states the stacking fork as a decision with a cost, not a “consideration”: “Unwritten stacking (additive vs sequential) is ~15 грн on a 1 000 грн Order — at campaign volume that is money.” §1 and §5 refuse the nearby product: “We are not a promo platform, a personalization engine, or a checkout UI.” Someone pushing for additive percents, a throw-on-invalid path, a best-of permutation, or shipping-in-base finds the objection already spent — in FR-8 / SM-C1, FR-7 / SM-C2, and the addendum *Rejected alternatives* / *Options considered* notes.

Open Questions are actually empty rather than rhetorical: “None that block architecture. Catalog-garbage behaviour (spec D-22) stays unspecified by design.” That matches the locked-spec reconstruction. There are no `[NOTE FOR PM]` callouts; the real tensions (engine already shipped, no campaign KPIs, increment-only vision) are closed as `[ASSUMPTION]` instead of deferred. For this stakes level that is the right move, not a dodge.

### Findings
- **low** Leftover title checkpoint (§ working title) — “*Working title — confirm.*” is an unresolved prompt sitting above Vision, and it is not listed in §13 Open Questions. It does not block architecture. *Fix:* Confirm or drop the line; if it stays open, put it in §13.

## Substance over theater — strong
Almost nothing is furniture. Vision cannot be swapped into another pricing PRD: “Today `tierPercent` exists and is unused; there is no Coupon path.” Target User names a caller, a sponsor, and a beneficiary, then §2.2 *Non-Users* cuts shoppers-on-screens, catalog CRUD, analysts, and throw-expecting engineers. UJs are three library calls, explicitly downscaled. NFRs in §9 are thresholds (same inputs → same breakdown; always return; seeded contract unchanged), not “must be scalable / secure / reliable.” Success Metrics are operational and have counter-metrics (SM-C1 total discount vs sequential stacking; SM-C2 exception rate vs silent skip).

The addendum D-1…D-28 table is a locked-policy extract with a correct header (“treat `docs/spec/pricing-discounts.md` as source of truth”). It is earned for Architect so forks are not rediscovered, provided it stays an index of ids rather than a second algorithm.

## Strategic coherence — strong
The thesis is consistent from §1 through MVP: loyalty is a dead field, typed codes do not exist, both benefits must appear as distinct non-zero lines for an autumn increment, and the spec already closed the arithmetic forks so architecture does not rediscover them. Feature groups follow that arc (tier first → typed coupons → silent skip → receipt identities → one public function), not “what is easy.” MVP kind is problem-solving (make the unused contract compute), and §6.2 names the next honest step (UI + persistence) without smuggling it in.

SM-1…SM-3 validate the thesis (AC pass, identities, seeded tests stay green) rather than measuring activity the module cannot observe. The `[ASSUMPTION: success is spec acceptance and invariants, not campaign KPIs.]` in §7 is the coherence move, not a cop-out: §2.2 already said analysts are non-users.

## Done-ness clarity — strong
Downstream story creation can extract a testable consequence per FR. FR-1 quotes Gold/Silver/PL/half-up carts and pins them to AC-1, AC-17, AC-10, AC-9. FR-8 gives the AC-5 anti-example (“not 25% off goods”) plus the remaining-goods / total identities. FR-9 gives the AC-4 floor and AC-8 empty cart. Language stays away from “gracefully / reasonable / user-friendly”; rejection is the defined term **silent skip**. FR-10 correctly defers the TypeScript surface to spec §5 and the addendum instead of inventing a second signature.

FR-7 is the thinnest: consequences are “AC-2, AC-8, AC-13 do not throw” plus “PriceBreakdown has no per-code reason list.” That is still verifiable because those AC ids exist in the spec. NFRs state bounds (determinism, integer kopiyky, always return), not adjectives.

## Scope honesty — adequate
Omissions are mostly explicit. §5 Non-Goals names UI, CRUD, usage caps, shipping discounts, throws, per-code arrays, dirty LineItems, campaign KPIs, and — critically — “this PRD does not authorize re-implementation; the engine in `app/src` is already shipped and frozen for Task E.” §6.2 points at the next increment without pretending it is in MVP. `[ASSUMPTION]` tags exist inline and are mostly indexed. Open-items density is appropriate for internal reconstruction: parked D-22, no phase-blocker questions.

Honesty slips where Document Purpose over-claims what this file contains. §0 says “Numeric behaviour, rounding, and every worked example live in `docs/spec/pricing-discounts.md`” and “If this PRD and the spec disagree, **the spec wins**.” Then §3, FR-6, and FR consequences restate rounding, expiry parsing, and AC kopiyky anyway. The reader is told there is one arithmetic owner and then handed two. There are also no `[NON-GOAL for MVP]` or `[NOTE FOR PM]` tags; the sections do the work, so this is a tagging gap, not a silent de-scope.

### Findings
- **medium** Spec-wins claim vs restated arithmetic (§0 vs §3, FR-1…FR-9, FR-6) — §0 promises that “every worked example” lives in the spec, but FR-1 restates “tier discount 10_000, shipping 4_900, total 94_900 (spec AC-1),” FR-8 restates the AC-5 triple (10_000 / 13_500 / 81_400), and FR-6 encodes D-17 in the FR itself: “ISO; date-only = that day 00:00:00.000 UTC; invalid on or after.” Those currently match the spec; the usefulness hit is drift later, not a present numeric error. *Fix:* Keep AC/D citations as the testable consequence; delete restated kopiyky, the half-up procedure, and the expiry-parse rule from the PRD. Point at spec §3 / D-17 / the named AC.

- **low** Assumption roundtrip incomplete (§0, §14) — §0 says assumptions are “indexed in §9”; the index is §14. Index rows “Stakes — Internal reconstruction…” and “Working mode — Fast path…” have no matching inline `[ASSUMPTION]` tags. *Fix:* Point §0 at §14; either add inline tags for those two rows or drop them from the index as run-meta.

## Downstream usability — adequate
This PRD is chain-top for architecture (and later a Dev handoff that must not rebuild). It is extractable: glossary is present, FR-1…FR-10 / UJ-1…UJ-3 / SM-1…SM-3 / SM-C1…SM-C2 are contiguous and unique, and UJ→FR “Realized by” links resolve. Exact `priceOrder` / `PriceBreakdown` identifiers live in the addendum, which is the right split. UJs have no named human protagonist (“Caller prices…”); that is the documented `[ASSUMPTION: no named UX protagonists or screen flows.]` and matches a single-operator library — do not retrofit Mary-on-checkout.

The glossary, however, claims “Downstream must use these terms exactly” and then defines **half-up** as “remainder ≥ 50 kopiyky of the unused hundred rounds away from zero to the next kopiyka.” Spec §3 is an integer `product % 100` procedure, not “away from zero.” For non-negative amounts they coincide; the phrase is still a second rounding spec. Combined with prose field names in the glossary (`goods subtotal`, `tier discount`) versus TypeScript names only in the addendum, an Architect who source-extracts the PRD alone can invent either rounding or field identifiers. Spec-wins in §0 mitigates this only if they actually open the spec.

### Findings
- **medium** Glossary re-specifies rounding (§3 *half-up*) — The term is defined as a procedure (“remainder ≥ 50 kopiyky of the unused hundred rounds away from zero”) rather than “the percent→kopiyky step in spec §3 (D-4).” Downstream is told to use this wording exactly. *Fix:* Define **half-up** as “spec §3 / D-4; do not restate the formula here.” Same treatment for **sequential stacking** if the one-liner starts to grow steps.

- **low** PriceBreakdown identifiers not in the PRD glossary (§3 *PriceBreakdown*, addendum Mechanism) — Glossary lists English row names; FR-10 says “field names match spec §5.” The six TypeScript fields (`tierDiscountKopecks`, …) appear only in the addendum. *Fix:* One glossary line with the six identifiers, or an explicit “identifiers: addendum / spec §5.”

## Shape fit — strong
The product is a brownfield domain function with one operator role, not a consumer checkout. The PRD chose the capability-spec shape: downscaled UJs, operational success metrics, brownfield reuse of `tierPercent` / `subtotalKopecks` / `shippingKopecks` / frozen `types.ts`, and an explicit “no UX spec exists.” That matches the rubric’s internal-tool / single-operator guidance. It is not over-formalized with screen protagonists, and not under-formalized: FRs, non-goals, NFRs, and counter-metrics are all load-bearing. Horizon is correctly increment-sized (“this campaign increment”) for Task E reconstruction rather than a launch PRD.

## Mechanical notes
- §0 cross-ref “indexed in §9” does not resolve; Assumptions Index is §14.
- Assumptions Index roundtrip: 7 inline `[ASSUMPTION]` tags; 9 index rows. Extra rows (Stakes, Working mode) are run-meta, not product assumptions.
- No `[NOTE FOR PM]` or `[NON-GOAL for MVP]` tags. Non-goals are still explicit in §5 / §6.2.
- FR / UJ / SM ids are contiguous and unique; AC/D citations that were spot-checked (AC-1, AC-4, AC-5, AC-9, AC-17, spec §5) resolve.
- UJ protagonists are role labels (`Caller`), not named people — consistent with the downscale assumption.
- Glossary bilingual drift vs the Ukrainian spec (`kopiyky` / Coupon vs промокод) is expected; within the PRD, **typed codes**, **catalog**, **asOf**, **remaining goods**, and **silent skip** are used consistently.
- Addendum D-table paraphrases D-1…D-28; keep it as an id index so it cannot drift from spec §3’s normative algorithm.
