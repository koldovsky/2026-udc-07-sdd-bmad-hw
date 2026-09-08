# Простежуваність: spec → code → tests (Task C)

**Специфікація:** `docs/spec/pricing-discounts.md`
**Реалізація:** `app/src/discounts.ts`
**Тести:** `app/src/discounts.test.ts`

## Таблиця

| AC | Що перевіряє | Де реалізовано (файл:символ) | Тест (назва) | Статус |
|---|---|---|---|---|
| AC-1 | Знижка за рівнем Gold без промокодів | `discounts.ts:priceOrder` (крок tierDiscountKopecks) | `AC-1: Gold tier discount without coupons` | ✅ |
| AC-2 | Прострочений промокод не блокує валідні | `discounts.ts:isCouponExpired` | `AC-2: two coupons entered, one expired` | ✅ |
| AC-3 | Два промокоди на одну категорію рахуються послідовно | `discounts.ts:priceOrder` (categoryRemaining) | `AC-3: two coupons on the same category` | ✅ |
| AC-4 | Знижка перевищує суму замовлення → 0, не відʼємне | `discounts.ts:priceOrder` (`Math.max(0, remaining)`) | `AC-4: category coupon discount exceeds the order (floors at 0)` | ✅ |
| AC-5 | Рівень (Gold) і відсотковий промокод — послідовно | `discounts.ts:priceOrder` (tier → remaining → coupon) | `AC-5: Gold tier and a percent coupon combine sequentially` | ✅ |
| AC-6 | Знижка за рівнем Silver без промокодів | `discounts.ts:priceOrder` (крок tierDiscountKopecks) | `AC-6: Silver tier discount without coupons` | ✅ |
| AC-7 | Рівень (Silver) і відсотковий промокод — послідовно, з округленням | `discounts.ts:percentOf` | `AC-7: Silver tier and a percent coupon combine sequentially` | ✅ |
| AC-8 | Промокод нижче мінімальної суми відхиляється з помилкою | `discounts.ts:priceOrder` (перевірка `minSubtotalKopecks`) | `AC-8: order subtotal below the coupon's minimum` | ✅ |
| AC-9 | Округлення дробової копійки вниз на проміжному кроці | `discounts.ts:percentOf` | `AC-9: fractional kopeck from tier discount rounds down` | ✅ |
| AC-10 | Промокод без рівня лояльності рахується від повної суми | `discounts.ts:priceOrder` (tierDiscountKopecks = 0) | `AC-10: a valid coupon without any loyalty tier` | ✅ |
| AC-11 | Фіксований промокод застосовується перед відсотковим | `discounts.ts:priceOrder` (два проходи `fixed`/`percent`) | `AC-11: a fixed coupon applies before a percent coupon` | ✅ |

## Зворотна перевірка

Пройдіться у зворотний бік — від коду до специфікації:

- **Чи є в коді поведінка, якої немає в жодному AC?**
  Так, одна: обробка **невідомого коду промокоду** (`discounts.ts:priceOrder`,
  повідомлення `"Промокод XXXX не знайдено"`). Це рішення `D-13` з розділу 3
  специфікації, але в розділі 4 для нього не завели окремий `AC-N` — розділ 3
  описав розвилку, а розділ 4 її не покрив. Найчистіше рішення: не забирати
  код (без нього необроблений код промокоду впав би винятком або тихо
  ігнорувався б, а це саме той випадок, від якого застерігає D-8/D-10), а
  дописати в специфіку `AC-12` заднім числом. Поки що зафіксовано як
  розбіжність тут, а не «мовчки виправлено».
- **Чи є AC без тесту?** Немає — усі `AC-1`…`AC-11` мають по одному тесту
  вище в таблиці.
- **Чи є тест, який не мапиться на жоден AC?** Два:
  - `D-13 (no matching AC): an unknown coupon code is reported without blocking valid ones`
    — тест на поведінку з попереднього пункту; існує, бо код її реалізує,
    хоча формального AC під неї нема.
  - `boundary: empty order has no discounts and no items to charge for` —
    граничний випадок (порожнє замовлення) з розділу 4 шаблону специфікації;
    у явних `AC-N` він не пронумерований, хоча вимога "мінімум два граничні"
    в специфікації вже закрита через `AC-4` і `AC-9`, тож цей тест — додаткова
    підстраховка, а не покриття пропущеного критерію.

## Що з цього вийшло

Зворотна перевірка знайшла одну реальну розбіжність — `D-13` (невідомий код
промокоду) існує у разіділі 3 специфікації, але відсутній відповідний
`AC` у розділі 4. Решта розбіжностей — тест виявився ширшим за формальний список AC (порожнє замовлення): специфікація не вимагала саме такого ID, а лише покриття
граничних випадків, яке вже забезпечене. Під час реалізації знайшовся
арифметичний баг у самій специфікації (`AC-6` мав "765 грн" замість
коректних "950 грн" — явно скопійовано з `AC-5`).
