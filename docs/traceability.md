# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md` (рішення D-1…D-23, критерії AC-1…AC-23)
**Delta-спека (OpenSpec):** `openspec/changes/add-pricing-discount-engine/specs/pricing/discounts/spec.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts`
**Стан:** `cd app && npm test` → **31 passed (31)**, з них 8 наявних у `pricing.test.ts`

Перевірити звʼязок можна прямо з виводу — назва кожного тесту починається з ID критерію:

```bash
cd app && npm test -- --reporter=verbose | grep -oE 'AC-[0-9]+' | sort -uV
# → AC-1 … AC-23, кожен рівно один раз
```

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Gold 10% від 100 000 → total 94 900 | `discounts.ts:priceOrder` — крок 1, `tierDiscount` (L130) | `AC-1: gold order of 100 000 with no coupons → tier 10 000, total 94 900` | ✅ |
| AC-2 | Silver 5% / none 0%, поле `tierPercent` | `discounts.ts:priceOrder` — `tierPercent(order)` (L120, L130) | `AC-2: silver → tier 5 000, total 99 900; none → tier 0, total 104 900` | ✅ |
| AC-3 | Послідовне складання: 15% від залишку = 13 500, не 15 000 | `discounts.ts:priceOrder` — акумулятор `remaining` (L127, L198–200) | `AC-3: gold + 15% coupon compose sequentially → coupon 13 500, not 15 000` | ✅ |
| AC-4 | Доставка поза базою знижки (PL 19 900) | `discounts.ts:priceOrder` — `shipping` рахується в кінці (L209, L217) | `AC-4: international shipping is outside the base → tier 10 000, total 109 900` | ✅ |
| AC-5 | Категорійний промокод від частки залишку → 7 200 | `discounts.ts:categorySubtotalKopecks` (L78) + `base` (L182–187) | `AC-5: 20% fresh coupon uses the category share of the remainder → 7 200` | ✅ |
| AC-6 | Другий промокод на ту саму категорію → `duplicate_scope` | `discounts.ts:scopeOf` (L74) + `usedScopes` (L174–177, L200) | `AC-6: two coupons on the same category → the second is duplicate_scope` | ✅ |
| AC-7 | Різні скоупи стекуються в порядку введення | `discounts.ts:priceOrder` — цикл `for (const code of order.coupons)` (L143) | `AC-7: different scopes stack in entry order → 7 200 then 8 280` | ✅ |
| AC-8 | Поріг проти **вихідного** subtotal → застосовується | `discounts.ts:priceOrder` — `subtotal < coupon.minSubtotalKopecks` (L168) | `AC-8: measured against the pre-discount subtotal → applies despite remainder 90 000` | ✅ |
| AC-9 | 94 999 → `below_min_subtotal`; 95 000 → застосовується | `discounts.ts:priceOrder` — той самий рядок L168 (нестроге `<`) | `AC-9: 94 999 is below the threshold, 95 000 is not (inclusive)` | ✅ |
| AC-10 | Недійсний **у** момент `expiresAt`, дійсний за секунду до | `discounts.ts:priceOrder` — `nowMs >= Date.parse(...)` (L162) | `AC-10: invalid at the expiresAt instant, valid one second before, never throws` | ✅ |
| AC-11 | **Гранична.** Знижка > суми → обрізання, total = доставка | `discounts.ts:priceOrder` — `Math.min(raw, base, remaining)` (L198) | `AC-11: fixed coupon larger than the order caps at the remainder, total = shipping` | ✅ |
| AC-12 | **Гранична.** Порожнє замовлення → усе 0, без винятку | `discounts.ts:priceOrder` — `base === 0` (L189) + `subtotal === 0` (L185) | `AC-12: empty order prices to zero and rejects the coupon without throwing` | ✅ |
| AC-13 | **Гранична.** 202.5 → 203 (half-up) | `discounts.ts:roundKopecks` (L60) | `AC-13: half a kopeck rounds up — 5% of 4 050 is 203, not 202` | ✅ |
| AC-14 | **Гранична.** Округлення бази категорії → 4 751 / 475 | `discounts.ts:priceOrder` — `roundKopecks` у `base` (L187) і в `raw` (L194) | `AC-14: the category base itself rounds half-up → base 4 751, coupon 475` | ✅ |
| AC-15 | Невідомий код → `unknown` | `discounts.ts:priceOrder` — `catalog.find(...) === undefined` (L145–149) | `AC-15: an unknown code is rejected as unknown and pricing still completes` | ✅ |
| AC-16 | Дубль коду → знижка раз, повтор `duplicate_code` | `discounts.ts:priceOrder` — `seenCodes` (L151–155) | `AC-16: the same code twice discounts once, the repeat is duplicate_code` | ✅ |
| AC-17 | Категорії немає в кошику → `no_matching_items`, не «applied 0» | `discounts.ts:priceOrder` — `base === 0` (L189–192) | `AC-17: a coupon for a category absent from the cart is no_matching_items` | ✅ |
| AC-18 | 150% і −100 → `invalid_value`, без кліпування | `discounts.ts:isInvalid` (L93, рядки percent/fixed) | `AC-18: malformed values are invalid_value and are never clamped into range` | ✅ |
| AC-19 | Digital-only → доставка 0, знижки працюють | `discounts.ts:priceOrder` — `shippingKopecks(order)` на вихідному ордері (L209) | `AC-19: a digital-only order keeps zero shipping while discounts still apply` | ✅ |
| AC-20 | Інваріант балансу й цілочисельності | `discounts.ts:priceOrder` — форма повернення (L211–221) | `AC-20: …worst-case mix` + хелпер `expectBalanced()`, що виконується **в кожному** тесті через `price()` | ✅ |
| AC-21 | **Гранична.** Зіпсована дата → `invalid_value`, не `expired` | `discounts.ts:isInvalid` — `Number.isNaN(Date.parse(...))` (L104) | `AC-21: an unparseable expiresAt is invalid_value, not expired` | ✅ |
| AC-22 | Дубль у каталозі → виграє перший | `discounts.ts:priceOrder` — `catalog.find(...)` (L145) | `AC-22: on duplicate catalogue entries the first one wins` | ✅ |
| AC-23 | **Гранична.** `NaN`/дробовий `fixed` → `invalid_value`; дробовий `percent` — ок | `discounts.ts:isInvalid` — `Number.isFinite` / `Number.isInteger` (L94, L97) | `AC-23: non-integral fixed values are invalid_value; a fractional percent is fine` | ✅ |

