# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts`

## Таблиця

Один рядок на кожен `AC-N` зі специфікації. Порожніх клітинок бути не повинно.

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Знижка за рівнем Gold | `discounts.ts:priceOrder` | `AC-1: Gold tier without coupons applies 10% discount` | ✅ |
| AC-2 | Прострочений промокод | `discounts.ts:priceOrder` | `AC-2: Expired coupon is ignored` | ✅ |
| AC-3 | Послідовне застосування кількох промокодів | `discounts.ts:priceOrder` | `AC-3: Two coupons are applied sequentially to remaining sum` | ✅ |
| AC-4 | Обмеження знижки загальною сумою | `discounts.ts:priceOrder` | `AC-4: Discount exceeds subtotal caps total at 0 + shipping` | ✅ |
| AC-5 | Обробка порожнього замовлення | `discounts.ts:priceOrder` | `AC-5: Empty order results in 0` | ✅ |
| AC-6 | Округлення знижки (Math.round) | `discounts.ts:priceOrder` | `AC-6: Tier discount rounding half kopeck` | ✅ |
| AC-7 | minSubtotalKopecks перевіряється до знижок | `discounts.ts:priceOrder` | `AC-7: minSubtotalKopecks applies to original subtotal` | ✅ |
| AC-8 | Промокод на категорію розраховується коректно | `discounts.ts:priceOrder` | `AC-8: Category coupon calculates percentage based on original category subtotal` | ✅ |
| AC-9 | Fixed category coupon cap | `discounts.ts:priceOrder` | `AC-9: Category coupon fixed amount applies but is capped at category original subtotal` | ✅ |

## Зворотна перевірка

Пройдіться у зворотний бік — від коду до специфікації:

- **Чи є в коді поведінка, якої немає в жодному AC?** Раніше під час зворотної перевірки було пропущено гілку для категорійних купонів із `kind === "fixed"` (яка використовує `Math.min()`). Це було знайдено на рев'ю і виправлено додаванням `AC-9`. Також було знайдено розбіжність контракту (поле `Order.coupons: string[]` не читалося), яку теж було виправлено, оскільки порядок купонів має визначатися масивом рядків із замовлення.
- **Чи є AC без тесту?** Немає.
- **Чи є тест, який не мапиться на жоден AC?** Немає.

## Що з цього вийшло

Зворотна перевірка "від коду", а не "від спеки" (тобто проходження по кожному `if` у коді та запит "який AC його вимагає") дозволила виявити пропущений тестовий сценарій (`AC-9`) та розбіжність використання `Order.coupons`. Це підтверджує, що правильна зворотна простежуваність є критичною для знаходження подібних "сліпих зон".
