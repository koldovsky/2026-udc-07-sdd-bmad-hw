# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts` (`cd app && npm test` — 8 сидованих + 25 нових, усі зелені)

Усі AC реалізовані в `priceOrder` (`app/src/discounts.ts`); стовпчик «символ»
уточнює гілку/хелпер, що втілює саме це рішення.

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (`describe`) | Статус |
|---|---|---|---|---|
| AC-1 | Рівень Gold −10% від суми товарів, зверху доставка | `discounts.ts:priceOrder` (`tierDiscount = percentOf(subtotal, tierPercent(order))`) | `AC-1: gold tier discount, no coupons` | ✅ |
| AC-2 | Рівень Silver −5% | `discounts.ts:priceOrder` (той самий рядок, `tierPercent` = 5) | `AC-2: silver tier discount, no coupons` | ✅ |
| AC-3 | Рівень none → рушій no-op над базовою ціною | `discounts.ts:priceOrder` (`tierPercent` = 0, цикл не додає знижок) | `AC-3: no tier, no coupons — engine is a no-op over base pricing` | ✅ |
| AC-4 | Промокод діє на залишку **після** рівня (не додавання %) | `discounts.ts:priceOrder` (`base = remaining`; `remaining -= discount`) | `AC-4: percent coupon stacks sequentially after the tier discount` | ✅ |
| AC-5 | Фіксований промокод (копійки) від залишку | `discounts.ts:priceOrder` (`kind === "fixed"` → `Math.min(coupon.value, base)`) | `AC-5: fixed-amount coupon in kopecks` | ✅ |
| AC-6 | Два різнокатегорійні промокоди — обидва, у порядку введення | `discounts.ts:priceOrder` (цикл по `order.coupons`; `categorySubtotalKopecks`) | `AC-6: two category coupons on different categories both apply` | ✅ |
| AC-7 | Другий промокод на ту саму категорію ігнорується | `discounts.ts:priceOrder` (`discountedCategories` Set) | `AC-7: two coupons on the same category — only the first counts` | ✅ |
| AC-8 | Порядок введення змінює суму для суміші %+фікс | `discounts.ts:priceOrder` (цикл суворо в порядку `order.coupons`) | `AC-8: typed order changes the result for mixed coupon kinds` (2 `it`) | ✅ |
| AC-9 (гранич.) | Знижка > суми товарів → floor 0, доставка все одно | `discounts.ts:priceOrder` (`discount = Math.min(discount, remaining)`; `remaining + shipping`) | `AC-9 (edge): discount larger than the goods total floors at zero` | ✅ |
| AC-10 (гранич.) | Порожнє замовлення → усі нулі, без винятку | `discounts.ts:priceOrder` (жодного спец-кейсу; `subtotal` 0 → усе 0) | `AC-10 (edge): empty order prices to zero without error` | ✅ |
| AC-11 (гранич.) | Пів копійки → half-up (`round(502.5)=503`) | `discounts.ts:percentOf` (`Math.round((base * pct) / 100)`) | `AC-11 (edge): half-kopeck rounds half-up, per step` | ✅ |
| AC-12 | Протермінований / непарсовний `expiresAt` → тиха відмова | `discounts.ts:isExpired` (`Number.isNaN(expiry) \|\| now.getTime() >= expiry`) | `AC-12: expired or unparseable coupon is silently skipped` (2 `it`) | ✅ |
| AC-13 | Невідомий код → тиха відмова | `discounts.ts:priceOrder` (`if (!coupon) continue`) | `AC-13: unknown coupon code is silently skipped` | ✅ |
| AC-14 | Дубльований код зараховується раз | `discounts.ts:priceOrder` (`seenCodes` Set) | `AC-14: duplicate coupon code counts once` | ✅ |
| AC-15 | `minSubtotalKopecks` — проти сирої суми (до рівня) | `discounts.ts:priceOrder` (`subtotal < coupon.minSubtotalKopecks`, `subtotal` захоплено до циклу) | `AC-15: minSubtotalKopecks is checked against the pre-discount subtotal` (2 `it`: a/b) | ✅ |
| AC-16 | База категорійного промокоду = сума категорії, не зменшена рівнем | `discounts.ts:categorySubtotalKopecks` (Σ `lineTotalKopecks` за категорією) | `AC-16: category coupon base is the category line-sum, not reduced by the tier` | ✅ |
| AC-17 | Суто цифрове замовлення → доставка 0, знижки на товари діють | `discounts.ts:priceOrder` (`shipping = shippingKopecks(order)`) | `AC-17: all-digital order waives shipping, discounts still apply to goods` | ✅ |
| AC-18 | Міжнародна доставка додається повністю, не дисконтується | `discounts.ts:priceOrder` (`totalKopecks = remaining + shipping`) | `AC-18: international shipping is added at full rate on top of discounted goods` | ✅ |
| AC-19 | `value` > 100 → clamp до 100 | `discounts.ts:percentOf` (`Math.min(percent, 100)`) | `AC-19: out-of-range percent value is clamped to 100` | ✅ |
| AC-20 | `value` ≤ 0 (недодатний/не число) → знижки 0, код не застосовано | `discounts.ts:percentOf` (`percent <= 0 ? 0 : …`) + `discount <= 0 → continue` | `AC-20: a non-positive percent value yields no discount` | ✅ |
| AC-21 | Категорійний промокод без товарів цієї категорії → тихо пропущено | `discounts.ts:priceOrder` (`base` = 0 → `discount <= 0 → continue`, слот не займається) | `AC-21: a category coupon with no matching items is skipped` | ✅ |
| AC-22 | Зіставлення коду — точне, з регістром (`"autumn15"` ≠ `"AUTUMN15"`) | `discounts.ts:priceOrder` (`byCode.get(code)` — точний ключ Map) | `AC-22: coupon code matching is exact and case-sensitive` | ✅ |

