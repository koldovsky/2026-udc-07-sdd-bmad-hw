# Design

## Context

`app/src/pricing.ts` supplies line totals, subtotal, shipping, and tier rates. `app/src/types.ts` defines order and coupon inputs. The quote adds a separate module governed by the [source specification](../../../docs/spec/pricing-discounts.md).

## Goals / Non-Goals

Keep quote computation pure and exact across the source contract's safe-integer range. Use the seeded pricing helpers and domain types unchanged. Invalid input handling is outside the contract.

## Decisions

- Define the named exports `priceOrder` and `PriceBreakdown` in `app/src/discounts.ts` with the exact source signature and five amount fields.
- Obtain the original subtotal from `subtotalKopecks` and derive category bases with `lineTotalKopecks`. Compare minimums against the original whole-order subtotal and parse coupon expiry to epoch milliseconds for the exclusive cutoff.
- Visit entered codes in order and replace the current winner only when the candidate's capped, rounded discount strictly increases. This implements earliest-entry precedence and keeps code identity internal.
- For both percentage calculations, use `(BigInt(base) * BigInt(percent) + 50n) / 100n` and convert the quotient to a number. The quotient fits the safe-integer range because the rate is at most 100 and the base is safe.
- Use `tierPercent` on the order to calculate loyalty on the coupon-adjusted merchandise subtotal. Obtain shipping from `shippingKopecks` and add it after both deductions.

## Risks / Trade-offs

- A safe merchandise subtotal can produce an unsafe intermediate when multiplied by a percentage rate. Use exact integer multiplication and division in the percentage calculation.
- The public breakdown cannot distinguish equal-value winners. Cover both entry orders in AC-14 and verify the strict comparison during traceability review.

## Migration Plan

The additive module requires no data migration.
