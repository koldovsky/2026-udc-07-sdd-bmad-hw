## Context

The `add-discount-engine` change carried 32 decisions and 60 acceptance criteria
from `docs/spec/pricing-discounts.md` into this capability, and was archived once
`npm test` was green. It left one fork open, and the document contradicted itself
about it rather than leaving it silent — which is why neither `openspec validate
--strict` nor the reverse traceability check of Task C found it. Both look for
absence; this was a disagreement between two present statements.

The fork: a catalog entry whose `code` is not a string. Section 3 of the
specification declared the behaviour undefined (the exception list is closed and
`code` was not in it). Section 7 and the `priceOrder` JSDoc declared that no bad
value inside a correct shape ever throws. Step 5 requires catalog codes to be
compared normalised, and normalisation is where the two readings diverge:
`entry.code.trim()` throws on `null`, `String(entry.code ?? "").trim()` does not.

It was found by the ambiguity reviewer built for Task E, run against the
specification with no access to the implementation.

## Goals / Non-Goals

**Goals**

- Make the three statements agree, in the direction section 7 already promised.
- Pin the behaviour with a criterion, so a future implementation cannot drop it
  silently.

**Non-Goals**

- Validating the catalog. D-18 stands: the catalog is not checked, the first
  matching entry wins. This change specifies what an unreachable entry does, not
  a validation pass.
- Reporting the corrupt entry to the caller. It produces no rejection of its
  own — it is an entry nobody typed. The typed code that found no match is
  already reported as `unknown` by D-10.

## Decisions

### D-33 — a non-string catalog code is unreachable, not fatal

The entry's code normalises to `""` under D-15. Typed codes that are empty after
normalisation were dropped at step 4 by D-21, so the empty key can never be
looked up, and the entry matches nothing. `priceOrder` does not throw.

The alternative — leaving the behaviour undefined, as section 3 did — is what
produced the contradiction. It cannot be repaired by weakening section 7
instead, because "зіпсований запис у каталозі не обвалює сторінку оформлення
ніколи" is a promise the checkout page depends on: the page renders a price on
every keystroke, and an exception there is a blank checkout, not a missing
discount.

Direction of failure is the same one D-20, D-27, D-28, D-30 and D-32 all take: a
corrupt record costs a discount that a catalog edit can restore, never an
exception and never money handed away.

### Placement of the criterion

AC-61 covers both arrangements — corrupt entry before a valid one, and corrupt
entry alone — because they exercise different code paths: the first proves the
lookup survives a bad key while still finding the good one, the second proves the
typed code is reported rather than swallowed. A single-entry scenario alone would
pass against an implementation that skips the whole catalog on the first bad
entry.

## Risks / Trade-offs

- **The engine already behaves this way.** `normaliseCode` accepts `unknown` and
  returns `""` for a non-string, so this change adds a test that passes on the
  first run. That is the intended outcome of the section 11 procedure and not a
  reason to skip the criterion: the behaviour was unpinned, and an unpinned
  behaviour is one refactor away from disappearing.
- **A modified requirement duplicates its own scenarios.** OpenSpec requires a
  `MODIFIED` requirement to carry its full updated text, so seven unchanged
  scenarios are restated to add one. The cost is real; the benefit is that the
  archived spec stays the single description of the capability.

## Migration Plan

None. No behaviour changes, no data changes, no interface changes.

## Open Questions

None. O-1 to O-3 of the specification are unaffected.