## Зворотна перевірка

**Чи є в коді поведінка, якої немає в жодному AC?**

Первинний прогін знайшов **дві** такі гілки; обидві прямо випливали з таблиці
рішень (D-14, D-16, D-17), просто список AC відставав. Дописано **AC-20** і
**AC-21** з тестами — а не видалено робочі перевірки, бо спека їх уже вимагала.

Лишаються дрібніші захисні гілки, покриті лише спільною логікою, без власного AC:

- `percentOf`: гілка `!Number.isFinite(percent)` (літеральні `NaN`/`Infinity` у
  `value`). Той самий вихід `? 0 :`, що й AC-20 (`value ≤ 0`). Ризик низький —
  захисний clamp за D-16, не окрема поведінка.
- `discounts.ts:priceOrder`: `Math.max(0, …)` навколо фіксованої знижки —
  страхує відʼємний `value` фіксованого промокоду. Не має власного тесту;
  вихід той самий (`discount <= 0 → continue`). За духом D-15/D-16.
- `discount = Math.min(discount, remaining)` для **категорійного** промокоду:
  немає AC, де обчислена категорійна знижка перевищує залишок. Обмеження
  доведене для фіксованого промокоду в AC-9 та інваріантом «`remaining` ≥ 0».

Свідомо лишено як захисні гілки тотальної функції, а не окремі фічі. Нової
поведінки понад спеку немає.

**Чи є AC без тесту?** Немає. Усі 22 AC мають щонайменше один тест; AC-8, AC-12,
AC-15 мають по два `it` (підвипадки того самого критерію).

**Чи є тест, який не мапиться на жоден AC?** Немає. Кожен `describe` названо
`AC-N: …`; сидовані 8 тестів у `pricing.test.ts` перевіряють наявний контракт
(поза скоупом цієї спеки, не змінювались).

## Що з цього вийшло

Зворотна перевірка не знайшла ні «ініціативи» агента понад спеку, ні висячих
тестів — але виявила **дрейф між таблицею рішень і списком AC**: D-14, D-16,
D-17 описували поведінку (0-ефектний промокод не «застосований»; clamp `value`;
категорія без товарів — no-op), якої жоден із перших 19 AC не фіксував числом.
Виправлено дописуванням AC-20/AC-21, а не зміною коду чи рішень.

Окремо, крок рецензування спеки з Task E (`docs/task-e-bonus.md`) знайшов
незакриту неоднозначність у зіставленні кодів (регістр/пробіли) → додано D-21 +
**AC-22** + тест; код уже поводився саме так (`Map.get` за точним ключем), тож
зміна лише зафіксувала намір.

Спеку по суті не довелося переписувати — рішення були повні, відставав їхній
переклад у перевірювані критерії. Це рівно той клас розбіжності, заради якого
робляться і зворотний прохід, і рецензент спеки.
