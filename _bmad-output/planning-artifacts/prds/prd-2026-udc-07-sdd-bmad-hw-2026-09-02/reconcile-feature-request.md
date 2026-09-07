# Input reconciliation — `materials/feature-request.md`

- **Input:** Head of Growth ticket — «Знижки до осінньої кампанії»
- **Source (read-only):** `materials/feature-request.md`
- **Compared to:** `prd.md`, `addendum.md` (same run folder)
- **Date:** 2026-09-02
- **Workshop notes in the ticket** (`## Що з цим не так` and the kopiyky coding hint) are **not** Growth asks. They name forks the spec already closed. This extract treats them as commentary, not product requirements.

---

## 1. What the ticket asked for (numbered asks)

From: Head of Growth → checkout team. Subject: discounts for the autumn campaign.

Growth wants to «нарешті нормально запустити знижки»: loyalty exists (`tierPercent`) and is unused; there is no promo path.

1. **Loyalty tiers must work.** Silver 5%, Gold 10%. Already in code as `tierPercent` — «просто підключіть».
2. **Promo codes.** Percent **or** a fixed amount **in hryvnia**. Some codes only on a product category; some require a minimum order amount.
3. **Promo + tier together.** The promo must work together with the tier discount — «клієнт має відчувати вигоду від обох».
4. **Expired promos must not fire.**
5. **The customer may enter several promo codes.**
6. **Count it carefully so kopiyky do not «пливли».**

Closing line: «Запускаємось за два тижні, дякую!»

---

## 2. Qualitative tone / urgency

- **Voice:** Informal business Ukrainian, not engineer-speak. Greeting, «нарешті», «дякую». Frustration that loyalty is a dead field.
- **Sponsor feel:** Growth, campaign-timed, checkout-owned. Implied shopper is at checkout typing codes, not a library caller.
- **Urgency:** Autumn campaign; launch in two weeks. The ticket is a go-live ask, not a platform brief.
- **Shopper feel (the load-bearing qualitative idea):** «відчувати вигоду від обох» — the customer should *feel* that both loyalty and the promo did something. Success is experiential, not only arithmetically combined.
- **Money feel:** «копійки не пливли» — receipts must not look sloppy; amounts must not drift. The workshop footnote later maps this to integer kopiyky vs float, but Growth’s phrase is a quality bar, not a rounding algorithm.

---

## 3. Coverage map (ask → PRD / addendum)

| Ask | Where it landed | Verdict |
|-----|-----------------|--------|
| 1. Wire Silver/Gold via `tierPercent` | Vision; FR-1; FR-10 reuse; addendum D-1 | **Covered.** Rates 5%/10%, goods-only, `none` → 0. |
| 2. Promos: percent or fixed грн; category; min sum | FR-2…FR-5; D-5, D-6/D-19, D-20, D-21 | **Covered as capability.** Fixed unit is locked as **kopiyky** (D-21: 100 грн = 10_000), not a literal `value` in hryvnia — translation of the same ask. |
| 3. Together + «відчувати вигоду від обох» | Vision («feel both»); shopper JTBD; UJ-1 (both lines non-zero); FR-8 split fields; addendum «together» ≠ how, sequential locked | **Capability covered; feel compressed.** See Gap 1. |
| 4. Expired must not apply | FR-6, FR-7; D-8/D-12/D-18/D-24; AC-2 | **Covered.** Silent skip, never throw (ticket did not say throw vs quiet). |
| 5. Several codes | FR-2; D-3, D-9, D-10, D-14, D-27 | **Covered** as all eligible in typed order, no cap, first duplicate only. Ticket did not say all vs best-of; PRD closed that fork. |
| 6. «Копійки не пливли» | §9 Money NFR; FR-8/FR-9; D-4 half-up; addendum mechanism | **Mechanics covered; idiom not in FRs.** See Gap 2. |
| Autumn campaign / two weeks / «нарешті» | Vision; §8 Why Now | **Motivation covered; not an FR or success metric.** See Gap 3. |
| Checkout team / implied checkout surface | Non-users; §5 Non-Goals (no UI) | **Conscious scope cut**, not a silent omit. |

