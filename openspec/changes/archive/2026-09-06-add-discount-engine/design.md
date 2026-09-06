## Context

The ticket left the pricing forks open; `docs/spec/pricing-discounts.md` closed
them. See proposal.md for why the change is needed.

Constraints that shape the approach:

- `app/src/types.ts` and `app/src/pricing.ts` are a frozen contract. `Coupon`
  carries only `code`, `kind`, `value`, `expiresAt`, optional `category` and
  optional `minSubtotalKopecks`. There is no start date, no usage counter and no
  per-customer binding, and none can be added.
- Money is whole kopecks. Floating-point arithmetic on amounts is barred by the
  repository conventions.
- The target is Node 22 with TypeScript in NodeNext mode, no runtime
  dependencies.
- The engine is a domain function called from a checkout page. It must never
  bring that page down.

## Goals / Non-Goals

**Goals:**

- One arithmetic path that any two implementers would reproduce identically,
  including at the rounding boundaries.
- Deterministic output from `order` + `catalog` + `now` alone.
- Defined, non-throwing behaviour for every malformed **value** inside
  well-shaped arguments.
- A breakdown the checkout page can render line by line, with a reason code for
  every coupon that did not apply.

**Non-Goals:**

- Storing, loading, validating or administering a coupon catalog. `Coupon[]` is
  supplied by the caller.
- Customer-facing text. The engine returns reason codes; wording, hryvnia
  formatting and message order belong to the checkout delivery.
- Rate limiting and attempt counting — they need session and IP context that a
  pure function does not have.
- Changing shipping, taxes, currency or the tier percentages.
- Validating `Order` beyond what is stated in the caller-obligations section of
  the specification.

## Decisions

Each decision carries the id it has in `docs/spec/pricing-discounts.md`, which
holds the full argument. Grouped by the question they answer.

### How the two discounts combine

- **D-1 — sequential, not additive.** Tier first, from the subtotal; the coupon
  then from what remains. 10% and 15% in sequence give 23.5%, not 25%. Summing
  percentages compounds as more rules are added later.
- **D-2 — discounts come off items only.** Shipping is a cost already paid to a
  carrier, not margin. Discounting it gives away money that is not there.
- **D-5 — a category coupon's base is
  `idiv(categoryTotal * (100 - tierPercent), 100)`.** That formula is the single
  source of truth; `categoryTotal - idiv(categoryTotal * tierPercent, 100)` is a
  different number and is not used. The two diverge by one kopeck exactly when
  `categoryTotal * tierPercent` is not a multiple of 100. The chosen one rounds
  down once, in the shop's favour, consistent with D-4.
- **D-7 — the total can never go negative.** The coupon discount is clamped to
  `[0, base]` and `base` never exceeds what is left after the tier discount, so
  the items floor at 0 and shipping is added afterwards.
- **D-13 — an order with no items prices to 0**, and typed codes are still
  checked. Subtotal, both discounts and shipping are all 0, and every code the
  customer typed is still resolved and returned in `rejectedCoupons`. Zero
  shipping is not a special case: an order with no items is formally fully
  digital, so the seeded `shippingKopecks` already returns 0. Keeping the coupon
  pass alive on an empty cart is what stops the breakdown from having two
  different accounting rules. Refusing to take an empty cart to payment is the
  checkout page's obligation, not the engine's.

### Rounding

- **D-4 — each discount rounds down to a whole kopeck; the total is not
  rounded.** Division by 100 is integer division, never `x / 100`. This keeps
  the discount at or under the advertised percentage, keeps every intermediate
  value a whole kopeck, and gives the same answer on every machine. One kopeck
  in the shop's favour is easier to explain than a discount larger than the one
  advertised.

### Which coupon wins

- **D-3 — exactly one coupon applies: the largest discount.** The result does not
  depend on the order codes were typed in, and two codes on one category cannot
  compound into a nearly free product. The customer still gets their best code.
- **D-12 — ties go to the code typed earlier.** Otherwise the result would depend
  on catalog ordering, which the engine does not control.
- **D-11 — repeats collapse before pricing**, compared after normalisation. A
  second click is not an error and should not produce a message.