Порожніх клітинок немає. Кожен `D-1…D-23` має щонайменше один AC:
D-1→AC-3/7, D-2→AC-4, D-3→AC-6, D-4→AC-13/14/20, D-5→AC-5/14, D-6→AC-8/9, D-7→AC-11,
D-8→AC-10, D-9→AC-10, D-10→AC-15, D-11→AC-16, D-12→AC-17, D-13→AC-18, D-14→AC-12,
D-15→AC-2, D-16→AC-19, D-17→AC-20, D-18→AC-7, D-19→AC-5, D-20→AC-11 (межа знизу),
D-21→AC-21, D-22→AC-22, D-23→AC-23.

## Зворотна перевірка

### Чи є в коді поведінка, якої немає в жодному AC?

Знайдено **три** місця. Два виправлено, одне свідомо залишено з обґрунтув��нням.

1. **`!Number.isFinite(coupon.value)` і `!Number.isInteger` для `fixed`** — спочатку я
   написав ці гардії «про всяк випадок», і жоден AC їх не вимагав. Це класична
   неспецифікована ініціатива. Але прибрати їх було не можна: `NaN` проходить будь-яке
   порівняння діапазону з D-13, а дробовий `fixed` віднімається як є — обидва протікають
   у результат і **ламають інваріант AC-20**. Тобто це не зайвий код, а **дірка в
   специфікації**. → Дописано **D-23 + AC-23** і тест; тепер поведінка специфікована.

2. **Поле `tierPercent` у `PriceBreakdown`** — було в контракті §5, але жоден AC його не
   перевіряв, тобто його можна було б повернути будь-яким і всі тести лишились би
   зе��еними. → Додано перевірки `tierPercent` у тест **AC-2**.

3. **`Math.min(remaining, …)` на знижці за рівнем** (L130) — **недосяжна гілка**: стеля
   рівня 10%, тож знижка ніколи не перевищить залишок. Залишено свідомо: D-7 формулює
   обрізання над **усіма** знижками, а не лише над промокодами. Код має відображати
   правило, а не покладатись на те, що `tierPercent` ніколи не стане 100. Зафіксовано
   коментарем у коді; покриття цієї гілки тестом неможливе без зміни `pricing.ts`, яку
   спека забороняє.

### Чи є AC без тесту?

Немає. Усі `AC-1…AC-23` присутні у виводі `npm test --reporter=verbose` рівно один раз
(перевірено grep-ом, команда вгорі). Крім того, AC-20 не просто має власний тест, а
виконується як інваріант у **кожному** з 23 викликів через хелпер `price()`.

### Чи є тест, який не мапиться на жоден AC?

У `discounts.test.ts` — немає, усі 23 названі за ID. Є два допоміжні артефакти без ID:
`expectBalanced()` і `price()` — це не тести, а механіка перевірки AC-20; вони не
зʼявляються у виводі як окремі кейси.

8 тестів у `pricing.test.ts` не мапляться на AC — і не мають: вони покривають **уже
специфіковану** поведінку (`subtotalKopecks`, `shippingKopecks`, `tierPercent`), яка була
в репо до цієї фічі. Їх не чіпали; `git diff --stat app/src/pricing.ts app/src/types.ts`
порожній.

## Що з цього вийшло

Специфікацію довелося правити **тричі** після того, як почалась робота з кодом, і саме це
— найкорисніший результат, а не таблиця вище.

**Перша правка** прилетіла ще в Task B: етап `design` в OpenSpec витягнув, що
`Date.parse("not-a-date")` дає `NaN`, а порівняння з `NaN` завжди хибне — тобто промокод
із зіпсованою датою тихо читався б як «акція скінчилась» (→ D-21, D-22).

**Друга** — найганебніша й найпоказовіша: **перший же прогін тестів завалив AC-1**. Не
через баг у коді, а тому що я в специфікації написав `total = 95 100`, хоча
100 000 − 10 000 + 4 900 = **94 900**. Арифметична помилка в документі, який я двічі
вичитував; `openspec validate --strict` сказав «valid», бо структура була бездоганна.
Спіймав її `npm test` за 300 мс. Висновок неприємний, але чіткий: **специфікація з
числами — це код, який ніхто не запускає**, доки не зʼявиться тест.

**Третя** — власне зворотна перевірка: гардії на `NaN`/дробовий `fixed` виявились
неспецифікованою поведінкою, яка при цьому була **необхідною**, щоб не порушити вже
записаний AC-20. Тобто спека суперечила сама собі, і побачити це можна було тільки
пройшовши від коду назад до документа.

Разом: 3 розбіжності, з них 2 знайдено інструментами процесу (design-етап, зворотна
перевірка) і 1 — тестами. Жодну не знайшло перечитування специфікації.