Workshop forks named under «Що з цим не так» (additive vs sequential, goods vs goods+shipping, several codes how, rounding where, category base, min before/after other discounts, negative total, expired throw vs quiet) are **closed** in `prd.md` FRs + addendum locked policy. They are not missing ticket asks.

---

## 4. Ideas the FR structure might have dropped

Checked explicitly: feel, campaign framing, «копійки не пливли», «відчувати вигоду від обох».

### Feel / «відчувати вигоду від обох»

Present in **Vision**, shopper JTBD («Loyalty was not a dead badge; the promo they typed did something»), and **UJ-1** (non-zero tier **and** coupon lines).

**FRs do not say «feel».** FR-8 requires two integer fields (`tierDiscountKopecks`, `couponDiscountKopecks`) and sequential stacking. That is the caller-visible split, not a shopper-visible receipt. There is no UI, so there is no FR that the person at checkout *perceives* two benefits.

Addendum: ticket said «together», not how; sequential-tier-first is locked (AC-5). Sequential on 1 000 грн + 15% is **less** combined cut than additive 25%. If Growth heard «відчувати вигоду від обох» as *generous double benefit*, the FR structure chose the smaller, “loyalty always on, coupon on the rest” reading.

### Campaign framing

**Not dropped from the document** — §1 and §8: autumn campaign, two weeks, unused `tierPercent`. **Dropped from the FR list**, which is structurally correct. Success metrics are spec ACs (SM-1…SM-3), with an explicit assumption that campaign KPIs are out. The ticket’s go-live clock is motivation only.

### «Копійки не пливли»

**Not dropped as a money rule** — integer kopiyky, no float amounts, half-up only at percent steps, no second rounding on total (D-4, §9, §10).

**Dropped as Growth’s idiom / receipt-cleanliness feel.** No FR about displaying hryvnia without 0,01 drift. Fine for a domain library; the phrase itself never appears in FRs.

---

## 5. Gaps

Functional asks 1–6 are all represented. Gaps below are **qualitative / framing** the FR spine can silently lose — not missing capabilities.

### Gap 1 — Shopper «feel both» is Vision-only (severity: **low**)

«Клієнт має відчувати вигоду від обох» is the ticket’s success *feel*. FRs only guarantee split integers and sequential math. Architecture could treat FR-8 as a breakdown convenience rather than the product meaning of ask 3. Sequential stacking also under-delivers vs an additive reading of «both benefits». Addendum already records the fork; polish should not strip Vision/UJ-1 language that carries the feel.

### Gap 2 — «Копійки не пливли» idiom not in FRs (severity: **low**)

The quality bar is fully specified as integer + half-up NFRs. The FR list never restates «don’t let kopiyky drift» in sponsor language. Risk is only if NFRs are ignored and someone reintroduces float `Math.round`. Not a missing requirement.

### Gap 3 — Campaign / two-week «нарешті» not in FRs or success metrics (severity: **low**)

Urgency and «finally launch discounts for autumn» live in Why Now. SM-1…SM-3 measure AC tests, not campaign readiness. Matches `[ASSUMPTION: success is spec acceptance…]`. Architect should not invent campaign KPIs; also should not forget the increment is *for* that campaign.

---

## 6. Gap list (compact)

1. **Low** — «Відчувати вигоду від обох» / shopper feel compressed to split PriceBreakdown fields + sequential stacking; not an FR.
2. **Low** — «Копійки не пливли» present as integer/half-up NFRs, not as FR-level sponsor language.
3. **Low** — Autumn campaign and two-week urgency in Why Now only; no campaign-readiness success metric.

No medium or high gaps. No numbered Growth ask is absent from PRD + addendum.