- **D-15 — matching ignores case and surrounding whitespace.** Customers paste
  codes out of email. `save10` and `SAVE10` are one coupon.

### Reporting

- **D-14 — return a seven-field breakdown, not a single total.** A single number
  cannot be rendered line by line and cannot be tested step by step.
- **D-8 — a rejected coupon is reported, never thrown.** A thrown exception would
  take down the whole checkout page instead of putting one message under one
  field, and it would cost `priceOrder` its purity.
- **D-10 — a code absent from the catalog is `unknown`**, distinct from
  `expired`, so the customer can tell a typo from a finished campaign.
- **D-16 — a valid coupon worth 0 is not "applied".** The reason distinguishes
  by the scope the code covers, not by its base: empty scope gives `no-effect`,
  non-empty scope gives `too-small`. Distinguishing by base would tell a Gold
  customer holding a one-kopeck `fresh` item that the coupon does not apply to
  anything in their cart, which is false.
- **D-19 — rejections are ordered by entry, and codes are echoed verbatim.**
  Entry order puts each message beside its own field; accumulating in pipeline
  order would put someone else's message under a field. The echoed string is the
  catalog's own spelling, except for `unknown`, where only the typed string
  exists.
- **D-21, D-29 — a blank or non-string entry is not a typed code.** Reporting
  "no such coupon" under an empty field makes the page look broken, and calling
  `trim()` on `null` would throw.

### Time

- **D-9 — `now` is a parameter; the engine never calls `new Date()`.** Otherwise
  expiry cannot be tested and the answer changes with the day of the run.
- **D-17 — expiry is `now >= expiresAt`; a date-only string means midnight UTC.**
  Matches the comment on the seeded type: not valid on or after this instant.
- **D-24 — only two `expiresAt` forms are accepted**, checked by regex including
  component ranges, before `Date.parse` sees the string. `Date.parse` treats a
  time without an offset as server-local time, and for strings outside the
  ECMA-262 format its behaviour is implementation-defined. The regex removes both
  dependencies.
- **D-20 — the calendar day is verified explicitly**, by rebuilding the date with
  `setUTCFullYear` and checking it round-trips. `Date.parse("2026-02-30")` does
  not return `NaN` in V8 — it silently rolls forward to 2 March, so a one-character
  typo would extend a campaign by two days at the shop's expense, and a `NaN`
  check would never catch it. `Date.UTC` cannot be used here: it maps years 0–99
  onto 1900 + year.
- **D-25 — an `Invalid Date` in `now` rejects every coupon as `expired`.**
  `now >= expiresAt` is always `false` against `Invalid Date`, so the naive path
  would honour every coupon ever issued, including long-expired ones.

### Malformed catalog values

The catalog is not validated as a whole (**D-18**) — that belongs to the system
that fills it, and duplicating it here would create a second source of truth. The
first entry matching a normalised code is used. Over-large percentages and fixed
amounts are already contained by the `min(…, base)` clamp. Values whose
consequence is *not* contained get their own decision:

- **D-23 — zero or negative `value` gives a discount of 0.** `min(-5000, base)`
  is `-5000`: without a floor, a sign typo turns a discount into a surcharge and
  the customer watches the total rise after typing a coupon.
- **D-27 — a `value` that is not a finite integer gives a discount of 0.** `NaN`
  passes a `value <= 0` test, survives `min`, and reaches the total, so the
  customer sees `NaN` instead of a price; a fractional fixed value breaks the
  whole-kopecks rule. `Number.isInteger` closes `NaN`, `±Infinity` and fractions
  in one predicate.
- **D-28 — an unrecognised `kind` gives a discount of 0.** Left implicit, the
  code's shape would decide it: an `else` chain would silently treat it as fixed,
  a `switch` with `default: throw` would take the page down.
- **D-30 — an unreadable `minSubtotalKopecks` makes the threshold
  unreachable**, and the rejection omits the property. `subtotal < NaN` is
  `false`, so a corrupted threshold would *open* the coupon to every order — the
  exact opposite of the campaign's intent. The property is omitted rather than
  echoed because "valid from NaN грн" is worse than showing no threshold.
