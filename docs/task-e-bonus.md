# Task E (bonus) — Шлях 1

> Реконструкція планування ролями поверх уже зданих Task A–D. Рушій і спека не змінювались.

## Шлях 1 — кілька агентів / ролей

**Інструмент і ролі:** BMAD 6.11: Mary (Analyst) → John (PM) → Winston (Architect) → Amelia (Dev)

> У дефолтному інсталі окремого QA-агента немає. Генерація тестів — workflow-скіл через Dev (`bmad-qa-generate-e2e-tests`); повний Test Architect — окремий модуль, його не ставили. QA/CR/BD у меню Dev **не запускались**: `priceOrder` і AC-1…AC-17 уже зелені.

**Що робила кожна роль:**

| Роль | Віддала далі |
|------|----------------|
| **Mary (Analyst)** | `_bmad-output/planning-artifacts/briefs/…/brief.md` + `addendum.md` — навіщо/хто/in-out; D-1…D-28 стиснуті як locked policy; спека лишається SoT |
| **John (PM)** | `_bmad-output/planning-artifacts/prds/…/prd.md` + `addendum.md` — FR-1…FR-10, UJ-1…UJ-3, SM-1…SM-3; кожен FR цитує AC, не переписує копійки |
| **Winston (Architect)** | `_bmad-output/planning-artifacts/architecture/…/ARCHITECTURE-SPINE.md` — pipes-and-filters, AD-1…AD-12; brownfield-ратифікація `discounts.ts`, не новий стек |
| **Amelia (Dev)** | `_bmad-output/planning-artifacts/dev-handoff.md` — опис S1…S5 (контракт → рівень → один купон → silent skip → n кодів). Код не писала, `bmad-build` відхилила |

**Де передача між ролями щось зловила:**

1. **PM → Architect, справжня розвилка арифметики.** Глосарій PRD можна прочитати так, ніби category percent рахується від усього початкового кошика. Спека D-5 / AC-3: від початкової суми **категорії**, потім кап залишком. Spine **AD-9 пішов за спекою**, не за коротшим реченням PRD. Без цієї передачі Dev міг би розійтись з AC-3.
2. **Architect vs спека D-17 / AC-2.** У чернетці AD-7 поруч з `>=` стояло «equality excluded» — антонім inclusive expiry. Reconcile зі спекою це зловив; Finalize замінив на «equality included / on or after». Інакше два сторі могли б розійтись на AC-2 (код рівно в мить `expiresAt`).
3. **Adversarial review spine (до tighten).** Чотири дірки, які дві сторі могли б зібрати несумісно: leftover `Record<category>` vs скаляр `remaining` (форма з `app/src/run-b/`); clone-and-mutate робочого кошика; мутація caller `asOf`; чорновик `PriceBreakdown` по стадіях. Закриті AD-9 / AD-11 / AD-7 / AD-10.
4. **AD-12.** Production — `app/src/discounts.ts`. `app/src/run-b/` (Task D) має extra types і leftover map, заборонені спекою. Архітектор явно заборонив реекспорт з `index.ts`.
5. **PM reviewer (дрейф, не новий fork).** §0 казав «копійки лише в спеці», далі FR переказували суми AC-1/AC-5 і формулу half-up. Autofix: лишити цитати AC/D, прибрати другі алгоритми з PRD. Спека vs PRD на D/AC — **0 протиріч** після цього.
6. **Analyst → PM.** Якісні дірки брифу (trust у чеку, ручні promo-винятки, «no moat») частково зайшли у Vision / Why Now. Це тон, не відсутній FR. Крок тестів/QA нічого не ловив — його свідомо не запускали.

**Чи вартувало це накладних витрат:**

Частково, і чесно — для фічі цього розміру спека вже зробила важку роботу (D-1…D-28, AC-1…AC-17). Чотири Fast-path сесії + reconcile/review файли з’їли більше контексту, ніж дали нових рішень: рушій був заморожений, імплементацію Task C не чіпали.

Що процес **реально** додав понад markdown-спеку: (а) зловив роз’їзд PRD-глосарія з D-5; (б) зловив небезпечний gloss expiry vs AC-2; (в) зафіксував, що `run-b/` — не другий API; (г) Dev отримала порядок сторі без права писати код. Це саме ті розвилки, на яких A/B у Task D уже розходився.

Що **не** додало: окремий QA, другий прохід імплементації, нові AC. Для домашньої роботи цього обсягу вистачило б спеки + одного архітектурного чекліста «не відкривай D-форки». Ланцюжок ролей виправданий як демонстрація Path 1 і як страховка від дрейфу документів — не як причина, чому `npm test` зелений.
