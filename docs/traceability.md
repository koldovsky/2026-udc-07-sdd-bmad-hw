# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts`

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Знижка за рівнем Gold, без промокодів | `discounts.ts:priceOrder` (`bucketDiscountKopecks` з `tierPercent`) | `AC-1: Gold tier alone` | ✅ |
| AC-2 | Рівень і промокод складаються (D-1) | `discounts.ts:bucketDiscountKopecks` (extraPercent + percent-купони) | `AC-2: tier and coupon percentages add up` | ✅ |
| AC-3 | Два промокоди на одну категорію (D-3, D-5) | `discounts.ts:priceOrder` (цикл по `categories`) + `bucketDiscountKopecks` | `AC-3: two coupons on the same category` | ✅ |
| AC-4 | Прострочений промокод (D-8) | `discounts.ts:resolveValidCoupons` (`now >= new Date(coupon.expiresAt)`) | `AC-4: expired coupon has no effect` | ✅ |
| AC-5 | `minSubtotalKopecks` перевіряється до знижок (D-6) | `discounts.ts:resolveValidCoupons` (перевірка проти `subtotal`) | `AC-5: coupon below minSubtotalKopecks does not apply` | ✅ |
| AC-6 | Знижка не перевищує вартість товарів (D-7), гранична | `discounts.ts:priceOrder` (`Math.min(subtotal, ...)`) | `AC-6 (boundary): discount larger than the order is capped, never negative` | ✅ |
| AC-7 | Порожнє замовлення, гранична | `discounts.ts:priceOrder` (усі гілки коректні при `subtotal = 0`) | `AC-7 (boundary): empty order does not throw` | ✅ |
| AC-8 | Округлення вниз, пів копійки, гранична (D-4) | `discounts.ts:bucketDiscountKopecks` (`Math.floor`) | `AC-8 (boundary): exact half-kopeck rounds down` | ✅ |
| AC-9 | Невідомий код промокоду (D-9) | `discounts.ts:resolveValidCoupons` (`byCode.get(typedCode)`) | `AC-9: unknown coupon code has no effect` | ✅ |
| AC-10 | Дублікат коду застосовується раз (D-11) | `discounts.ts:resolveValidCoupons` (`seen`-множина) | `AC-10: duplicate coupon code applies once` | ✅ |
| AC-11 | База знижки не включає доставку (D-2) | `discounts.ts:priceOrder` (`shippingKopecks` додається після знижки) | `AC-11: discount base excludes shipping` | ✅ |
| AC-12 | Категорійний промокод без товарів цієї категорії (D-10) | `discounts.ts:categorySubtotalKopecks` (0 при відсутності товарів) | `AC-12: category coupon with no matching items is valid but contributes 0` | ✅ |
| AC-13 | Сума відсотків на категорію обрізається до 100% (D-12) | `discounts.ts:bucketDiscountKopecks` (`Math.min(100, ...)`) | `AC-13: combined percentage for one category is capped at 100%` | ✅ |
| AC-14 | Прострочення перевіряється за явним `now` (D-13) | `discounts.ts:priceOrder` (параметр `now`) → `resolveValidCoupons` | `AC-14: expiry is checked against the explicit \`now\` parameter` | ✅ |
| AC-15 | Код промокоду чутливий до регістру (D-14) | `discounts.ts:resolveValidCoupons` (`Map` за точним `code`) | `AC-15: coupon code matching is case-sensitive` | ✅ |
| AC-16 | Результат без розбивки за джерелом (D-15) | `discounts.ts:PriceBreakdown` (форма типу) | `AC-16: breakdown reports one combined discount, not split by source` | ✅ |

## Зворотна перевірка

- **Чи є в коді поведінка, якої немає в жодному AC?** Немає. Кожна гілка
  `discounts.ts` (дедуп, каталог-lookup, прострочення, поріг, кап на 100%,
  кап на вартість товарів, округлення, виключення доставки з бази) має
  відповідний AC.
- **Чи є AC без тесту?** Немає — усі AC-1…AC-16 мають тест з тим самим ID
  у назві.
- **Чи є тест, який не мапиться на жоден AC?** Немає — 16 тестів на 16 AC,
  один до одного.

## Що з цього вийшло

Зворотна перевірка знайшла одну реальну розбіжність, і саме на етапі
переносу специфікації в OpenSpec (Task B): таблиця рішень у Task A мала
рядки `D-10`, `D-12`, `D-13`, `D-14`, `D-15` з обґрунтуванням, але **без**
відповідного `AC-N` — коли OpenSpec змусив написати сценарій на кожну
вимогу (`specs/discounts/spec.md`), ці пʼять рішень таки отримали
сценарії там, а `docs/spec/pricing-discounts.md` відстав. Це саме той
випадок «пропущений критерій»: специфіка полягала не в зайвій ініціативі
коду, а в неповному списку AC. Виправлено дописуванням `AC-12`…`AC-16` у
`docs/spec/pricing-discounts.md` **до** написання коду для Task C, а не
прибиранням поведінки — усі пʼять рішень (D-10, D-12, D-13, D-14, D-15)
залишаються потрібними: без D-12 (кап 100% на категорію), наприклад, два
промокоди на одну категорію (70%+60%) дали б знижку більшу за саму
категорію, хоча підсумок замовлення в цілому цього б не спіймав (D-7 діє
на рівні всього замовлення, а не окремої категорії).