- **D-31 — an item category outside the union counts towards the subtotal and no
  category total.** The consequence is bounded: an unknown category can only
  shrink a discount, never grow one.
- **D-32 — a coupon's category counts as set if and only if it is not
  `undefined`.** This is the most expensive fork in the document. `if
  (coupon.category)` would put `null` in the *no-category* branch, giving
  `base = remainder` — a discount on the entire order instead of none at all. On
  a 100 000 order that is 10 000 kopecks, and no criterion written before this
  decision would have caught it.

### Threshold semantics

- **D-6 — `minSubtotalKopecks` is compared with the original subtotal**, before
  any discount and regardless of the coupon's category. If it were checked after
  the tier discount, the same cart would work for a customer with no tier and
  fail for a Gold customer — the loyalty tier would be taking the coupon away.
- **D-22 — a fixed `value` is in kopecks, not hryvnia.** The ticket said hryvnia;
  the frozen type comment says whole kopecks and wins. Reading it as hryvnia
  would multiply every fixed discount by 100.
- **D-26 — at most 10 typed codes, enforced by the caller.** Without a bound the
  work is quadratic on every cart change, and because `unknown` and `expired` are
  deliberately distinguished, the response confirms whether a code exists —
  which needs rate limiting at a layer that can see the session.

### Direction of every safety decision

Where a malformed value could be read two ways, the engine withholds the
discount rather than granting it (D-20, D-23, D-24, D-25, D-27, D-28, D-30,
D-32). A coupon wrongly withheld is fixed by editing the catalog; a discount
wrongly given away is not recoverable.

## Risks / Trade-offs

- **The engine deliberately does not validate the catalog (D-18).** A bad entry
  is priced consistently but silently, and no one is told. → Mitigated only
  partly, by the targeted checks above; the ownership gap is open question O-3.
- **`unknown` versus `expired` confirms that a code exists**, which makes coupon
  codes enumerable. → Mitigated by rate limiting at the checkout layer, which is
  not in this delivery and whose threshold is O-1.
- **A date-only `expiresAt` ends a campaign at 03:00 Kyiv time, not midnight.**
  → The full form with an explicit offset is already accepted; needs
  confirmation from the campaign owner (O-2).
- **Rounding down takes up to one kopeck per discount from the customer.** →
  Accepted deliberately, and pinned by AC-13 and AC-18 so it can never drift
  unnoticed.
- **The input bounds (200 items, 10 codes, 1 000 catalog entries, subtotal
  ≤ 100 000 000 000) are caller obligations, not runtime checks.** Exceeding the
  subtotal bound breaks integer exactness; exceeding the length bounds only makes
  the call slower. → The two kinds are separated explicitly in the specification
  so they are not confused.
- **Linear catalog lookup per code.** At the stated bounds this is at most 10 000
  string comparisons per call, and the price is recomputed on every cart change.
  → Acceptable within the bound; past 1 000 entries it becomes an index, which is
  an implementation change and not a specification change.
- **This delta duplicates a specification that already exists in Ukrainian.**
  Two documents can drift. → `docs/spec/pricing-discounts.md` stays the single
  normative source for the rationale, and the scenario ids here are its criterion
  ids, so drift is detectable by id.

## Migration Plan

None required. `priceOrder` is additive: no existing export changes, no data is
migrated, and rollback is deleting the new module and its re-exports.

## Open Questions

All three are business decisions, none blocks this change, and none changes a
requirement in the delta spec.

- **O-1** — the rate-limit threshold, window and key for failed coupon attempts,
  and what happens when it trips. Owner: security owner plus the checkout team.
  Until answered, the checkout delivery is incomplete; `priceOrder` is unaffected.
- **O-2** — does the campaign owner accept that `expiresAt: "2026-09-01"` means
  midnight **UTC**, i.e. 03:00 in Kyiv? Owner: Head of Growth. If not, the catalog
  must emit the offset form, which is already accepted — no code change either
  way.
- **O-3** — who owns the coupon catalog: who creates entries, what validates them
  on the way in, who can end a campaign early, and where changes are audited.
  Owner: Head of Growth plus the checkout team. Three decisions here rely on
  "the catalog will be corrected", and no system is named that does the
  correcting.
